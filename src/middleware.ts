import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';

/**
 * 全ページ・全 API のセッション検証（CLAUDE.md §セキュリティ 4）。
 * 例外は /login と /api/health、および外部スケジューラが叩くトークン保護済みルートのみ。
 */

const PUBLIC_PATHS = new Set(['/login', '/api/login', '/api/health']);
/** トークン（CRON_SECRET）で保護されているため、セッションは要求しない */
const TOKEN_PROTECTED_PATHS = new Set(['/api/patrol', '/api/support/sync']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || TOKEN_PROTECTED_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions());

  if (!session.user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
