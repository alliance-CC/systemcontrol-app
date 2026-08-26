/** 現場サポートモードの型定義 */

/** 参照先（ローカルフォルダ or GitHub リポジトリ） */
export type KnowledgeSource =
  | {
      id: string;
      label: string;
      type: 'local';
      /** リポジトリルートからの相対パス（例: knowledge/tools/受注管理） */
      path: string;
      description?: string;
      owner?: string;
      tags?: string[];
    }
  | {
      id: string;
      label: string;
      type: 'github';
      /** owner/repo 形式 */
      repo: string;
      ref?: string;
      /** 取り込むパス（例: ["README.md", "docs/**"]）。未指定なら全 Markdown */
      include?: string[];
      description?: string;
      owner?: string;
      tags?: string[];
    };

export type KnowledgeDoc = {
  sourceId: string;
  sourceLabel: string;
  /** ソース内のパス */
  path: string;
  title: string;
  content: string;
  /** GitHub ソースなら閲覧 URL */
  url?: string;
};

export type KnowledgeChunk = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  path: string;
  title: string;
  /** 見出しの階層（例: ["使い方", "ログインできないとき"]） */
  headings: string[];
  content: string;
  url?: string;
};

export type Citation = {
  sourceLabel: string;
  path: string;
  heading: string;
  url?: string;
};

export type SupportAnswer = {
  answer: string;
  citations: Citation[];
  /** AI 未設定などで検索結果のみを返した場合 true */
  fallback: boolean;
  /** 資料だけでは解決せず、開発者への依頼を勧める場合 true */
  needsDeveloper: boolean;
  /** 依頼文のタイトル候補 */
  suggestedTitle?: string;
};

export type DevRequestInput = {
  /** 現場の人が書いた困りごと */
  problem: string;
  /** 対象ツール名（任意） */
  tool?: string;
  /** 起きた操作・再現手順（任意） */
  steps?: string;
  /** 緊急度 */
  urgency: '低' | '中' | '高';
  /** 依頼者名 */
  requester: string;
};

export type DevRequestDraft = {
  title: string;
  body: string;
  /** GitHub Issue 起票用のリンク（DEV_REQUEST_REPO 設定時のみ） */
  issueUrl?: string;
  fallback: boolean;
};
