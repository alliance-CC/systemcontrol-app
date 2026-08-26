import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSearchBlob } from '@/lib/records';

test('search_blob に機密項目の値を含めない', () => {
  const blob = buildSearchBlob({
    system_name: '社内ポータル',
    google_account: 'tool-admin@example.com',
    category: 'ツール',
    subcategory: 'AWS',
    details: {
      account_name: 'prod-admin',
      account_password: 'enc:v1:abcdef',
      secret_access_key: 'enc:v1:zzzz',
      notes: '本番環境用',
    },
  });

  assert.ok(blob.includes('社内ポータル'));
  assert.ok(blob.includes('tool-admin@example.com'));
  assert.ok(blob.includes('prod-admin'));
  assert.ok(blob.includes('本番環境用'));
  assert.ok(!blob.includes('enc:v1'));
});

test('スキーマ外の暗号化済み値も検索対象から外す', () => {
  const blob = buildSearchBlob({
    system_name: 'テスト',
    google_account: '',
    category: 'ツール',
    subcategory: '未定義ツール',
    details: { unknown_secret: 'enc:v1:xxxx', memo: 'ふつうのメモ' },
  });

  assert.ok(blob.includes('ふつうのメモ'));
  assert.ok(!blob.includes('enc:v1'));
});
