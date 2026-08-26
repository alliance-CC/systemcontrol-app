import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from './env';
import type { AppUser } from './types';

/** iron-session による署名付き HTTP-only Cookie（要件定義書 §5） */

export type SessionData = {
  user?: AppUser;
};

export function sessionOptions(): SessionOptions {
  return {
    password: env.sessionSecret,
    cookieName: 'sysctl_session',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 時間
      path: '/',
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions());
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getSession();
  return session.user ?? null;
}

/** ページ用：未認証なら /login へリダイレクト */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** API 用：未認証なら null を返す（呼び出し側で 401） */
export async function requireApiUser(): Promise<AppUser | null> {
  return getCurrentUser();
}
