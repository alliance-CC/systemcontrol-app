import { env } from './env';
import { appendRow, readTable } from './sheets';
import { knownSubcategories } from '@/config/fieldSchemas';
import type { MasterData } from './types';

/** タブ1（master）。登録フォームのプルダウン選択肢 */

const CACHE_TTL_MS = 300_000;
let cache: { data: MasterData; loadedAt: number } | null = null;

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ja'),
  );
}

export async function loadMaster(force = false): Promise<MasterData> {
  if (!force && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.data;

  const { rows } = await readTable(env.tabs.master);
  const data: MasterData = {
    categories: unique(rows.map((r) => r.category ?? '')),
    // スキーマ定義済みの小項目も候補に含める（シートが空でもフォームが使える）
    subcategories: unique([...rows.map((r) => r.subcategory ?? ''), ...knownSubcategories()]),
    googleAccounts: unique(rows.map((r) => r.google_account ?? '')),
  };
  cache = { data, loadedAt: Date.now() };
  return data;
}

export function invalidateMasterCache(): void {
  cache = null;
}

/** フォームからの新規選択肢追加 */
export async function addMasterEntry(entry: {
  category?: string;
  subcategory?: string;
  google_account?: string;
}): Promise<void> {
  const current = await loadMaster(true);
  const isNew =
    (entry.category && !current.categories.includes(entry.category.trim())) ||
    (entry.subcategory && !current.subcategories.includes(entry.subcategory.trim())) ||
    (entry.google_account && !current.googleAccounts.includes(entry.google_account.trim()));
  if (!isNew) return;

  await appendRow(env.tabs.master, [
    entry.category?.trim() ?? '',
    entry.subcategory?.trim() ?? '',
    entry.google_account?.trim() ?? '',
  ]);
  invalidateMasterCache();
}
