import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { getCurrentUser } from '@/lib/session';
import { refreshKnowledge } from '@/lib/support/knowledge';

/**
 * GitHub 側の資料を読み込み直す。
 * ログイン済みユーザー、または CRON_SECRET を持つ外部スケジューラから呼べる。
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function hasToken(request: NextRequest): boolean {
  let expected: string;
  try {
    expected = env.cronSecret;
  } catch {
    return false;
  }
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return bearer === expected || request.nextUrl.searchParams.get('token') === expected;
}

export async function POST(request: NextRequest) {
  const authorized = hasToken(request) || (await getCurrentUser()) !== null;
  if (!authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const registry = await refreshKnowledge();
    return NextResponse.json({
      sources: registry.sources.length,
      documents: registry.docs.length,
      chunks: registry.chunks.length,
      errors: registry.errors,
      loadedAt: new Date(registry.loadedAt).toISOString(),
    });
  } catch {
    return NextResponse.json({ error: '資料の再読み込みに失敗しました。' }, { status: 500 });
  }
}
