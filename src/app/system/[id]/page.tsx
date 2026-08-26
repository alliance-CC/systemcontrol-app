import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getRecord, toSafeRecord } from '@/lib/records';
import { STATUS_ICON, STATUS_LABEL } from '@/lib/types';
import SecretValue from '@/components/SecretValue';
import DeleteButton from '@/components/DeleteButton';

/** システム詳細（要件定義書 §6 ③）。URL は表示名ではなく id で引く */

export const dynamic = 'force-dynamic';

export default async function SystemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  let record;
  try {
    record = await getRecord(id);
  } catch {
    return <div className="alert">データを取得できませんでした。設定を確認してください。</div>;
  }
  if (!record) notFound();

  const safe = toSafeRecord(record);

  return (
    <>
      <p className="muted">
        <Link href="/">← 一覧へ戻る</Link>
      </p>
      <h1>{safe.system_name}</h1>
      <p className="lead">
        {safe.category} / {safe.subcategory}
        {safe.google_account ? ` / ${safe.google_account}` : ''}
      </p>

      <div className="card">
        <div className="detail-list">
          <div className="detail-item">
            <span className="detail-item__label">稼働ステータス</span>
            <span className="detail-item__value">
              {STATUS_ICON[safe.last_status]} {STATUS_LABEL[safe.last_status]}
              {safe.last_checked_at && (
                <span className="card__meta">（最終確認: {safe.last_checked_at}）</span>
              )}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-item__label">ヘルスチェックURL</span>
            <span className="detail-item__value">
              {safe.health_check_url ? (
                <a href={safe.health_check_url} target="_blank" rel="noreferrer noopener">
                  {safe.health_check_url}
                </a>
              ) : (
                '未設定（監視対象外）'
              )}
            </span>
          </div>

          {safe.details.map((detail) => (
            <div className="detail-item" key={detail.key}>
              <span className="detail-item__label">{detail.label}</span>
              <span className="detail-item__value">
                {detail.secret ? (
                  <SecretValue recordId={safe.id} fieldKey={detail.key} />
                ) : (
                  detail.value
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="actions">
          <Link className="button" href={`/system/${safe.id}/edit`}>
            編集する
          </Link>
          <DeleteButton recordId={safe.id} systemName={safe.system_name} />
          <Link className="button button--ghost" href={`/support?tool=${encodeURIComponent(safe.subcategory)}`}>
            このツールについて質問する
          </Link>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 16 }}>
        登録: {safe.created_at || '不明'}（{safe.created_by || '不明'}） / 更新: {safe.updated_at || '不明'}（
        {safe.updated_by || '不明'}）
      </p>
    </>
  );
}
