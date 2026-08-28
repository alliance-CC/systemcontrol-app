import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMessage, notifyStatusChanges, pickNotifiable, type StatusChange } from '@/lib/notify';

const base = { system_name: '社内ポータル', subcategory: 'AWS', detail: 'HTTP 500', checkedAt: '2026-08-27T02:00:00.000Z' };

test('down への変化と down からの復旧だけを通知する', () => {
  const changes: StatusChange[] = [
    { ...base, previous: 'up', current: 'down' },
    { ...base, previous: 'unknown', current: 'down' },
    { ...base, previous: 'down', current: 'up' },
    // 通知しないもの
    { ...base, previous: 'up', current: 'up' },
    { ...base, previous: 'down', current: 'down' },
    { ...base, previous: 'up', current: 'unknown' },
    { ...base, previous: 'down', current: 'unknown' },
    { ...base, previous: 'none', current: 'unknown' },
  ];

  const picked = pickNotifiable(changes);
  assert.equal(picked.length, 3);
  assert.equal(picked.filter((change) => change.current === 'down').length, 2);
  assert.equal(picked.filter((change) => change.current === 'up').length, 1);
});

test('通知本文にシステム名とツール名が入る', () => {
  const message = buildMessage([
    { ...base, previous: 'up', current: 'down' },
    { ...base, system_name: '受注管理', subcategory: 'Figma', previous: 'down', current: 'up' },
  ]);

  assert.match(message, /接続できなくなりました/);
  assert.match(message, /社内ポータル \/ AWS/);
  assert.match(message, /復旧しました/);
  assert.match(message, /受注管理 \/ Figma/);
  assert.match(message, /2026-08-27T02:00:00.000Z/);
});

test('変化がなければ送信しない', async () => {
  const result = await notifyStatusChanges([{ ...base, previous: 'up', current: 'up' }]);
  assert.equal(result.sent, false);
  assert.equal(result.count, 0);
});

test('NOTIFY_WEBHOOK_URL 未設定なら送信せず、監視は止めない', async () => {
  const saved = process.env.NOTIFY_WEBHOOK_URL;
  delete process.env.NOTIFY_WEBHOOK_URL;
  try {
    const result = await notifyStatusChanges([{ ...base, previous: 'up', current: 'down' }]);
    assert.equal(result.sent, false);
    assert.match(result.reason ?? '', /未設定/);
    assert.equal(result.count, 1);
  } finally {
    if (saved !== undefined) process.env.NOTIFY_WEBHOOK_URL = saved;
  }
});

test('通知先が内部ネットワーク宛てなら送信しない（SSRF 対策）', async () => {
  const saved = process.env.NOTIFY_WEBHOOK_URL;
  process.env.NOTIFY_WEBHOOK_URL = 'http://169.254.169.254/latest/meta-data/';
  try {
    const result = await notifyStatusChanges([{ ...base, previous: 'up', current: 'down' }]);
    assert.equal(result.sent, false);
    assert.match(result.reason ?? '', /通知先URLが不正/);
  } finally {
    if (saved === undefined) delete process.env.NOTIFY_WEBHOOK_URL;
    else process.env.NOTIFY_WEBHOOK_URL = saved;
  }
});
