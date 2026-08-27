import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/session';
import { canWrite, WRITE_DENIED_MESSAGE } from '@/lib/permissions';
import { getRecord, removeRecord, toSafeRecord, updateRecord, validateRecord, type RecordInput } from '@/lib/records';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

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
    clearSecretKeys: Array.isArray(body.clear_secret_keys)
      ? body.clear_secret_keys.map((key) => String(key))
      : [],
  };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });

  const { id } = await params;
  const record = await getRecord(id);
  if (!record) return NextResponse.json({ error: '見つかりませんでした。' }, { status: 404 });
  return NextResponse.json({ record: toSafeRecord(record) });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: WRITE_DENIED_MESSAGE }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '入力内容を読み取れませんでした。' }, { status: 400 });
  }

  const input = parseInput(body);
  const validation = await validateRecord(input, id);
  if (!validation.ok) return NextResponse.json({ errors: validation.errors }, { status: 400 });

  try {
    const updated = await updateRecord(id, input, user.login_id);
    if (!updated) return NextResponse.json({ error: '見つかりませんでした。' }, { status: 404 });
    return NextResponse.json({ id: updated.id });
  } catch {
    return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: WRITE_DENIED_MESSAGE }, { status: 403 });

  const { id } = await params;
  try {
    const removed = await removeRecord(id);
    if (!removed) return NextResponse.json({ error: '見つかりませんでした。' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '削除に失敗しました。' }, { status: 500 });
  }
}
