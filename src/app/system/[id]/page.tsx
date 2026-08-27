import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { canWrite } from '@/lib/permissions';
import { getRecord, toSafeRecord } from '@/lib/records';
import StatusPill from '@/components/StatusPill';
import SecretValue from '@/components/SecretValue';
import DeleteButton from '@/components/DeleteButton';

/** システム詳細（要件定義書 §6 ③）。URL は表示名ではなく id で引く */

export const dynamic = 'force-dynamic';

export default async function SystemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let record;
  try {
    record = await getRecord(id);
  } catch {
    return (
      <div className="alert">
        <span className="alert__icon" aria-hidden="true">
          ⚠️
        </span>
        <span className="alert__body">
          <strong>データを取得できませんでした</strong>
          環境変数と共有設定（SETUP.md 手順 2・3）を確認してください。
        </span>
      </div>
    );
  }
  if (!record) notFound();

  const safe = toSafeRecord(record);
  const initial = (safe.subcategory || safe.system_name || '?').slice(0, 1);

  return (
    <>
      <p className="breadcrumb">
        <Link href="/">一覧・検索</Link>
        <span aria-hidden="true">›</span>
        <span>{safe.system_name}</span>
      </p>

      <div className="detail-hero">
        <span className="detail-hero__icon" aria-hidden="true">
          {initial}
        </span>
        <div className="detail-hero__body">
          <h1>{safe.system_name}</h1>
          <div className="row">
            {safe.category && <span className="badge">{safe.category}</span>}
            {safe.subcategory && <span className="badge badge--accent">{safe.subcategory}</span>}
            {safe.google_account && <span className="muted">{safe.google_account}</span>}
          </div>
        </div>
        <StatusPill status={safe.last_status} size="lg" />
      </div>

      <div className="card card--flush" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <h2>稼働状況</h2>
        </div>
        <div className="card__body">
          <div className="detail-list">
            <div className="detail-item">
              <span className="detail-item__label">ステータス</span>
              <span className="detail-item__value">
                <StatusPill status={safe.last_status} />
                {safe.last_checked_at && (
                  <span className="muted"> 最終確認: {safe.last_checked_at}</span>
                )}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">ヘルスチェックURL</span>
              <span className="detail-item__value detail-item__value--mono">
                {safe.health_check_url ? (
                  <a href={safe.health_check_url} target="_blank" rel="noreferrer noopener">
                    {safe.health_check_url}
                  </a>
                ) : (
                  <span className="muted">未設定（監視対象外）</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card card--flush">
        <div className="card__head">
          <h2>登録内容</h2>
          <span className="app-header__spacer" />
          <span className="subtle">パスワード等は押したときだけ表示されます</span>
        </div>
        <div className="card__body">
          {safe.details.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              追加項目は登録されていません。
            </p>
          ) : (
            <div className="detail-list">
              {safe.details.map((detail) => (
                <div className="detail-item" key={detail.key}>
                  <span className="detail-item__label">
                    {detail.label}
                    {detail.secret && (
                      <span className="badge" style={{ marginLeft: 6 }}>
                        暗号化
                      </span>
                    )}
                  </span>
                  <span
                    className={`detail-item__value${detail.secret ? '' : ' detail-item__value--mono'}`}
                  >
                    {detail.secret ? (
                      <SecretValue recordId={safe.id} fieldKey={detail.key} hasValue={detail.hasValue} />
                    ) : (
                      detail.value || <span className="muted">—</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="actions">
            {canWrite(user) && (
              <>
                <Link className="button" href={`/system/${safe.id}/edit`}>
                  編集する
                </Link>
                <DeleteButton recordId={safe.id} systemName={safe.system_name} />
              </>
            )}
            <Link
              className="button button--ghost"
              href={`/support?tool=${encodeURIComponent(safe.subcategory)}`}
            >
              💬 このツールについて質問する
            </Link>
          </div>
        </div>
      </div>

      <p className="subtle" style={{ marginTop: 16 }}>
        登録: {safe.created_at || '不明'}（{safe.created_by || '不明'}） / 更新:{' '}
        {safe.updated_at || '不明'}（{safe.updated_by || '不明'}）
      </p>
    </>
  );
}
