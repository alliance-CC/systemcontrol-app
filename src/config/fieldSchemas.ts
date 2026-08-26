/**
 * 小項目（ツール種別）ごとの追加項目定義（要件定義書 §3）。
 * 登録フォームの動的生成と、保存時のバリデーション（許可キー判定）の両方に使う。
 * secret: true の項目は AES-256-GCM で暗号化してから details_json に格納する。
 */

export type FieldDef = {
  key: string;
  label: string;
  secret: boolean;
  required?: boolean;
  placeholder?: string;
  multiline?: boolean;
};

export const fieldSchemas: Record<string, readonly FieldDef[]> = {
  AWS: [
    { key: 'account_name', label: 'アカウント名', secret: false, required: true },
    { key: 'account_id', label: 'アカウントID', secret: false },
    { key: 'iam_user', label: 'IAM ユーザー名', secret: false },
    { key: 'account_password', label: 'パスワード', secret: true },
    { key: 'access_key_id', label: 'アクセスキーID', secret: false },
    { key: 'secret_access_key', label: 'シークレットアクセスキー', secret: true },
    { key: 'console_url', label: 'コンソールURL', secret: false },
    { key: 'notes', label: '備考', secret: false, multiline: true },
  ],
  Figma: [
    { key: 'project_name', label: 'プロジェクト名', secret: false, required: true },
    { key: 'project_url', label: 'プロジェクトURL', secret: false },
    { key: 'login_id', label: 'ログインID', secret: false },
    { key: 'project_password', label: 'プロジェクトパスワード', secret: true },
    { key: 'notes', label: '備考', secret: false, multiline: true },
  ],
  GitHub: [
    { key: 'org_name', label: 'Organization 名', secret: false },
    { key: 'repository', label: 'リポジトリ', secret: false },
    { key: 'login_id', label: 'ログインID', secret: false },
    { key: 'account_password', label: 'パスワード', secret: true },
    { key: 'personal_access_token', label: 'アクセストークン', secret: true },
    { key: 'notes', label: '備考', secret: false, multiline: true },
  ],
  Vercel: [
    { key: 'team_name', label: 'チーム名', secret: false },
    { key: 'project_name', label: 'プロジェクト名', secret: false },
    { key: 'login_method', label: 'ログイン方法', secret: false, placeholder: 'GitHub 連携 / メール' },
    { key: 'api_token', label: 'API トークン', secret: true },
    { key: 'notes', label: '備考', secret: false, multiline: true },
  ],
  Slack: [
    { key: 'workspace', label: 'ワークスペース', secret: false, required: true },
    { key: 'workspace_url', label: 'ワークスペースURL', secret: false },
    { key: 'admin_account', label: '管理者アカウント', secret: false },
    { key: 'webhook_url', label: 'Webhook URL', secret: true },
    { key: 'bot_token', label: 'Bot トークン', secret: true },
    { key: 'notes', label: '備考', secret: false, multiline: true },
  ],
  Notion: [
    { key: 'workspace', label: 'ワークスペース', secret: false },
    { key: 'page_url', label: 'ページURL', secret: false },
    { key: 'login_id', label: 'ログインID', secret: false },
    { key: 'account_password', label: 'パスワード', secret: true },
    { key: 'integration_token', label: 'インテグレーショントークン', secret: true },
    { key: 'notes', label: '備考', secret: false, multiline: true },
  ],
  'Google Analytics': [
    { key: 'property_name', label: 'プロパティ名', secret: false },
    { key: 'property_id', label: 'プロパティID', secret: false },
    { key: 'measurement_id', label: '測定ID', secret: false },
    { key: 'notes', label: '備考', secret: false, multiline: true },
  ],
  'Anthropic API': [
    { key: 'organization', label: '組織名', secret: false },
    { key: 'api_key', label: 'API キー', secret: true },
    { key: 'monthly_limit', label: '月次上限', secret: false },
    { key: 'notes', label: '備考', secret: false, multiline: true },
  ],
  'OpenAI API': [
    { key: 'organization', label: '組織名', secret: false },
    { key: 'api_key', label: 'API キー', secret: true },
    { key: 'monthly_limit', label: '月次上限', secret: false },
    { key: 'notes', label: '備考', secret: false, multiline: true },
  ],
};

/** 定義のない小項目に使う汎用スキーマ */
export const defaultFieldSchema: readonly FieldDef[] = [
  { key: 'service_url', label: 'サービスURL', secret: false },
  { key: 'login_id', label: 'ログインID', secret: false },
  { key: 'account_password', label: 'パスワード', secret: true },
  { key: 'api_key', label: 'API キー / トークン', secret: true },
  { key: 'notes', label: '備考', secret: false, multiline: true },
];

export function getFieldSchema(subcategory: string): readonly FieldDef[] {
  return fieldSchemas[subcategory] ?? defaultFieldSchema;
}

/** 許可キー一覧（定義にないキーは拒否する） */
export function allowedKeys(subcategory: string): Set<string> {
  return new Set(getFieldSchema(subcategory).map((f) => f.key));
}

export function isSecretKey(subcategory: string, key: string): boolean {
  return getFieldSchema(subcategory).some((f) => f.key === key && f.secret);
}

/** スキーマが定義済みの小項目一覧（フォームの候補として提示する） */
export function knownSubcategories(): string[] {
  return Object.keys(fieldSchemas);
}
