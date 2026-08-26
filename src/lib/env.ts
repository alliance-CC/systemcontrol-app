/**
 * 環境変数の読み込み。
 * シークレットはすべてここ経由で取得し、コードに直書きしない（CLAUDE.md §セキュリティ 3）。
 */

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

/** 必須の環境変数。未設定なら例外（呼び出し側で 500 に変換する） */
export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。SETUP.md を参照してください。`);
  }
  return value;
}

export const env = {
  get googleServiceAccountEmail() {
    return required('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  },
  /** private_key は \n エスケープされた 1 行で格納されるため復元する（SETUP.md §5） */
  get googlePrivateKey() {
    return required('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  },
  get sheetId() {
    return required('GOOGLE_SHEET_ID');
  },
  get encryptionKey() {
    return required('ENCRYPTION_KEY');
  },
  get sessionSecret() {
    return required('SESSION_SECRET');
  },
  get cronSecret() {
    return required('CRON_SECRET');
  },
  tabs: {
    get master() {
      return optional('SHEET_TAB_MASTER', 'master');
    },
    get records() {
      return optional('SHEET_TAB_RECORDS', 'records');
    },
    get users() {
      return optional('SHEET_TAB_USERS', 'users');
    },
  },
  support: {
    get anthropicApiKey() {
      return optional('ANTHROPIC_API_KEY');
    },
    get anthropicModel() {
      return optional('ANTHROPIC_MODEL', 'claude-sonnet-5');
    },
    get githubToken() {
      return optional('GITHUB_TOKEN');
    },
    get devRequestRepo() {
      return optional('DEV_REQUEST_REPO');
    },
    get devRequestContact() {
      return optional('DEV_REQUEST_CONTACT', '開発担当者');
    },
  },
} as const;

/** AI 機能が使えるか（未設定でもキーワード検索にフォールバックする） */
export function isAiEnabled(): boolean {
  return env.support.anthropicApiKey.length > 0;
}
