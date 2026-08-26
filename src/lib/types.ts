/** アプリ全体で使う型定義 */

export type HealthStatus = 'up' | 'down' | 'unknown' | 'none';

/** タブ2（records）1 行分 */
export type ToolRecord = {
  id: string;
  system_name: string;
  google_account: string;
  category: string;
  subcategory: string;
  details: Record<string, string>;
  health_check_url: string;
  last_status: HealthStatus;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
};

/** 画面へ返す用（機密値はマスク済み） */
export type SafeToolRecord = Omit<ToolRecord, 'details'> & {
  details: { key: string; label: string; value: string; secret: boolean; hasValue: boolean }[];
};

export type MasterData = {
  categories: string[];
  subcategories: string[];
  googleAccounts: string[];
};

export type AppUser = {
  login_id: string;
  role: 'admin' | 'viewer';
};

/** 一覧カード用にシステム単位でまとめたもの */
export type SystemSummary = {
  systemName: string;
  records: SafeToolRecord[];
  statusCounts: Record<HealthStatus, number>;
  hasDown: boolean;
};

export const STATUS_ICON: Record<HealthStatus, string> = {
  up: '🟢',
  down: '🔴',
  unknown: '🟡',
  none: '⚪',
};

export const STATUS_LABEL: Record<HealthStatus, string> = {
  up: '稼働中',
  down: 'エラー / 停止',
  unknown: '要確認',
  none: '監視対象外',
};
