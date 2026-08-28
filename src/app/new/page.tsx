import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { loadMaster } from '@/lib/master';
import { listRecords } from '@/lib/records';
import RecordForm from '@/components/RecordForm';
import type { MasterData } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewRecordPage() {
  await requireAdmin();

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
      <p className="breadcrumb">
        <Link href="/">一覧・検索</Link>
        <span aria-hidden="true">›</span>
        <span>新規登録</span>
      </p>
      <h1>新規登録</h1>
      <p className="lead">
        ツール・API・アカウントを 1 件登録します。機密項目（パスワード・APIキー等）は保存時に暗号化されます。
      </p>
      {loadError && (
        <div className="alert alert--warn">
          <span className="alert__icon" aria-hidden="true">
            ⚠️
          </span>
          <span className="alert__body">{loadError}</span>
        </div>
      )}
      <RecordForm master={master} systemNames={systemNames} mode="create" />
    </>
  );
}
