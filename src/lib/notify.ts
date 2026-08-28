import { assertSafeUrl } from './urlGuard';
import { STATUS_ICON, STATUS_LABEL, type HealthStatus } from './types';

/**
 * ツールの状態が変化したときの Webhook 通知（要件定義書 §9・§10 の通知連動）。
 *
 * - 送信先は環境変数 `NOTIFY_WEBHOOK_URL`（Slack / Discord の Incoming Webhook を想定）
 * - Slack は `text`、Discord は `content` を読むため、両方のキーを入れて送る
 * - 通知に失敗しても監視ジョブ自体は止めない（記録・表示が本体のため）
 * - 機密値は一切含めない。送るのはシステム名・ツール名・ステータスまで
 */

const REQUEST_TIMEOUT_MS = 5_000;

export type StatusChange = {
  system_name: string;
  subcategory: string;
  previous: HealthStatus;
  current: HealthStatus;
  detail: string;
  checkedAt: string;
};

/** 通知する状態変化だけを抜き出す（down への遷移と、down からの復旧） */
export function pickNotifiable(changes: StatusChange[]): StatusChange[] {
  return changes.filter(
    (change) =>
      change.previous !== change.current &&
      (change.current === 'down' || (change.previous === 'down' && change.current === 'up')),
  );
}

/** 通知本文。現場の人が読んで分かる日本語にする */
export function buildMessage(changes: StatusChange[]): string {
  const down = changes.filter((change) => change.current === 'down');
  const recovered = changes.filter((change) => change.current === 'up');

  const lines: string[] = [];
  if (down.length > 0) {
    lines.push(`${STATUS_ICON.down} ツールに接続できなくなりました（${down.length} 件）`);
    for (const change of down) {
      lines.push(`・${change.system_name} / ${change.subcategory}：${change.detail}`);
    }
  }
  if (recovered.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(`${STATUS_ICON.up} 復旧しました（${recovered.length} 件）`);
    for (const change of recovered) {
      lines.push(`・${change.system_name} / ${change.subcategory}：${STATUS_LABEL.up}`);
    }
  }
  lines.push('', `確認時刻: ${changes[0]?.checkedAt ?? new Date().toISOString()}`);
  return lines.join('\n');
}

export type NotifyResult = { sent: boolean; reason?: string; count: number };

export async function notifyStatusChanges(changes: StatusChange[]): Promise<NotifyResult> {
  const targets = pickNotifiable(changes);
  if (targets.length === 0) return { sent: false, reason: '通知対象の変化なし', count: 0 };

  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL?.trim();
  if (!webhookUrl) return { sent: false, reason: 'NOTIFY_WEBHOOK_URL 未設定', count: targets.length };

  // 送信先は管理者が設定する値だが、設定ミスで内部宛てに飛ばさないよう検証する
  const safe = await assertSafeUrl(webhookUrl);
  if (!safe.ok) return { sent: false, reason: `通知先URLが不正: ${safe.reason}`, count: targets.length };

  const message = buildMessage(targets);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(safe.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, content: message }),
      signal: controller.signal,
      cache: 'no-store',
    });
    return response.ok
      ? { sent: true, count: targets.length }
      : { sent: false, reason: `Webhook ${response.status}`, count: targets.length };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return { sent: false, reason: aborted ? '通知タイムアウト' : '通知の送信に失敗', count: targets.length };
  } finally {
    clearTimeout(timer);
  }
}
