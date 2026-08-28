import assert from 'node:assert/strict';
import test from 'node:test';
import { getRegistry, listSourceStatus } from '@/lib/support/knowledge';
import { extractTerms, retrieve } from '@/lib/support/retrieve';
import { resolveLocalPath } from '@/lib/support/sources';

test('knowledge/ の資料を読み込める', async () => {
  const registry = await getRegistry(true);
  assert.equal(registry.errors.length, 0);
  assert.ok(registry.docs.length >= 3, `資料が読み込めていない: ${registry.docs.length}`);
  assert.ok(registry.chunks.length >= registry.docs.length);
});

test('資料一覧に登録済みソースが出る', async () => {
  const { sources } = await listSourceStatus();
  const target = sources.find((source) => source.id === 'systemcontrol-app');
  assert.ok(target, 'sources.json のソースが見つからない');
  assert.ok(target.docCount >= 3);
});

test('日本語の質問から検索語を作れる', () => {
  const terms = extractTerms('ログインできない AWS');
  assert.ok(terms.includes('ログ'));
  assert.ok(terms.includes('aws'));
});

test('「ログインできない」でログイン手順の資料が上位に来る', async () => {
  const results = await retrieve('ログインできない', 3);
  assert.ok(results.length > 0, '検索結果が空');
  assert.match(results[0].chunk.path, /ログイン/);
});

test('「パスワードはどこで確認できますか」でパスワードの資料が当たる', async () => {
  const results = await retrieve('パスワードはどこで確認できますか', 3);
  assert.ok(results.some((result) => result.chunk.path.includes('パスワード')));
});

test('knowledge/ の外は参照できない', () => {
  assert.equal(resolveLocalPath('../../etc'), null);
  assert.equal(resolveLocalPath('knowledge/../../etc/passwd'), null);
  assert.ok(resolveLocalPath('knowledge/ツール管理システム')?.endsWith('knowledge/ツール管理システム'));
});
