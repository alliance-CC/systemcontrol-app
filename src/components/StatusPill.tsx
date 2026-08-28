import { STATUS_ICON, STATUS_LABEL, type HealthStatus } from '@/lib/types';

/**
 * 稼働ステータスの表示（要件定義書 §8 の 🟢🔴🟡⚪）。
 * 色だけに頼らず、アイコンと日本語ラベルを必ず併記する。
 */

export default function StatusPill({
  status,
  size = 'md',
  labelOverride,
}: {
  status: HealthStatus;
  size?: 'md' | 'lg';
  labelOverride?: string;
}) {
  return (
    <span className={`status status--${status}${size === 'lg' ? ' status--lg' : ''}`}>
      <span className="status__icon" aria-hidden="true">
        {STATUS_ICON[status]}
      </span>
      {labelOverride ?? STATUS_LABEL[status]}
    </span>
  );
}
