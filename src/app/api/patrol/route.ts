import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { runPatrol } from '@/lib/patrol';

/**
 * 死活監視ジョブ（要件定義書 §10）。
 * 外部スケジューラ（UptimeRobot 等）から 5〜10 分間隔で叩く。
 * Authorization: Bearer <CRON_SECRET> または ?token=<CRON_SECRET> で保護する。
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  let expected: string;
  try {
    expected = env.cronSecret;
  } catch {
    return false; // CRON_SECRET 未設定なら常に拒否（無防備な公開を避ける）
  }
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const queryToken = request.nextUrl.searchParams.get('token') ?? '';
  return bearer === expected || queryToken === expected;
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const { checked, results } = await runPatrol();
    const down = results.filter((result) => result.status === 'down').length;
    return NextResponse.json({ checked, down, checkedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: 'patrol failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
