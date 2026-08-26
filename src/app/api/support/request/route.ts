import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/session';
import { draftDevRequest } from '@/lib/support/devRequest';
import type { DevRequestInput } from '@/lib/support/types';

/** 現場サポートモード：開発者への依頼文を作成する */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const URGENCIES = new Set(['低', '中', '高']);

export async function POST(request: NextRequest) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '入力内容を読み取れませんでした。' }, { status: 400 });
  }

  const problem = String(body.problem ?? '').trim();
  if (!problem) return NextResponse.json({ error: '困っている内容を入力してください。' }, { status: 400 });

  const rawUrgency = String(body.urgency ?? '中');
  const input: DevRequestInput = {
    problem: problem.slice(0, 4_000),
    tool: String(body.tool ?? '').trim() || undefined,
    steps: String(body.steps ?? '').trim().slice(0, 4_000) || undefined,
    urgency: (URGENCIES.has(rawUrgency) ? rawUrgency : '中') as DevRequestInput['urgency'],
    requester: String(body.requester ?? '').trim() || user.login_id,
  };

  try {
    return NextResponse.json(await draftDevRequest(input));
  } catch {
    return NextResponse.json({ error: '依頼文の作成に失敗しました。' }, { status: 500 });
  }
}
