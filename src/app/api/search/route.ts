import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/session';
import { searchRecords, toSafeRecord } from '@/lib/records';

/** 統合検索・逆引き検索（要件定義書 §8）。キャッシュ + search_blob 経由 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });

  const query = request.nextUrl.searchParams.get('q') ?? '';
  try {
    const records = await searchRecords(query);
    return NextResponse.json({ query, count: records.length, records: records.map(toSafeRecord) });
  } catch {
    return NextResponse.json({ error: '検索に失敗しました。' }, { status: 500 });
  }
}
