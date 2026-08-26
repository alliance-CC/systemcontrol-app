import { requireUser } from '@/lib/session';
import { loadMaster } from '@/lib/master';
import { listRecords } from '@/lib/records';
import RecordForm from '@/components/RecordForm';
import type { MasterData } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewRecordPage() {
  await requireUser();

  let master: MasterData = { categories: [], subcategories: [], googleAccounts: [] };
  let systemNames: string[] = [];
  let loadError = '';
  try {
    master = await loadMaster();
    systemNames = [...new Set((await listRecords()).map((record) => record.system_name).filter(Boolean))];
  } catch {
    loadError = 'マスターデータを読み込めませんでした。選択肢なしで入力できます。';
  }

  return (
    <>
      <h1>新規登録</h1>
      <p className="lead">機密項目（パスワード・APIキー等）は保存時に暗号化されます。</p>
      {loadError && <div className="alert alert--info">{loadError}</div>}
      <RecordForm master={master} systemNames={systemNames} mode="create" />
    </>
  );
}
