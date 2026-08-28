import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeUrl, isBlockedAddress } from '@/lib/urlGuard';

test('プライベート IP / ループバック / メタデータ IP をブロックする', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '169.254.169.254', '::1', 'fd00::1']) {
    assert.equal(isBlockedAddress(ip), true, `${ip} はブロックされるべき`);
  }
});

test('グローバル IP は許可する', () => {
  for (const ip of ['8.8.8.8', '93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']) {
    assert.equal(isBlockedAddress(ip), false, `${ip} は許可されるべき`);
  }
});

test('http / https 以外のスキームを拒否する', async () => {
  for (const url of ['file:///etc/passwd', 'ftp://example.com', 'gopher://example.com']) {
    const result = await assertSafeUrl(url);
    assert.equal(result.ok, false);
  }
});

test('localhost とプライベート IP の URL を拒否する', async () => {
  for (const url of ['http://localhost:3000/health', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/']) {
    const result = await assertSafeUrl(url);
    assert.equal(result.ok, false);
  }
});

test('URL でない文字列を拒否する', async () => {
  const result = await assertSafeUrl('これはURLではない');
  assert.equal(result.ok, false);
});
