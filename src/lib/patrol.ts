import { listRecords, writeStatuses } from './records';
import { assertSafeUrl } from './urlGuard';
import type { HealthStatus } from './types';

/**
 * 登録ツールの死活監視（要件定義書 §10）。
 * Promise.allSettled で並列 ping、各リクエストに個別タイムアウト、結果は batchUpdate で書き戻す。
 */

const REQUEST_TIMEOUT_MS = 5_000;

export type PatrolResult = {
  id: string;
  system_name: string;
  subcategory: string;
  status: HealthStatus;
  detail: string;
  checkedAt: string;
};

/** ステータス判定：200=🟢 / 接続失敗・タイムアウト・5xx=🔴 / 3xx・401 等=🟡 */
function judge(status: number): { status: HealthStatus; detail: string } {
  if (status >= 200 && status < 300) return { status: 'up', detail: `HTTP ${status}` };
  if (status >= 500) return { status: 'down', detail: `HTTP ${status}` };
  // 3xx（リダイレクト）・401/403（認証必須だが生存はしている）・404 等は要確認
  return { status: 'unknown', detail: `HTTP ${status}` };
}

async function pingOne(url: string): Promise<{ status: HealthStatus; detail: string }> {
  const safe = await assertSafeUrl(url);
  if (!safe.ok) return { status: 'unknown', detail: safe.reason };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(safe.url, {
      method: 'GET',
      redirect: 'manual', // 3xx をそのまま「要確認」として観測する
      signal: controller.signal,
      headers: { 'User-Agent': 'systemcontrol-app/1.0 health-patrol' },
      cache: 'no-store',
    });
    return judge(response.status);
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return { status: 'down', detail: aborted ? 'タイムアウト（5秒）' : '接続失敗' };
  } finally {
    clearTimeout(timer);
  }
}

export async function runPatrol(): Promise<{ checked: number; results: PatrolResult[] }> {
  const records = await listRecords(true);
  const targets = records.filter((record) => record.health_check_url.trim());
  const checkedAt = new Date().toISOString();

  const settled = await Promise.allSettled(targets.map((record) => pingOne(record.health_check_url)));

  const results: PatrolResult[] = targets.map((record, index) => {
    const outcome = settled[index];
    const judged =
      outcome.status === 'fulfilled'
        ? outcome.value
        : { status: 'down' as HealthStatus, detail: '監視処理エラー' };
    return {
      id: record.id,
      system_name: record.system_name,
      subcategory: record.subcategory,
      status: judged.status,
      detail: judged.detail,
      checkedAt,
    };
  });

  await writeStatuses(results.map((r) => ({ id: r.id, status: r.status, checkedAt })));
  return { checked: results.length, results };
}
