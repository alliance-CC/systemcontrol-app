'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** ヘッダーのナビゲーション。現在地をはっきり出す（現場が迷わないため） */

export type NavItem = { href: string; label: string; icon: string };

export default function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? '/';

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/' || pathname.startsWith('/system');
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="nav" aria-label="メインメニュー">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="nav__link"
          aria-current={isActive(item.href) ? 'page' : undefined}
        >
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
