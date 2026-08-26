import { NextResponse, type NextRequest } from 'next/server';
import { authenticate } from '@/lib/users';
import { getSession } from '@/lib/session';
import { checkRateLimit, clientIp, rateLimitKey, recordFailure, recordSuccess } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { login_id?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '入力内容を読み取れませんでした。' }, { status: 400 });
  }

  const loginId = (body.login_id ?? '').trim();
  const password = body.password ?? '';
  if (!loginId || !password) {
    return NextResponse.json({ error: 'ログインIDとパスワードを入力してください。' }, { status: 400 });
  }

  const key = rateLimitKey(clientIp(request.headers), loginId);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `試行回数が多すぎます。${Math.ceil(limit.retryAfterSec / 60)} 分後に再度お試しください。` },
      { status: 429 },
    );
  }

  try {
    const user = await authenticate(loginId, password);
    if (!user) {
      recordFailure(key);
      // ID の存在有無を区別しないメッセージにする
      return NextResponse.json({ error: 'ログインIDまたはパスワードが違います。' }, { status: 401 });
    }

    recordSuccess(key);
    const session = await getSession();
    session.user = user;
    await session.save();
    return NextResponse.json({ ok: true, user });
  } catch {
    return NextResponse.json(
      { error: 'ログイン処理に失敗しました。設定を管理者に確認してください。' },
      { status: 500 },
    );
  }
}
