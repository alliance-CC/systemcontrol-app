import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { canWrite } from '@/lib/permissions';
import { searchRecords, toSafeRecord } from '@/lib/records';
import StatusPill from '@/components/StatusPill';
import StatusMenu, { buildStatusMenu } from '@/components/StatusMenu';
import ToolDeck from '@/components/ToolDeck';
import { STATUS_ICON, STATUS_LABEL, type HealthStatus, type SafeToolRecord } from '@/lib/types';

/** システム一覧・統合検索（要件定義書 §6 ②）。既定はカード送り、切り替えで一覧 */

export const dynamic = 'force-dynamic';

type ViewMode = 'card' | 'list';

type Grouped = {
  systemName: string;
  records: SafeToolRecord[];
  hasDown: boolean;
};

/** カードで先に出す順（対応が必要なものから） */
const DECK_PRIORITY: Record<HealthStatus, number> = { down: 0, unknown: 1, up: 2, none: 3 };

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

function sortForDeck(records: SafeToolRecord[]): SafeToolRecord[] {
  return [...records].sort((a, b) => {
    const priority = DECK_PRIORITY[a.last_status] - DECK_PRIORITY[b.last_status];
    if (priority !== 0) return priority;
    const bySystem = a.system_name.localeCompare(b.system_name, 'ja');
    return bySystem !== 0 ? bySystem : a.subcategory.localeCompare(b.subcategory, 'ja');
  });
}

function hrefWith(params: { query: string; status?: HealthStatus; view: ViewMode }): string {
  const search = new URLSearchParams();
  if (params.query) search.set('q', params.query);
  if (params.status) search.set('status', params.status);
  if (params.view === 'list') search.set('view', 'list');
  const qs = search.toString();
  return qs ? `/?${qs}` : '/';
}

function isHealthStatus(value: string | undefined): value is HealthStatus {
  return value === 'up' || value === 'down' || value === 'unknown' || value === 'none';
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string }>;
}) {
  const user = await requireUser();
  const { q, status, view } = await searchParams;
  const query = q ?? '';
  const statusFilter = isHealthStatus(status) ? status : undefined;
  const viewMode: ViewMode = view === 'list' ? 'list' : 'card';

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
  const deckRecords = sortForDeck(visible);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>システム一覧</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            システム名・Google アカウント・ツール名・追加項目を横断検索します（機密値は検索対象外）。
          </p>
        </div>
        <div className="page-head__actions">
          <StatusMenu
            items={buildStatusMenu(statusTotals, all.length, (target) =>
              hrefWith({ query, status: target, view: viewMode }),
            )}
            current={statusFilter}
          />
          {canWrite(user) && (
            <Link className="button" href="/new">
              ＋ 新規登録
            </Link>
          )}
        </div>
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

      <form className="searchbar" method="get" role="search">
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        {viewMode === 'list' && <input type="hidden" name="view" value="list" />}
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
          <Link className="button button--ghost" href={hrefWith({ query: '', view: viewMode })}>
            条件をクリア
          </Link>
        )}
      </form>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <p className="muted" style={{ margin: 0 }}>
          {visible.length} 件を表示
          {query && `（「${query}」で検索）`}
          {statusFilter && `（${STATUS_LABEL[statusFilter]}のみ）`}
        </p>
        <nav className="view-switch" aria-label="表示の切り替え">
          <Link
            href={hrefWith({ query, status: statusFilter, view: 'card' })}
            aria-current={viewMode === 'card' ? 'true' : undefined}
          >
            カード
          </Link>
          <Link
            href={hrefWith({ query, status: statusFilter, view: 'list' })}
            aria-current={viewMode === 'list' ? 'true' : undefined}
          >
            一覧
          </Link>
        </nav>
      </div>

      {visible.length === 0 && !loadError && (
        <div className="empty">
          <span className="empty__icon" aria-hidden="true">
            {query || statusFilter ? '🔍' : '🗂'}
          </span>
          <p className="empty__title">
            {query || statusFilter ? '該当するデータがありませんでした' : 'まだ登録がありません'}
          </p>
          <p style={{ margin: 0 }}>
            {query || statusFilter ? (
              <Link href={hrefWith({ query: '', view: viewMode })}>条件をクリアしてすべて表示する</Link>
            ) : canWrite(user) ? (
              <Link href="/new">最初のツールを登録する</Link>
            ) : (
              '管理者が登録すると、ここに表示されます。'
            )}
          </p>
        </div>
      )}

      {viewMode === 'card' ? (
        <ToolDeck key={`${query}|${statusFilter ?? ''}|${deckRecords.length}`} records={deckRecords} />
      ) : (
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
      )}

      {!loadError && all.length > 0 && (
        <p className="subtle" style={{ marginTop: 24 }}>
          稼働状況は外部スケジューラからの <code>/api/patrol</code> 実行時に更新されます。
          <StatusPill status="none" /> は監視 URL が未設定のツールです。
        </p>
      )}
    </>
  );
}
