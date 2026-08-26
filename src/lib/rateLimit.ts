/**
 * ログイン試行のレート制限（要件定義書 §5 総当たり対策）。
 * サーバーレスではインスタンス間で共有されないが、単純な総当たりには十分効く。
 * 厳密な制限が必要になったら KV / Upstash へ移す。
 */

type Bucket = { count: number; firstAt: number; lockedUntil: number };

const WINDOW_MS = 10 * 60_000; // 10 分
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60_000;

const buckets = new Map<string, Bucket>();

function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.lockedUntil < now && now - bucket.firstAt > WINDOW_MS) buckets.delete(key);
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(key);
  if (bucket && bucket.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.lockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.firstAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAt: now, lockedUntil: 0 });
    return;
  }
  bucket.count += 1;
  if (bucket.count >= MAX_ATTEMPTS) {
    bucket.lockedUntil = now + LOCK_MS;
    bucket.count = 0;
    bucket.firstAt = now;
  }
}

export function recordSuccess(key: string): void {
  buckets.delete(key);
}

/** IP + ログイン ID でキーを作る */
export function rateLimitKey(ip: string, loginId: string): string {
  return `${ip}::${loginId.toLowerCase()}`;
}

export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}
