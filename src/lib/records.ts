import { randomUUID } from 'node:crypto';
import { env } from './env';
import { appendRow, batchUpdateValues, columnLetter, deleteRow, readTable } from './sheets';
import { decrypt, encryptIfNeeded, isEncrypted } from './crypto';
import { allowedKeys, getFieldSchema, isSecretKey } from '@/config/fieldSchemas';
import type { HealthStatus, SafeToolRecord, ToolRecord } from './types';

/**
 * タブ2（records）へのアクセス層。
 * 検索は毎回 Sheets を叩かず、メモリキャッシュ + search_blob 経由で行う（要件定義書 §8）。
 */

export const RECORD_COLUMNS = [
  'id',
  'system_name',
  'google_account',
  'category',
  'subcategory',
  'details_json',
  'health_check_url',
  'last_status',
  'last_checked_at',
  'search_blob',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
] as const;

type RecordColumn = (typeof RECORD_COLUMNS)[number];

type CacheEntry = {
  records: ToolRecord[];
  /** id → シート上の行番号（1 始まり。ヘッダーが 1 行目） */
  rowNumberById: Map<string, number>;
  headers: string[];
  loadedAt: number;
};

const CACHE_TTL_MS = 60_000;
let cache: CacheEntry | null = null;

export function invalidateCache(): void {
  cache = null;
}

function parseDetails(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        result[key] = value == null ? '' : String(value);
      }
      return result;
    }
  } catch {
    // 壊れた JSON は空として扱い、一覧全体が落ちないようにする
  }
  return {};
}

function normalizeStatus(raw: string): HealthStatus {
  return raw === 'up' || raw === 'down' || raw === 'unknown' ? raw : 'none';
}

/** 機密値を除いた検索用の連結テキスト（要件定義書 §8） */
export function buildSearchBlob(record: {
  system_name: string;
  google_account: string;
  category: string;
  subcategory: string;
  details: Record<string, string>;
}): string {
  const parts = [record.system_name, record.google_account, record.category, record.subcategory];
  for (const [key, value] of Object.entries(record.details)) {
    if (isSecretKey(record.subcategory, key) || isEncrypted(value)) continue;
    if (value) parts.push(value);
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export async function loadRecords(force = false): Promise<CacheEntry> {
  if (!force && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;

  const { headers, rows } = await readTable(env.tabs.records);
  const records: ToolRecord[] = [];
  const rowNumberById = new Map<string, number>();

  rows.forEach((row, index) => {
    const id = (row.id ?? '').trim();
    if (!id) return; // 空行はスキップ
    records.push({
      id,
      system_name: row.system_name ?? '',
      google_account: row.google_account ?? '',
      category: row.category ?? '',
      subcategory: row.subcategory ?? '',
      details: parseDetails(row.details_json ?? ''),
      health_check_url: row.health_check_url ?? '',
      last_status: normalizeStatus(row.last_status ?? ''),
      last_checked_at: row.last_checked_at ?? '',
      created_at: row.created_at ?? '',
      updated_at: row.updated_at ?? '',
      created_by: row.created_by ?? '',
      updated_by: row.updated_by ?? '',
    });
    rowNumberById.set(id, index + 2); // +2 = ヘッダー行 + 0 始まり補正
  });

  cache = {
    records,
    rowNumberById,
    headers: headers.length > 0 ? headers : [...RECORD_COLUMNS],
    loadedAt: Date.now(),
  };
  return cache;
}

export async function listRecords(force = false): Promise<ToolRecord[]> {
  return (await loadRecords(force)).records;
}

export async function getRecord(id: string): Promise<ToolRecord | null> {
  const { records } = await loadRecords();
  return records.find((r) => r.id === id) ?? null;
}

/** search_blob に対する部分一致検索。空クエリなら全件 */
export async function searchRecords(query: string): Promise<ToolRecord[]> {
  const { records } = await loadRecords();
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return records;
  return records.filter((record) => {
    const blob = buildSearchBlob(record);
    return terms.every((term) => blob.includes(term));
  });
}

/** 機密値をマスクして画面へ渡す（初期表示ではサーバーから平文を送らない） */
export function toSafeRecord(record: ToolRecord): SafeToolRecord {
  const schema = getFieldSchema(record.subcategory);
  const details = schema
    .filter((field) => (record.details[field.key] ?? '') !== '')
    .map((field) => {
      const raw = record.details[field.key] ?? '';
      return {
        key: field.key,
        label: field.label,
        secret: field.secret,
        hasValue: raw !== '',
        value: field.secret ? '' : raw,
      };
    });

  // スキーマ外のキー（過去データ等）も表示だけはする
  for (const [key, value] of Object.entries(record.details)) {
    if (schema.some((f) => f.key === key) || !value) continue;
    const secret = isEncrypted(value);
    details.push({ key, label: key, secret, hasValue: true, value: secret ? '' : value });
  }

  const { details: _omit, ...rest } = record;
  return { ...rest, details };
}

/** 詳細ページの「クリックして表示」用。1 項目だけ復号する */
export function revealSecret(record: ToolRecord, key: string): string | null {
  const raw = record.details[key];
  if (raw === undefined || raw === '') return null;
  return decrypt(raw);
}

export type RecordInput = {
  system_name: string;
  google_account: string;
  category: string;
  subcategory: string;
  details: Record<string, string>;
  health_check_url: string;
  /** 編集時に「値を削除する」と明示された機密項目のキー */
  clearSecretKeys?: string[];
};

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** 必須項目・許可キー・重複のバリデーション（要件定義書 §7） */
export async function validateRecord(
  input: RecordInput,
  excludeId?: string,
): Promise<ValidationResult> {
  const errors: string[] = [];

  if (!input.system_name.trim()) errors.push('システム名は必須です。');
  if (!input.category.trim()) errors.push('大項目は必須です。');
  if (!input.subcategory.trim()) errors.push('小項目は必須です。');

  const allowed = allowedKeys(input.subcategory);
  for (const key of Object.keys(input.details)) {
    if (!allowed.has(key)) errors.push(`「${key}」は ${input.subcategory} の項目として定義されていません。`);
  }
  for (const field of getFieldSchema(input.subcategory)) {
    if (field.required && !(input.details[field.key] ?? '').trim()) {
      errors.push(`「${field.label}」は必須です。`);
    }
  }

  if (input.health_check_url.trim()) {
    try {
      const url = new URL(input.health_check_url.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        errors.push('ヘルスチェックURLは http / https のみ指定できます。');
      }
    } catch {
      errors.push('ヘルスチェックURLの形式が正しくありません。');
    }
  }

  // 重複検知：system_name × subcategory × google_account
  const { records } = await loadRecords();
  const duplicated = records.some(
    (r) =>
      r.id !== excludeId &&
      r.system_name.trim() === input.system_name.trim() &&
      r.subcategory.trim() === input.subcategory.trim() &&
      r.google_account.trim() === input.google_account.trim(),
  );
  if (duplicated) {
    errors.push('同じ「システム名 × 小項目 × Google アカウント」の登録が既に存在します。');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** 機密フィールドを暗号化した details を作る */
function encryptDetails(subcategory: string, details: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(details)) {
    if (value === '') continue;
    result[key] = isSecretKey(subcategory, key) ? encryptIfNeeded(value) : value;
  }
  return result;
}

function columnIndex(headers: string[], column: RecordColumn): number {
  const index = headers.indexOf(column);
  return index >= 0 ? index : RECORD_COLUMNS.indexOf(column);
}

function toRow(headers: string[], record: ToolRecord): string[] {
  const values: Record<RecordColumn, string> = {
    id: record.id,
    system_name: record.system_name,
    google_account: record.google_account,
    category: record.category,
    subcategory: record.subcategory,
    details_json: JSON.stringify(record.details),
    health_check_url: record.health_check_url,
    last_status: record.last_status,
    last_checked_at: record.last_checked_at,
    search_blob: buildSearchBlob(record),
    created_at: record.created_at,
    updated_at: record.updated_at,
    created_by: record.created_by,
    updated_by: record.updated_by,
  };
  const source = headers.length > 0 ? headers : [...RECORD_COLUMNS];
  return source.map((header) => values[header as RecordColumn] ?? '');
}

export async function createRecord(input: RecordInput, actor: string): Promise<ToolRecord> {
  const now = new Date().toISOString();
  const record: ToolRecord = {
    id: randomUUID(),
    system_name: input.system_name.trim(),
    google_account: input.google_account.trim(),
    category: input.category.trim(),
    subcategory: input.subcategory.trim(),
    details: encryptDetails(input.subcategory, input.details),
    health_check_url: input.health_check_url.trim(),
    last_status: input.health_check_url.trim() ? 'unknown' : 'none',
    last_checked_at: '',
    created_at: now,
    updated_at: now,
    created_by: actor,
    updated_by: actor,
  };

  const { headers } = await loadRecords();
  await appendRow(env.tabs.records, toRow(headers, record));
  invalidateCache();
  return record;
}

export async function updateRecord(
  id: string,
  input: RecordInput,
  actor: string,
): Promise<ToolRecord | null> {
  const { records, rowNumberById, headers } = await loadRecords(true);
  const existing = records.find((r) => r.id === id);
  const rowNumber = rowNumberById.get(id);
  if (!existing || !rowNumber) return null;

  // 機密項目は編集画面に平文を出さないため、空欄なら既存の暗号値を引き継ぐ。
  // 明示的に「値を削除する」と指定されたキーのみ消す。
  const clearKeys = new Set(input.clearSecretKeys ?? []);
  const nextDetails = encryptDetails(input.subcategory, input.details);
  for (const field of getFieldSchema(input.subcategory)) {
    if (!field.secret) continue;
    const submitted = (input.details[field.key] ?? '').trim();
    if (submitted || clearKeys.has(field.key)) continue;
    const previous = existing.details[field.key];
    if (previous) nextDetails[field.key] = previous;
  }

  // フィールド定義に無い既存キー（定義変更前に登録された項目など）は、
  // 編集フォームに出ないため送られてこない。黙って失わないよう引き継ぐ。
  const schemaKeys = new Set(getFieldSchema(input.subcategory).map((field) => field.key));
  const sameSubcategory = existing.subcategory.trim() === input.subcategory.trim();
  if (sameSubcategory) {
    for (const [key, value] of Object.entries(existing.details)) {
      if (schemaKeys.has(key) || clearKeys.has(key) || !value) continue;
      if (nextDetails[key] === undefined) nextDetails[key] = value;
    }
  }

  const updated: ToolRecord = {
    ...existing,
    system_name: input.system_name.trim(),
    google_account: input.google_account.trim(),
    category: input.category.trim(),
    subcategory: input.subcategory.trim(),
    details: nextDetails,
    health_check_url: input.health_check_url.trim(),
    last_status: input.health_check_url.trim() ? existing.last_status : 'none',
    updated_at: new Date().toISOString(),
    updated_by: actor,
  };

  const row = toRow(headers, updated);
  const lastColumn = columnLetter(row.length - 1);
  await batchUpdateValues([
    { range: `${env.tabs.records}!A${rowNumber}:${lastColumn}${rowNumber}`, values: [row] },
  ]);
  invalidateCache();
  return updated;
}

export async function removeRecord(id: string): Promise<boolean> {
  const { rowNumberById } = await loadRecords(true);
  const rowNumber = rowNumberById.get(id);
  if (!rowNumber) return false;
  await deleteRow(env.tabs.records, rowNumber - 1); // deleteDimension は 0 始まり
  invalidateCache();
  return true;
}

/** 監視ジョブからのステータス書き戻し（batchUpdate でまとめる） */
export async function writeStatuses(
  results: { id: string; status: HealthStatus; checkedAt: string }[],
): Promise<number> {
  if (results.length === 0) return 0;
  const { rowNumberById, headers } = await loadRecords(true);
  const statusColumn = columnLetter(columnIndex(headers, 'last_status'));
  const checkedColumn = columnLetter(columnIndex(headers, 'last_checked_at'));
  const tab = env.tabs.records;

  const updates = results.flatMap((result) => {
    const rowNumber = rowNumberById.get(result.id);
    if (!rowNumber) return [];
    return [
      { range: `${tab}!${statusColumn}${rowNumber}`, values: [[result.status]] },
      { range: `${tab}!${checkedColumn}${rowNumber}`, values: [[result.checkedAt]] },
    ];
  });

  await batchUpdateValues(updates);
  invalidateCache();
  return results.length;
}
