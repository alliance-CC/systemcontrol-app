import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect('/');
  const { next } = await searchParams;

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <span className="login-brand__mark" aria-hidden="true">
          🛠
        </span>
        <div>
          <h1 style={{ fontSize: 20 }}>ツール管理システム</h1>
          <p className="muted" style={{ margin: 0 }}>
            社内ツール・アカウント・稼働状況
          </p>
        </div>
      </div>
      <div className="card">
        <LoginForm next={next ?? '/'} />
      </div>
      <p className="subtle" style={{ textAlign: 'center', marginTop: 16 }}>
        ログインできないときは管理者にお問い合わせください。
      </p>
    </div>
  );
}
