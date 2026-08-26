import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/session';
import { getRecord, revealSecret } from '@/lib/records';

/**
 * 「クリックして表示」用。機密値は初期表示では送らず、この操作時にだけ復号して返す
 * （要件定義書 §4：漏洩面を狭める）。
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });

  const { id } = await params;
  let body: { key?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '入力内容を読み取れませんでした。' }, { status: 400 });
  }

  const key = (body.key ?? '').trim();
  if (!key) return NextResponse.json({ error: '項目が指定されていません。' }, { status: 400 });

  const record = await getRecord(id);
  if (!record) return NextResponse.json({ error: '見つかりませんでした。' }, { status: 404 });

  try {
    const value = revealSecret(record, key);
    if (value === null) return NextResponse.json({ error: '値が登録されていません。' }, { status: 404 });
    return NextResponse.json({ value });
  } catch {
    return NextResponse.json({ error: '復号に失敗しました。暗号化鍵を確認してください。' }, { status: 500 });
  }
}
