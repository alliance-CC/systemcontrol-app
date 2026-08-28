import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { KnowledgeSource } from './types';

/**
 * 参照先の一覧は knowledge/sources.json で管理する。
 * 現場の人がツールを追加したくなったら、フォルダを足すか sources.json に GitHub リポジトリを 1 行足すだけでよい。
 */

export const KNOWLEDGE_ROOT = path.join(process.cwd(), 'knowledge');
const SOURCES_FILE = path.join(KNOWLEDGE_ROOT, 'sources.json');

let cache: { sources: KnowledgeSource[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

function isValidSource(value: unknown): value is KnowledgeSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  if (typeof source.id !== 'string' || typeof source.label !== 'string') return false;
  if (source.type === 'local') return typeof source.path === 'string';
  if (source.type === 'github') return typeof source.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(source.repo);
  return false;
}

export async function loadSources(force = false): Promise<KnowledgeSource[]> {
  if (!force && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.sources;

  let sources: KnowledgeSource[] = [];
  try {
    const raw = await readFile(SOURCES_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { sources?: unknown[] };
    sources = (parsed.sources ?? []).filter(isValidSource);
  } catch {
    // sources.json が無い / 壊れている場合は knowledge/ 直下だけを見る
    sources = [];
  }

  cache = { sources, loadedAt: Date.now() };
  return sources;
}

export function invalidateSourcesCache(): void {
  cache = null;
}

/**
 * sources.json の `path` を knowledge/ 配下の実パスへ解決する。
 * knowledge/ の外は参照させない（パストラバーサル対策）。
 * ビルド時のファイルトレースを knowledge/ に限定するため、必ず KNOWLEDGE_ROOT からの join で組み立てる。
 */
export function resolveLocalPath(configured: string): string | null {
  const normalized = configured.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '');
  const relative = normalized.startsWith('knowledge/')
    ? normalized.slice('knowledge/'.length)
    : normalized === 'knowledge'
      ? ''
      : normalized;

  const segments = relative.split('/').filter((segment) => segment && segment !== '.');
  if (segments.some((segment) => segment === '..')) return null;

  const resolved = path.join(KNOWLEDGE_ROOT, ...segments);
  return resolved === KNOWLEDGE_ROOT || resolved.startsWith(KNOWLEDGE_ROOT + path.sep) ? resolved : null;
}
