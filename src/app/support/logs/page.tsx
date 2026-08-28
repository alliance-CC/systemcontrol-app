import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { loadLogSummary, SUPPORT_LOG_COLUMNS } from '@/lib/support/log';

/**
 * 質問ログ（管理者のみ）。
 * 見たいのは「答えられなかった質問」＝次に書くべき資料のリスト。
 */

export const dynamic = 'force-dynamic';

export default async function SupportLogsPage() {
  await requireAdmin();
  const summary = await loadLogSummary();

  return (
    <>
      <p className="breadcrumb">
        <Link href="/support">現場サポート</Link>
        <span aria-hidden="true">›</span>
        <span>質問ログ</span>
      </p>
      <h1>質問ログ</h1>
      <p className="lead">
        現場から届いた質問の記録です。<strong>資料に当たらなかった質問</strong>が、次に書くべき資料の候補になります。
        質問文には機密が書かれている可能性があるため、この画面は管理者だけが開けます。
      </p>

      {summary === null ? (
        <div className="alert alert--warn">
          <span className="alert__icon" aria-hidden="true">
            ⚠️
          </span>
          <span className="alert__body">
            <strong>質問ログのタブが見つかりません</strong>
            スプレッドシートに <code>support_logs</code> タブを作り、1 行目に次の見出しを入れてください（順番どおり）。
            <br />
            <code>{SUPPORT_LOG_COLUMNS.join(' / ')}</code>
            <br />
            タブが無い間は記録されないだけで、現場サポート自体は通常どおり動きます。
          </span>
        </div>
      ) : summary.total === 0 ? (
        <div className="empty">
          <span className="empty__icon" aria-hidden="true">
            📝
          </span>
          <p className="empty__title">まだ質問がありません</p>
          <p style={{ margin: 0 }}>
            現場サポートで質問されると、ここに溜まっていきます。
          </p>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 18 }}>
            記録された質問 {summary.total} 件 / 未解決 {summary.unresolved.length} 種類
          </p>

          <div className="card card--flush" style={{ marginBottom: 16 }}>
            <div className="card__head">
              <h2>資料に当たらなかった質問</h2>
              <span className="app-header__spacer" />
              <span className="subtle">多い順。ここから資料の見出しを作ると効きます</span>
            </div>
            <div className="card__body">
              {summary.unresolved.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  未解決の質問はありません。
                </p>
              ) : (
                <ol className="loglist">
                  {summary.unresolved.map((item) => (
                    <li className="loglist__item" key={item.question}>
                      <span className="loglist__count">{item.count}</span>
                      <span className="loglist__body">
                        <span className="loglist__question">{item.question}</span>
                        <span className="loglist__meta">最終: {item.lastAskedAt || '不明'}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="card card--flush" style={{ marginBottom: 16 }}>
            <div className="card__head">
              <h2>資料で答えられた質問</h2>
            </div>
            <div className="card__body">
              {summary.resolved.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  まだありません。
                </p>
              ) : (
                <ol className="loglist">
                  {summary.resolved.slice(0, 20).map((item) => (
                    <li className="loglist__item" key={item.question}>
                      <span className="loglist__count loglist__count--ok">{item.count}</span>
                      <span className="loglist__body">
                        <span className="loglist__question">{item.question}</span>
                        <span className="loglist__meta">最終: {item.lastAskedAt || '不明'}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="card card--flush">
            <div className="card__head">
              <h2>最近の質問</h2>
            </div>
            <div className="card__body" style={{ overflowX: 'auto' }}>
              <table className="logtable">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>ユーザー</th>
                    <th>質問</th>
                    <th>資料</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent.map((entry, index) => (
                    <tr key={`${entry.askedAt}-${index}`}>
                      <td className="logtable__when">{entry.askedAt || '—'}</td>
                      <td>{entry.loginId || '—'}</td>
                      <td>{entry.question}</td>
                      <td>
                        {entry.hit ? (
                          <span className="badge">{entry.citations} 件</span>
                        ) : (
                          <span className="badge badge--down">なし</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <p className="subtle" style={{ marginTop: 18 }}>
        記録しているのは、日時・ログインID・質問文・資料に当たったか だけです（回答本文は保存していません）。
        資料の書き方は <code>docs/FAQ_テンプレート.md</code> を参照してください。
      </p>
    </>
  );
}
