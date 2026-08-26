import { env } from './env';
import { readTable } from './sheets';
import { verifyPassword } from './password';
import type { AppUser } from './types';

/** タブ3（users）。パスワードはハッシュのみ保持する */

export async function findUser(loginId: string): Promise<{ user: AppUser; hash: string } | null> {
  const { rows } = await readTable(env.tabs.users);
  const row = rows.find((r) => (r.login_id ?? '').trim() === loginId.trim());
  if (!row) return null;
  const role = row.role === 'viewer' ? 'viewer' : 'admin';
  return {
    user: { login_id: (row.login_id ?? '').trim(), role },
    hash: (row.password_hash ?? '').trim(),
  };
}

/** ログイン ID とパスワードを照合する。成功時のみユーザーを返す */
export async function authenticate(loginId: string, password: string): Promise<AppUser | null> {
  const found = await findUser(loginId);
  if (!found) {
    // ユーザー不在でも存在時と処理時間を揃え、列挙攻撃の手掛かりを減らす
    await verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    return null;
  }
  const ok = await verifyPassword(password, found.hash);
  return ok ? found.user : null;
}
