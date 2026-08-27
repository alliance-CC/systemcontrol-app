import assert from 'node:assert/strict';
import test from 'node:test';
import { canRevealSecret, canWrite } from '@/lib/permissions';

test('admin だけが登録・編集・削除できる', () => {
  assert.equal(canWrite({ role: 'admin' }), true);
  assert.equal(canWrite({ role: 'viewer' }), false);
  assert.equal(canWrite(null), false);
  assert.equal(canWrite(undefined), false);
});

test('閲覧権限があれば機密値を表示できる', () => {
  assert.equal(canRevealSecret({ role: 'admin' }), true);
  assert.equal(canRevealSecret({ role: 'viewer' }), true);
  assert.equal(canRevealSecret(null), false);
});
