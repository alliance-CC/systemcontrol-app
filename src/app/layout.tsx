import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getCurrentUser } from '@/lib/session';
import { canWrite } from '@/lib/permissions';
import LogoutButton from '@/components/LogoutButton';

export const metadata: Metadata = {
  title: 'ツール管理システム',
  description: '社内ツール・API・認証情報の一元管理と死活監視、現場サポートモード',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="ja">
      <body>
        {user && (
          <header className="site-header">
            <div className="site-header__inner">
              <Link href="/" className="site-header__brand">
                ツール管理システム
              </Link>
              <nav>
                <Link href="/">一覧・検索</Link>
                {canWrite(user) && <Link href="/new">新規登録</Link>}
                <Link href="/support">現場サポート</Link>
              </nav>
              <span className="site-header__spacer" />
              <span className="site-header__user">
                {user.login_id}
                {!canWrite(user) && <span className="badge" style={{ marginLeft: 6 }}>閲覧のみ</span>}
              </span>
              <LogoutButton />
            </div>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
