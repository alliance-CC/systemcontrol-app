import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { canWrite } from '@/lib/permissions';
import { searchRecords, toSafeRecord } from '@/lib/records';
import StatusPill from '@/components/StatusPill';
import { STATUS_ICON, STATUS_LABEL, type HealthStatus, type SafeToolRecord } from '@/lib/types';

/** システム一覧・統合検索（要件定義書 §6 ②） */

export const dynamic = 'force-dynamic';

type Grouped = {
  systemName: string;
  records: SafeToolRecord[];
  hasDown: boolean;
};

const STATUS_ORDER: HealthStatus[] = ['up', 'down', 'unknown', 'none'];

function groupBySystem(records: SafeToolRecord[]): Grouped[] {
  const map = new Map<string, SafeToolRecord[]>();
  for (const record of records) {
    const key = record.system_name || '（システム名なし）';
    map.set(key, [...(map.get(key) ?? []), record]);
  }
  return [...map.entries()]
    .map(([systemName, items]) => ({
      systemName,
      records: items,
      hasDown: items.some((item) => item.last_status === 'down'),
    }))
    // 対応が必要なものを先頭に出す
    .sort((a, b) =>
      a.hasDown === b.hasDown ? a.systemName.localeCompare(b.systemName, 'ja') : a.hasDown ? -1 : 1,
    );
}

function filterHref(query: string, status?: HealthStatus): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (status) params.set('status', status);
  const search = params.toString();
  return search ? `/?${search}` : '/';
}

function isHealthStatus(value: string | undefined): value is HealthStatus {
  return value === 'up' || value === 'down' || value === 'unknown' || value === 'none';
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireUser();
  const { q, status } = await searchParams;
  const query = q ?? '';
  const statusFilter = isHealthStatus(status) ? status : undefined;

  let all: SafeToolRecord[] = [];
  let loadError = '';

  try {
    all = (await searchRecords(query)).map(toSafeRecord);
  } catch {
    loadError =
      'スプレッドシートからデータを取得できませんでした。環境変数と共有設定（SETUP.md 手順 2・3）を確認してください。';
  }

  const statusTotals = all.reduce<Record<HealthStatus, number>>(
    (acc, record) => ({ ...acc, [record.last_status]: acc[record.last_status] + 1 }),
    { up: 0, down: 0, unknown: 0, none: 0 },
  );

  const visible = statusFilter ? all.filter((record) => record.last_status === statusFilter) : all;
  const groups = groupBySystem(visible);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>システム一覧</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            システム名・Google アカウント・ツール名・追加項目を横断検索します（機密値は検索対象外）。
          </p>
        </div>
        {canWrite(user) && (
          <div className="page-head__actions">
            <Link className="button" href="/new">
              ＋ 新規登録
            </Link>
          </div>
        )}
      </div>

      {loadError && (
        <div className="alert">
          <span className="alert__icon" aria-hidden="true">
            ⚠️
          </span>
          <span className="alert__body">
            <strong>データを表示できません</strong>
            {loadError}
          </span>
        </div>
      )}

      {statusTotals.down > 0 && (
        <div className="alert">
          <span className="alert__icon" aria-hidden="true">
            🔴
          </span>
          <span className="alert__body">
            <strong>{statusTotals.down} 件のツールが停止・エラーになっています</strong>
            <Link href={filterHref(query, 'down')}>該当のツールを表示する</Link>
          </span>
        </div>
      )}

      <div className="stat-grid">
        <Link
          className="stat"
          href={filterHref(query)}
          aria-current={statusFilter === undefined ? 'true' : undefined}
        >
          <span className="stat__label">すべて</span>
          <span className="stat__value">{all.length}</span>
        </Link>
        {STATUS_ORDER.map((key) => (
          <Link
            className={`stat stat--${key}`}
            key={key}
            href={filterHref(query, key)}
            aria-current={statusFilter === key ? 'true' : undefined}
          >
            <span className="stat__label">
              <span aria-hidden="true">{STATUS_ICON[key]}</span>
              {STATUS_LABEL[key]}
            </span>
            <span className="stat__value">{statusTotals[key]}</span>
          </Link>
        ))}
      </div>

      <form className="searchbar" method="get" role="search">
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        <div className="searchbar__input">
          <span className="searchbar__icon" aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="例: 社内ポータル / example@gmail.com / AWS"
            aria-label="統合検索"
          />
        </div>
        <button type="submit">検索</button>
        {(query || statusFilter) && (
          <Link className="button button--ghost" href="/">
            条件をクリア
          </Link>
        )}
      </form>

      <p className="muted" style={{ marginBottom: 18 }}>
        {visible.length} 件を表示
        {query && `（「${query}」で検索）`}
        {statusFilter && `（${STATUS_LABEL[statusFilter]}のみ）`}
      </p>

      {groups.length === 0 && !loadError && (
        <div className="empty">
          <span className="empty__icon" aria-hidden="true">
            {query || statusFilter ? '🔍' : '🗂'}
          </span>
          <p className="empty__title">
            {query || statusFilter ? '該当するデータがありませんでした' : 'まだ登録がありません'}
          </p>
          <p style={{ margin: 0 }}>
            {query || statusFilter ? (
              <Link href="/">条件をクリアしてすべて表示する</Link>
            ) : canWrite(user) ? (
              <Link href="/new">最初のツールを登録する</Link>
            ) : (
              '管理者が登録すると、ここに表示されます。'
            )}
          </p>
        </div>
      )}

      <div className="grid">
        {groups.map((group) => (
          <section className={`syscard${group.hasDown ? ' syscard--alert' : ''}`} key={group.systemName}>
            <div className="syscard__head">
              <div className="syscard__title">
                {group.systemName}
                <span className="syscard__meta" style={{ display: 'block' }}>
                  {group.records.length} 件のツール / アカウント
                </span>
              </div>
              {group.hasDown && <span className="badge badge--down">要対応</span>}
            </div>
            <ul className="syscard__list">
              {group.records.map((record) => (
                <li key={record.id}>
                  <Link className="tool-row" href={`/system/${record.id}`}>
                    <span className="tool-row__dot" title={STATUS_LABEL[record.last_status]}>
                      <span aria-hidden="true">{STATUS_ICON[record.last_status]}</span>
                      <span className="sr-only">{STATUS_LABEL[record.last_status]}</span>
                    </span>
                    <span className="tool-row__body">
                      <span className="tool-row__name">
                        {record.subcategory || record.category || '(未分類)'}
                      </span>
                      <span className="tool-row__sub">
                        {record.google_account || record.category || '—'}
                      </span>
                    </span>
                    <span className="tool-row__chevron" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {!loadError && all.length > 0 && (
        <p className="subtle" style={{ marginTop: 24 }}>
          稼働状況は外部スケジューラからの <code>/api/patrol</code> 実行時に更新されます。
          <StatusPill status="none" /> は監視 URL が未設定のツールです。
        </p>
      )}
    </>
  );
}
