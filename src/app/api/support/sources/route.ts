import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/session';
import { listSourceStatus } from '@/lib/support/knowledge';
import { isAiEnabled } from '@/lib/env';

/** AI がいま読める資料の一覧 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });

  try {
    const status = await listSourceStatus();
    return NextResponse.json({ ...status, aiEnabled: isAiEnabled() });
  } catch {
    return NextResponse.json({ error: '資料一覧の取得に失敗しました。' }, { status: 500 });
  }
}
