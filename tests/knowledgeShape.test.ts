import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesInclude } from '@/lib/support/github';
import { chunkDoc } from '@/lib/support/knowledge';
import type { KnowledgeDoc } from '@/lib/support/types';

test('include パターンで取り込むファイルを絞れる', () => {
  assert.equal(matchesInclude('README.md', ['README.md']), true);
  assert.equal(matchesInclude('docs/setup.md', ['README.md']), false);

  assert.equal(matchesInclude('docs/setup.md', ['docs/*.md']), true);
  assert.equal(matchesInclude('docs/guide/setup.md', ['docs/*.md']), false);

  assert.equal(matchesInclude('docs/guide/setup.md', ['docs/**/*.md']), true);
  assert.equal(matchesInclude('docs/setup.md', ['docs/**/*.md']), true);
  assert.equal(matchesInclude('src/setup.md', ['docs/**/*.md']), false);

  // 未指定なら全 Markdown が対象
  assert.equal(matchesInclude('any/where.md'), true);
  assert.equal(matchesInclude('any/where.md', []), true);
});

const doc: KnowledgeDoc = {
  sourceId: 'test',
  sourceLabel: 'テスト資料',
  path: 'manual.md',
  title: '請求書ツール',
  content: [
    '# 請求書ツール',
    '',
    '概要の説明。',
    '',
    '## ログインできないとき',
    '',
    '1. パスワードを確認する',
    '',
    '### 管理者に連絡する',
    '',
    '担当者へ連絡してください。',
  ].join('\n'),
};

test('見出し単位で分割し、見出しの階層を保持する', () => {
  const chunks = chunkDoc(doc);
  assert.ok(chunks.length >= 3, `分割数が足りない: ${chunks.length}`);

  const login = chunks.find((chunk) => chunk.headings.at(-1) === 'ログインできないとき');
  assert.ok(login, 'ログインの節が見つからない');
  assert.deepEqual(login.headings, ['請求書ツール', 'ログインできないとき']);
  assert.match(login.content, /パスワードを確認/);

  const nested = chunks.find((chunk) => chunk.headings.at(-1) === '管理者に連絡する');
  assert.ok(nested, '入れ子の見出しが見つからない');
  assert.deepEqual(nested.headings, ['請求書ツール', 'ログインできないとき', '管理者に連絡する']);

  // すべてのチャンクが出典情報を持つ
  for (const chunk of chunks) {
    assert.equal(chunk.sourceLabel, 'テスト資料');
    assert.equal(chunk.path, 'manual.md');
  }
});

test('長い本文は分割され、内容が欠落しない', () => {
  const long = 'あ'.repeat(3_000);
  const chunks = chunkDoc({ ...doc, content: `# 長文\n\n${long}` });
  assert.ok(chunks.length >= 3, `長文が分割されていない: ${chunks.length}`);
  const restored = chunks.map((chunk) => chunk.content).join('');
  assert.equal((restored.match(/あ/g) ?? []).length, 3_000);
});
