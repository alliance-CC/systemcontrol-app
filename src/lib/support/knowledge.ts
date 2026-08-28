import { loadGithubDocs, invalidateGithubCache } from './github';
import { discoverLocalSources, loadLocalDocs } from './local';
import { invalidateSourcesCache, loadSources } from './sources';
import type { KnowledgeChunk, KnowledgeDoc, KnowledgeSource } from './types';

/**
 * 現場サポートモードの知識ベース。
 * knowledge/ 配下のフォルダと、sources.json に登録した GitHub リポジトリの Markdown をまとめて扱う。
 */

const CACHE_TTL_MS = 10 * 60_000;
const MAX_CHUNK_CHARS = 1_200;

type Registry = {
  sources: KnowledgeSource[];
  docs: KnowledgeDoc[];
  chunks: KnowledgeChunk[];
  errors: { sourceId: string; message: string }[];
  loadedAt: number;
};

let registry: Registry | null = null;

/** 見出し単位で分割し、長すぎる節はさらに分割する */
export function chunkDoc(doc: KnowledgeDoc): KnowledgeChunk[] {
  const lines = doc.content.split(/\r?\n/);
  const chunks: KnowledgeChunk[] = [];
  let headings: string[] = [];
  let buffer: string[] = [];
  let index = 0;

  const flush = () => {
    const content = buffer.join('\n').trim();
    buffer = [];
    if (!content) return;
    // 長い節は文字数で分割する
    for (let offset = 0; offset < content.length; offset += MAX_CHUNK_CHARS) {
      chunks.push({
        id: `${doc.sourceId}:${doc.path}#${index++}`,
        sourceId: doc.sourceId,
        sourceLabel: doc.sourceLabel,
        path: doc.path,
        title: doc.title,
        headings: [...headings],
        content: content.slice(offset, offset + MAX_CHUNK_CHARS),
        url: doc.url,
      });
    }
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      headings = [...headings.slice(0, level - 1), heading[2].trim()];
      buffer.push(line);
      continue;
    }
    buffer.push(line);
  }
  flush();

  return chunks;
}

async function build(force: boolean): Promise<Registry> {
  const registered = await loadSources(force);
  const discovered = await discoverLocalSources(registered);
  const sources = [...registered, ...discovered];

  const docs: KnowledgeDoc[] = [];
  const errors: { sourceId: string; message: string }[] = [];

  const settled = await Promise.allSettled(
    sources.map(async (source) =>
      source.type === 'local' ? loadLocalDocs(source) : loadGithubDocs(source, force),
    ),
  );

  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      docs.push(...outcome.value);
    } else {
      const message = outcome.reason instanceof Error ? outcome.reason.message : '読み込みに失敗しました';
      errors.push({ sourceId: sources[index].id, message });
    }
  });

  const chunks = docs.flatMap(chunkDoc);
  return { sources, docs, chunks, errors, loadedAt: Date.now() };
}

export async function getRegistry(force = false): Promise<Registry> {
  if (!force && registry && Date.now() - registry.loadedAt < CACHE_TTL_MS) return registry;
  registry = await build(force);
  return registry;
}

/** GitHub 側の更新を取り込み直す（/api/support/sync から呼ぶ） */
export async function refreshKnowledge(): Promise<Registry> {
  invalidateSourcesCache();
  invalidateGithubCache();
  registry = null;
  return getRegistry(true);
}

export type SourceStatus = {
  id: string;
  label: string;
  type: 'local' | 'github';
  location: string;
  docCount: number;
  description?: string;
  owner?: string;
  tags?: string[];
  error?: string;
};

/** 画面に出す「いま AI が読めている資料」の一覧 */
export async function listSourceStatus(): Promise<{ sources: SourceStatus[]; loadedAt: number }> {
  const current = await getRegistry();
  const sources = current.sources.map((source) => ({
    id: source.id,
    label: source.label,
    type: source.type,
    location: source.type === 'local' ? source.path : `${source.repo}${source.ref ? `@${source.ref}` : ''}`,
    docCount: current.docs.filter((doc) => doc.sourceId === source.id).length,
    description: source.description,
    owner: source.owner,
    tags: source.tags,
    error: current.errors.find((e) => e.sourceId === source.id)?.message,
  }));
  return { sources, loadedAt: current.loadedAt };
}
