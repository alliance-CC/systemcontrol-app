import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { getCurrentUser } from '@/lib/session';
import { canWrite } from '@/lib/permissions';
import AppNav, { type NavItem } from '@/components/AppNav';
import LogoutButton from '@/components/LogoutButton';

export const metadata: Metadata = {
  title: 'ツール管理システム',
  description: '社内ツール・API・認証情報の一元管理と死活監視、現場サポートモード',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  const navItems: NavItem[] = [
    { href: '/', label: '一覧・検索', icon: '🗂' },
    ...(canWrite(user) ? [{ href: '/new', label: '新規登録', icon: '＋' }] : []),
    { href: '/support', label: '現場サポート', icon: '💬' },
  ];

  return (
    <html lang="ja">
      <body>
        {user && (
          <header className="app-header">
            <div className="app-header__inner">
              <Link href="/" className="brand">
                <span className="brand__mark" aria-hidden="true">
                  🛠
                </span>
                <span className="brand__text">
                  ツール管理システム
                  <span className="brand__sub">社内ツール・アカウント・稼働状況</span>
                </span>
              </Link>

              <AppNav items={navItems} />

              <span className="app-header__spacer" />

              <div className="app-header__user">
                <span className="user-chip" title={`ログイン中: ${user.login_id}`}>
                  <span className="user-chip__avatar" aria-hidden="true">
                    {user.login_id.slice(0, 1)}
                  </span>
                  <span className="user-chip__name">{user.login_id}</span>
                  {!canWrite(user) && <span className="badge">閲覧のみ</span>}
                </span>
                <LogoutButton />
              </div>
            </div>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
