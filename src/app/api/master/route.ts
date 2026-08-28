import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/session';
import { loadMaster } from '@/lib/master';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
  try {
    return NextResponse.json(await loadMaster());
  } catch {
    return NextResponse.json({ error: 'マスターデータの取得に失敗しました。' }, { status: 500 });
  }
}
