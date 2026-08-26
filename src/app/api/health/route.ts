import { NextResponse } from 'next/server';
import { ping } from '@/lib/sheets';

/**
 * 外部監視用のヘルスチェック（要件定義書 §9）。
 * 外部公開されるため、詳細なエラー内容は返さず 200 / 500 のみに留める。
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ping();
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
