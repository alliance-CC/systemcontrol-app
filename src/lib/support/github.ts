import { env } from '../env';
import type { KnowledgeDoc, KnowledgeSource } from './types';

/**
 * GitHub リポジトリの Markdown を読み込む。
 * Vercel のサーバーレスはディスクへ書けないため、取得結果はメモリにキャッシュする（TTL 30 分）。
 * GITHUB_TOKEN があれば private リポジトリも読めるが、権限は Contents: Read-only で十分。
 */

const API = 'https://api.github.com';
const CACHE_TTL_MS = 30 * 60_000;
const MAX_FILES = 60;
const MAX_FILE_BYTES = 200_000;
const READABLE = /\.(md|markdown|mdx|txt)$/i;

type CacheEntry = { docs: KnowledgeDoc[]; loadedAt: number };
const cache = new Map<string, CacheEntry>();

export function invalidateGithubCache(sourceId?: string): void {
  if (sourceId) cache.delete(sourceId);
  else cache.clear();
}

function headers(): Record<string, string> {
  const base: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'systemcontrol-app/1.0 knowledge-sync',
  };
  if (env.support.githubToken) base.Authorization = `Bearer ${env.support.githubToken}`;
  return base;
}

/**
 * include パターンの簡易マッチ。
 * `README.md`（完全一致）、`docs/*.md`（1 階層）、`docs/**` や `docs/**\/*.md`（再帰）に対応する。
 */
function matchesInclude(filePath: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return true;
  const GLOBSTAR_SLASH = '@@GLOBSTAR_SLASH@@';
  const GLOBSTAR = '@@GLOBSTAR@@';
  return patterns.some((pattern) => {
    const source = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replaceAll('**/', GLOBSTAR_SLASH)
      .replaceAll('**', GLOBSTAR)
      .replaceAll('*', '[^/]*')
      .replaceAll(GLOBSTAR_SLASH, '(?:.*/)?')
      .replaceAll(GLOBSTAR, '.*');
    return new RegExp(`^${source}$`).test(filePath);
  });
}

type TreeResponse = { tree?: { path: string; type: string; size?: number }[]; truncated?: boolean };

async function listFiles(repo: string, ref: string, include?: string[]): Promise<string[]> {
  const response = await fetch(`${API}/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}（${repo}）`);
  }
  const data = (await response.json()) as TreeResponse;
  return (data.tree ?? [])
    .filter((entry) => entry.type === 'blob')
    .filter((entry) => READABLE.test(entry.path))
    .filter((entry) => (entry.size ?? 0) <= MAX_FILE_BYTES)
    .filter((entry) => matchesInclude(entry.path, include))
    .slice(0, MAX_FILES)
    .map((entry) => entry.path);
}

async function fetchFile(repo: string, ref: string, filePath: string): Promise<string | null> {
  const encoded = filePath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${API}/repos/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`, {
    headers: { ...headers(), Accept: 'application/vnd.github.raw' },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return response.text();
}

function titleOf(content: string, filePath: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  return heading?.[1].trim() || filePath.split('/').pop() || filePath;
}

export async function loadGithubDocs(
  source: Extract<KnowledgeSource, { type: 'github' }>,
  force = false,
): Promise<KnowledgeDoc[]> {
  const cached = cache.get(source.id);
  if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.docs;

  const ref = source.ref || 'HEAD';
  const paths = await listFiles(source.repo, ref, source.include);

  const settled = await Promise.allSettled(paths.map((filePath) => fetchFile(source.repo, ref, filePath)));
  const docs: KnowledgeDoc[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status !== 'fulfilled' || !outcome.value) return;
    const filePath = paths[index];
    docs.push({
      sourceId: source.id,
      sourceLabel: source.label,
      path: filePath,
      title: titleOf(outcome.value, filePath),
      content: outcome.value,
      url: `https://github.com/${source.repo}/blob/${ref === 'HEAD' ? 'main' : ref}/${filePath}`,
    });
  });

  cache.set(source.id, { docs, loadedAt: Date.now() });
  return docs;
}
