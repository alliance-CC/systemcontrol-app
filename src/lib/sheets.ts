import { JWT } from 'google-auth-library';
import { env } from './env';

/**
 * Google Sheets API クライアント（REST を直接叩く軽量版）。
 * - 書き込みは values:batchUpdate でまとめる（レート制限対策・CLAUDE.md §5）
 * - 429 / 5xx は指数バックオフで再試行
 */

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let cachedClient: JWT | null = null;

function getClient(): JWT {
  if (!cachedClient) {
    cachedClient = new JWT({
      email: env.googleServiceAccountEmail,
      key: env.googlePrivateKey,
      scopes: SCOPES,
    });
  }
  return cachedClient;
}

async function getAccessToken(): Promise<string> {
  const { token } = await getClient().getAccessToken();
  if (!token) throw new Error('Google の access token を取得できませんでした。');
  return token;
}

const MAX_ATTEMPTS = 4;

async function sheetsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      // 指数バックオフ（0.5s, 1s, 2s ...）+ ジッター
      const wait = 500 * 2 ** (attempt - 1) + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    const token = await getAccessToken();
    const response = await fetch(`${SHEETS_API}/${env.sheetId}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const body = await response.text();
    lastError = new Error(`Sheets API ${response.status}: ${body.slice(0, 300)}`);

    // 429（レート制限）と 5xx のみ再試行。4xx は設定ミスなので即座に失敗させる
    if (response.status !== 429 && response.status < 500) break;
  }

  throw lastError ?? new Error('Sheets API 呼び出しに失敗しました。');
}

/** A1 表記のレンジを読む。空セルは '' で埋めて矩形化する */
export async function readRange(range: string): Promise<string[][]> {
  const encoded = encodeURIComponent(range);
  const data = await sheetsFetch<{ values?: string[][] }>(
    `/values/${encoded}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
  );
  return (data.values ?? []).map((row) => row.map((cell) => (cell == null ? '' : String(cell))));
}

/** タブ全体を読み、1 行目をヘッダーとしてオブジェクト配列に変換する */
export async function readTable(tab: string): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const values = await readRange(`${tab}!A1:ZZ`);
  if (values.length === 0) return { headers: [], rows: [] };

  const headers = values[0].map((h) => h.trim());
  const rows = values.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = row[index] ?? '';
    });
    return record;
  });
  return { headers, rows };
}

/** 末尾に 1 行追加する */
export async function appendRow(tab: string, values: string[]): Promise<void> {
  const range = encodeURIComponent(`${tab}!A1`);
  await sheetsFetch(
    `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [values] }) },
  );
}

export type ValueRange = { range: string; values: string[][] };

/** 複数レンジをまとめて書き込む（監視ジョブの書き戻しで使用） */
export async function batchUpdateValues(updates: ValueRange[]): Promise<void> {
  if (updates.length === 0) return;
  await sheetsFetch('/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
  });
}

let sheetIdCache: Map<string, number> | null = null;

/** タブ名 → sheetId（gid）。行削除に必要 */
async function getSheetGid(tab: string): Promise<number> {
  if (!sheetIdCache) {
    const meta = await sheetsFetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
      '?fields=sheets.properties(sheetId,title)',
    );
    sheetIdCache = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  }
  const gid = sheetIdCache.get(tab);
  if (gid === undefined) {
    sheetIdCache = null;
    throw new Error(`タブ「${tab}」が見つかりません。SETUP.md 手順 3 を確認してください。`);
  }
  return gid;
}

/** 1 行削除する（rowIndex は 0 始まり＝ヘッダー行が 0） */
export async function deleteRow(tab: string, rowIndex: number): Promise<void> {
  const sheetId = await getSheetGid(tab);
  await sheetsFetch(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
          },
        },
      ],
    }),
  });
}

/** 疎通確認用。詳細は返さず真偽のみ（/api/health は内部情報を漏らさない） */
export async function ping(): Promise<boolean> {
  await sheetsFetch('?fields=spreadsheetId');
  return true;
}

/** A=0 の列インデックスを A1 表記の列名に変換 */
export function columnLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}
