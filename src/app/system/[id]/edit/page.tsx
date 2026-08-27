import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/session';
import { getRecord, listRecords } from '@/lib/records';
import { loadMaster } from '@/lib/master';
import { getFieldSchema } from '@/config/fieldSchemas';
import RecordForm, { type RecordFormInitial } from '@/components/RecordForm';
import type { MasterData } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditRecordPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const record = await getRecord(id);
  if (!record) notFound();

  let master: MasterData = { categories: [], subcategories: [], googleAccounts: [] };
  let systemNames: string[] = [];
  try {
    master = await loadMaster();
    systemNames = [...new Set((await listRecords()).map((item) => item.system_name).filter(Boolean))];
  } catch {
    // マスターが読めなくても自由入力で編集できる
  }

  const schema = getFieldSchema(record.subcategory);
  const secretKeys = new Set(schema.filter((field) => field.secret).map((field) => field.key));

  // 機密項目の値はクライアントへ渡さない
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(record.details)) {
    if (!secretKeys.has(key)) details[key] = value;
  }

  const initial: RecordFormInitial = {
    id: record.id,
    system_name: record.system_name,
    google_account: record.google_account,
    category: record.category,
    subcategory: record.subcategory,
    health_check_url: record.health_check_url,
    details,
    secretKeysWithValue: [...secretKeys].filter((key) => (record.details[key] ?? '') !== ''),
  };

  return (
    <>
      <p className="breadcrumb">
        <Link href="/">一覧・検索</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/system/${record.id}`}>{record.system_name}</Link>
        <span aria-hidden="true">›</span>
        <span>編集</span>
      </p>
      <h1>編集</h1>
      <p className="lead">
        {record.system_name} / {record.subcategory}
      </p>
      <RecordForm master={master} systemNames={systemNames} mode="edit" initial={initial} />
    </>
  );
}
