import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { KNOWLEDGE_ROOT, resolveLocalPath } from './sources';
import type { KnowledgeDoc, KnowledgeSource } from './types';

/** knowledge/ 配下のフォルダから Markdown / テキストを読み込む */

const READABLE_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.mdx']);
const MAX_FILE_BYTES = 200_000;
const MAX_FILES_PER_SOURCE = 200;

async function walk(dir: string, base: string, collected: string[]): Promise<void> {
  if (collected.length >= MAX_FILES_PER_SOURCE) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (collected.length >= MAX_FILES_PER_SOURCE) return;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, base, collected);
    } else if (READABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      collected.push(path.relative(base, full));
    }
  }
}

function titleOf(content: string, relativePath: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  return heading?.[1].trim() || path.basename(relativePath, path.extname(relativePath));
}

export async function loadLocalDocs(source: Extract<KnowledgeSource, { type: 'local' }>): Promise<KnowledgeDoc[]> {
  const root = resolveLocalPath(source.path);
  if (!root) return [];
  try {
    const info = await stat(root);
    if (!info.isDirectory()) return [];
  } catch {
    return [];
  }

  const files: string[] = [];
  await walk(root, root, files);

  const docs: KnowledgeDoc[] = [];
  for (const relative of files) {
    const full = path.join(root, relative);
    try {
      const info = await stat(full);
      if (info.size > MAX_FILE_BYTES) continue;
      const content = await readFile(full, 'utf8');
      docs.push({
        sourceId: source.id,
        sourceLabel: source.label,
        path: relative.split(path.sep).join('/'),
        title: titleOf(content, relative),
        content,
      });
    } catch {
      continue;
    }
  }
  return docs;
}

/** sources.json に載っていない knowledge/ 直下のフォルダも自動で拾う */
export async function discoverLocalSources(registered: KnowledgeSource[]): Promise<KnowledgeSource[]> {
  const registeredPaths = new Set(
    registered
      .filter((source) => source.type === 'local')
      .map((source) => resolveLocalPath(source.path))
      .filter((resolved): resolved is string => resolved !== null),
  );

  let entries;
  try {
    entries = await readdir(KNOWLEDGE_ROOT, { withFileTypes: true });
  } catch {
    return [];
  }

  const discovered: KnowledgeSource[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const full = path.join(KNOWLEDGE_ROOT, entry.name);
    if (registeredPaths.has(full)) continue;
    discovered.push({
      id: `local:${entry.name}`,
      label: entry.name,
      type: 'local',
      path: `knowledge/${entry.name}`,
      description: 'knowledge/ 直下から自動検出したフォルダ',
    });
  }
  return discovered;
}
