# ツール管理システム

社内で利用しているツール・API・プロジェクトの認証情報を一元管理する Web アプリケーション。
あわせて、登録した各ツールの死活監視と、管理システム自体の稼働監視を行う。
さらに、**プログラムがわからない現場スタッフ向けの「現場サポートモード」**（社内資料をもとにした質問応答と、
開発者への依頼文作成）を備える。

> **本システムは実質的に認証情報（シークレット）の集約先です。**
> 機密情報の暗号化・アクセス制御・監査を最優先とします。

## 主な機能

| 機能 | 内容 |
|---|---|
| 一元管理 | システム × ツール × Google アカウント単位で認証情報を登録・編集・削除 |
| 暗号化保管 | パスワード・API キーは AES-256-GCM で暗号化し、`enc:v1:` 形式で保管 |
| 統合検索・逆引き | システム名・アカウント・ツール名・追加項目を横断検索（機密値は検索対象外） |
| 死活監視 | 登録ツールを定期 ping し、🟢🔴🟡⚪ で一覧表示（外部スケジューラから起動） |
| 稼働監視 | `/api/health` で管理システム自体の生存を外部監視 |
| **現場サポートモード** | 社内資料（`knowledge/` と GitHub リポジトリ）を根拠に現場の質問へ回答し、開発者への依頼文を作成 |

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| フロント / バックエンド | Next.js (App Router) / TypeScript |
| データストア | Google スプレッドシート (Google Sheets API) |
| 認証セッション | iron-session（署名付き HTTP-only Cookie） |
| ステータス保存 | スプレッドシート書き戻し（`last_status` / `last_checked_at`） |
| 定期実行 | 外部スケジューラ（UptimeRobot 等）から API ルートを叩く |
| 現場サポートの回答生成 | Claude API（未設定時は資料検索にフォールバック） |
| ホスティング | Vercel（Hobby プラン） |

## ドキュメント

| ファイル | 内容 |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | 実装方針・セキュリティ必須ルール・ビルド順 |
| [`ツール管理システム_要件定義書_v3.md`](./ツール管理システム_要件定義書_v3.md) | 詳細仕様 |
| [`SETUP.md`](./SETUP.md) | 人間側の事前セットアップ手順（Google Cloud / スプレッドシート / 環境変数） |
| [`docs/FIELD_SUPPORT.md`](./docs/FIELD_SUPPORT.md) | 現場サポートモードの仕様・資料の置き方・運用 |
| [`knowledge/README.md`](./knowledge/README.md) | 現場向け：ツールの資料を追加する手順 |

## セットアップ

事前に [`SETUP.md`](./SETUP.md) の手順（Google Cloud プロジェクト、サービスアカウント、
スプレッドシートの作成・共有、シークレットの生成）を完了させてください。

```bash
npm install
cp .env.example .env   # SETUP.md で用意した値を記入する
npm run dev
```

`.env` は**絶対にコミットしない**でください（`.gitignore` 済み）。

初回ログイン用のユーザーは、ハッシュを生成してスプレッドシートの `users` タブに追加します。

```bash
npm run hash-password          # 対話形式でパスワードを入力 → password_hash が出力される
```

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` / `npm start` | 本番ビルド / 起動 |
| `npm run typecheck` | 型チェック |
| `npm test` | 暗号化・SSRF 対策・検索の単体テスト |
| `npm run hash-password` | `users` タブ用の password_hash 生成 |
| `npm run knowledge:check` | 現場サポートモードが読める資料の確認（`npm run knowledge:check -- 'ログインできない'`） |

## ディレクトリ構成

```
src/
├── app/                    画面と API ルート（App Router）
│   ├── page.tsx            一覧・統合検索
│   ├── new/                新規登録
│   ├── system/[id]/        詳細・編集（URL は表示名ではなく id）
│   ├── support/            現場サポートモード
│   └── api/                health / login / records / search / patrol / support
├── components/             クライアントコンポーネント
├── config/fieldSchemas.ts  ツール種別ごとの追加項目定義（フォーム生成 + バリデーション）
├── lib/                    Sheets・暗号化・セッション・監視などの実装
│   └── support/            現場サポートモード（資料読み込み・検索・回答・依頼文）
└── middleware.ts           全ルートのセッション検証

knowledge/                  現場サポートモードが読む資料（ツールごとのフォルダ + sources.json）
scripts/                    パスワードハッシュ生成・資料チェック
tests/                      単体テスト
```

## 定期実行の設定

死活監視と資料の再取得は外部スケジューラから叩きます（Vercel Cron は使いません）。

```
GET  https://<デプロイURL>/api/patrol        Authorization: Bearer <CRON_SECRET>   5〜10分間隔
GET  https://<デプロイURL>/api/health                                              5分間隔（稼働監視）
POST https://<デプロイURL>/api/support/sync  Authorization: Bearer <CRON_SECRET>   任意（資料の再取得）
```
