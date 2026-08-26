import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/session';
import { answerQuestion } from '@/lib/support/answer';

/** 現場サポートモード：質問への回答 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });

  let body: { question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '質問を読み取れませんでした。' }, { status: 400 });
  }

  const question = (body.question ?? '').trim();
  if (!question) return NextResponse.json({ error: '質問を入力してください。' }, { status: 400 });
  if (question.length > 2_000) {
    return NextResponse.json({ error: '質問が長すぎます（2000 文字以内）。' }, { status: 400 });
  }

  try {
    return NextResponse.json(await answerQuestion(question));
  } catch {
    return NextResponse.json({ error: '回答の作成に失敗しました。' }, { status: 500 });
  }
}
