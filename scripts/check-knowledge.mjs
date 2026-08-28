#!/usr/bin/env node
/**
 * 現場サポートモードの資料が正しく読めるか、ローカルで確認する。
 *
 *   node scripts/check-knowledge.mjs
 *   node scripts/check-knowledge.mjs 'ログインできない'   # 検索も試す
 *
 * GitHub ソースは GITHUB_TOKEN があれば読み込みます（無い場合は public のみ）。
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { argv, cwd, exit } from 'node:process';

const KNOWLEDGE = path.join(cwd(), 'knowledge');
const READABLE = /\.(md|markdown|mdx|txt)$/i;

async function walk(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else if (READABLE.test(entry.name)) found.push(full);
  }
  return found;
}

async function main() {
  try {
    await stat(KNOWLEDGE);
  } catch {
    console.error('knowledge/ フォルダがありません。');
    exit(1);
  }

  let sources = [];
  try {
    const raw = await readFile(path.join(KNOWLEDGE, 'sources.json'), 'utf8');
    sources = JSON.parse(raw).sources ?? [];
    console.log(`sources.json: ${sources.length} 件の参照先を登録`);
    for (const source of sources) {
      const where = source.type === 'local' ? source.path : `${source.repo}@${source.ref ?? 'HEAD'}`;
      console.log(`  - [${source.type}] ${source.label} (${where})`);
    }
  } catch (error) {
    console.log(`sources.json を読めませんでした: ${error.message}`);
  }

  const files = await walk(KNOWLEDGE);
  console.log(`\nローカル資料: ${files.length} ファイル`);
  for (const file of files) console.log(`  - ${path.relative(cwd(), file)}`);

  const query = argv[2];
  if (!query) return;

  console.log(`\n「${query}」を含むファイル:`);
  let hit = 0;
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (content.includes(query)) {
      hit++;
      console.log(`  - ${path.relative(cwd(), file)}`);
    }
  }
  if (hit === 0) console.log('  （該当なし。資料に現場の言葉が入っているか確認してください）');
}

main().catch((error) => {
  console.error(error.message);
  exit(1);
});
