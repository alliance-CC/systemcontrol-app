import type { AppUser } from './types';

/**
 * 権限分離（要件定義書 §5）。
 * admin：登録・編集・削除ができる
 * viewer：閲覧と検索、現場サポートモードのみ
 *
 * 判定はここに集約し、API・画面の両方から同じ関数を使う。
 */

/** 登録・編集・削除ができるか */
export function canWrite(user: Pick<AppUser, 'role'> | null | undefined): boolean {
  return user?.role === 'admin';
}

/** 機密値を「クリックして表示」できるか（v1 は閲覧権限があれば可） */
export function canRevealSecret(user: Pick<AppUser, 'role'> | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'viewer';
}

export const WRITE_DENIED_MESSAGE = '閲覧のみの権限（viewer）のため、この操作はできません。管理者に依頼してください。';
