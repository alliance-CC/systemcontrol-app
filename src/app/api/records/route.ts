import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/session';
import { createRecord, searchRecords, toSafeRecord, validateRecord, type RecordInput } from '@/lib/records';
import { addMasterEntry } from '@/lib/master';

export const dynamic = 'force-dynamic';

function parseInput(body: Record<string, unknown>): RecordInput {
  const details = (body.details ?? {}) as Record<string, unknown>;
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(details)) {
    const text = value == null ? '' : String(value).trim();
    if (text) normalized[key] = text;
  }
  return {
    system_name: String(body.system_name ?? ''),
    google_account: String(body.google_account ?? ''),
    category: String(body.category ?? ''),
    subcategory: String(body.subcategory ?? ''),
    details: normalized,
    health_check_url: String(body.health_check_url ?? ''),
  };
}

export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });

  const query = request.nextUrl.searchParams.get('q') ?? '';
  try {
    const records = await searchRecords(query);
    return NextResponse.json({ records: records.map(toSafeRecord) });
  } catch {
    return NextResponse.json({ error: 'データの取得に失敗しました。' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '入力内容を読み取れませんでした。' }, { status: 400 });
  }

  const input = parseInput(body);
  const validation = await validateRecord(input);
  if (!validation.ok) return NextResponse.json({ errors: validation.errors }, { status: 400 });

  try {
    const record = await createRecord(input, user.login_id);
    // 新しい選択肢はマスターへ追記して次回以降のプルダウンに出す
    await addMasterEntry({
      category: input.category,
      subcategory: input.subcategory,
      google_account: input.google_account,
    });
    return NextResponse.json({ id: record.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '登録に失敗しました。' }, { status: 500 });
  }
}
