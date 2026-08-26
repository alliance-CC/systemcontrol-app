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
      <h1>ログイン</h1>
      <p className="lead">社内ツール管理システム</p>
      <div className="card">
        <LoginForm next={next ?? '/'} />
      </div>
    </div>
  );
}
