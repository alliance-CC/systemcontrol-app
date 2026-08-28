import assert from 'node:assert/strict';
import test from 'node:test';
import { decrypt, encrypt, encryptIfNeeded, isEncrypted } from '@/lib/crypto';

// テスト用の鍵（本番の鍵は環境変数で管理する）
process.env.ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString('base64');

test('暗号化した値は enc:v1: 形式になる', () => {
  const cipher = encrypt('p@ssw0rd');
  assert.ok(cipher.startsWith('enc:v1:'));
  assert.ok(isEncrypted(cipher));
  assert.ok(!isEncrypted('p@ssw0rd'));
});

test('日本語・記号を含む値を復号できる', () => {
  const plain = 'パスワード-#$%&-2026';
  assert.equal(decrypt(encrypt(plain)), plain);
});

test('同じ平文でも毎回異なる暗号文になる（IV がランダム）', () => {
  assert.notEqual(encrypt('same'), encrypt('same'));
});

test('暗号化されていない値はそのまま返す', () => {
  assert.equal(decrypt('plain-value'), 'plain-value');
});

test('二重暗号化しない', () => {
  const once = encrypt('secret');
  assert.equal(encryptIfNeeded(once), once);
  assert.equal(decrypt(encryptIfNeeded(once)), 'secret');
});

test('改ざんされた暗号文は復号に失敗する（GCM の認証タグ）', () => {
  const cipher = encrypt('secret');
  const payload = Buffer.from(cipher.slice('enc:v1:'.length), 'base64');
  payload[payload.length - 1] ^= 0xff;
  const tampered = `enc:v1:${payload.toString('base64')}`;
  assert.throws(() => decrypt(tampered));
});
