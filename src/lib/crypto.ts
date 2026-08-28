import crypto from 'node:crypto';
import { env } from './env';

/**
 * 保管する認証情報の暗号化（要件定義書 §3・§4）。
 * 形式は `enc:v1:<base64>`。base64 の中身は iv(12) + authTag(16) + ciphertext。
 * プレフィックスで「暗号化済みか」「鍵バージョン」を判別する。
 */

const PREFIX = 'enc:';
const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = env.encryptionKey;
  // base64（openssl rand -base64 32）を基本とし、hex / 生 32 文字も受け付ける
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
    if (key.length !== 32) key = Buffer.from(raw, 'utf8');
  }
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY は 32 バイトである必要があります（openssl rand -base64 32）。');
  }
  cachedKey = key;
  return key;
}

/** 値が暗号化済みか */
export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${PREFIX}${VERSION}:`);
}

/** 平文 → `enc:v1:<base64>` */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${VERSION}:${Buffer.concat([iv, tag, encrypted]).toString('base64')}`;
}

/** `enc:v1:<base64>` → 平文。暗号化されていない値はそのまま返す */
export function decrypt(value: string): string {
  if (!isEncrypted(value)) return value;
  const payload = Buffer.from(value.slice(`${PREFIX}${VERSION}:`.length), 'base64');
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** 既に暗号化済みなら二重暗号化しない */
export function encryptIfNeeded(value: string): string {
  return isEncrypted(value) ? value : encrypt(value);
}
