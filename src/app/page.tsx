import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { canWrite } from '@/lib/permissions';
import { searchRecords, toSafeRecord } from '@/lib/records';
import { STATUS_ICON, STATUS_LABEL, type HealthStatus, type SafeToolRecord } from '@/lib/types';

/** システム一覧・統合検索（要件定義書 §6 ②） */

export const dynamic = 'force-dynamic';

type Grouped = {
  systemName: string;
  records: SafeToolRecord[];
  hasDown: boolean;
};

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
    .sort((a, b) => a.systemName.localeCompare(b.systemName, 'ja'));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = q ?? '';

  let groups: Grouped[] = [];
  let loadError = '';
  let total = 0;

  try {
    const records = (await searchRecords(query)).map(toSafeRecord);
    total = records.length;
    groups = groupBySystem(records);
  } catch {
    loadError =
      'スプレッドシートからデータを取得できませんでした。環境変数と共有設定（SETUP.md 手順 2・3）を確認してください。';
  }

  const statusTotals = groups
    .flatMap((group) => group.records)
    .reduce<Record<HealthStatus, number>>(
      (acc, record) => ({ ...acc, [record.last_status]: acc[record.last_status] + 1 }),
      { up: 0, down: 0, unknown: 0, none: 0 },
    );

  return (
    <>
      <h1>システム一覧</h1>
      <p className="lead">
        システム名・Google アカウント・ツール名・追加項目を横断検索します（機密値は検索対象外）。
      </p>

      {loadError && <div className="alert">{loadError}</div>}

      <form className="search-bar" method="get">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="例: 社内ポータル / example@gmail.com / AWS"
          aria-label="統合検索"
        />
        <button type="submit">検索</button>
        {query && (
          <Link className="button button--ghost" href="/">
            クリア
          </Link>
        )}
      </form>

      <p className="muted">
        {total} 件 / {STATUS_ICON.up} {statusTotals.up} ・ {STATUS_ICON.down} {statusTotals.down} ・{' '}
        {STATUS_ICON.unknown} {statusTotals.unknown} ・ {STATUS_ICON.none} {statusTotals.none}
      </p>

      {groups.length === 0 && !loadError && (
        <p className="empty">
          {query ? '該当するデータがありませんでした。' : 'まだ登録がありません。'}
          {canWrite(user) && (
            <>
              <br />
              <Link href="/new">新規登録はこちら</Link>
            </>
          )}
        </p>
      )}

      <div className="grid">
        {groups.map((group) => (
          <section className="card" key={group.systemName}>
            <div className="card__title">
              <span>{group.systemName}</span>
              {group.hasDown && <span className="badge badge--down">要対応</span>}
            </div>
            <div className="card__meta">{group.records.length} 件のツール / アカウント</div>
            <div style={{ marginTop: 10 }}>
              {group.records.map((record) => (
                <div className="tool-row" key={record.id}>
                  <span title={STATUS_LABEL[record.last_status]}>{STATUS_ICON[record.last_status]}</span>
                  <span className="tool-row__name">
                    <Link href={`/system/${record.id}`}>
                      {record.subcategory || record.category || '(未分類)'}
                    </Link>
                    {record.google_account && (
                      <span className="card__meta"> / {record.google_account}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
