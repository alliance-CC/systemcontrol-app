import { lookup } from 'node:dns/promises';
import net from 'node:net';

/**
 * ヘルスチェック URL の SSRF 対策（要件定義書 §10）。
 * スキームは http/https 限定、プライベート IP 帯・ループバック・メタデータ IP をブロックする。
 */

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local（クラウドのメタデータ 169.254.169.254 を含む）
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // マルチキャスト / 予約
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
  if (normalized.startsWith('fe80')) return true; // link-local
  if (normalized.startsWith('::ffff:')) return isPrivateIPv4(normalized.slice(7));
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** 監視前に呼ぶ。DNS 解決結果まで見てプライベート宛てを弾く */
export async function assertSafeUrl(raw: string): Promise<UrlCheck> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'URL の形式が不正です。' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'http / https 以外のスキームは監視できません。' };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) {
    return { ok: false, reason: 'ローカルホスト宛ての URL は監視できません。' };
  }

  if (net.isIP(hostname)) {
    return isBlockedAddress(hostname)
      ? { ok: false, reason: 'プライベート IP 宛ての URL は監視できません。' }
      : { ok: true, url };
  }

  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return { ok: false, reason: 'ホスト名を解決できませんでした。' };
    if (addresses.some((address) => isBlockedAddress(address.address))) {
      return { ok: false, reason: '内部ネットワークを指す URL は監視できません。' };
    }
  } catch {
    return { ok: false, reason: 'ホスト名を解決できませんでした。' };
  }

  return { ok: true, url };
}
