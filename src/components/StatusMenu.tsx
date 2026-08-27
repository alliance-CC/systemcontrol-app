import Link from 'next/link';
import { STATUS_ICON, STATUS_LABEL, type HealthStatus } from '@/lib/types';

/**
 * 状態別の絞り込み。画面を広く使うため、一覧の上には出さず
 * 右上のアイコンに載せる（カーソルを合わせる／フォーカスで縦に開く）。
 */

export type StatusMenuItem = {
  status?: HealthStatus;
  label: string;
  icon: string;
  count: number;
  href: string;
};

export function buildStatusMenu(
  totals: Record<HealthStatus, number>,
  total: number,
  hrefFor: (status?: HealthStatus) => string,
): StatusMenuItem[] {
  const order: HealthStatus[] = ['down', 'unknown', 'up', 'none'];
  return [
    { label: 'すべて', icon: '🗂', count: total, href: hrefFor() },
    ...order.map((status) => ({
      status,
      label: STATUS_LABEL[status],
      icon: STATUS_ICON[status],
      count: totals[status],
      href: hrefFor(status),
    })),
  ];
}

export default function StatusMenu({
  items,
  current,
}: {
  items: StatusMenuItem[];
  current?: HealthStatus;
}) {
  const active = items.find((item) => item.status === current) ?? items[0];

  return (
    <div className="status-menu">
      <button
        type="button"
        className="status-menu__button"
        aria-haspopup="true"
        title={`状態でしぼり込む（いま: ${active.label}）`}
      >
        <span aria-hidden="true">{active.icon}</span>
        <span className="sr-only">状態でしぼり込む（いま: {active.label}）</span>
        <span className="status-menu__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      <ul className="status-menu__list">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              className="status-menu__item"
              href={item.href}
              aria-current={item.status === current || (!item.status && !current) ? 'true' : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span className="status-menu__label">{item.label}</span>
              <span className="status-menu__count">{item.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
