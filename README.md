# ツール管理システム

社内で利用しているツール・API・プロジェクトの認証情報を一元管理する Web アプリケーション。
あわせて、登録した各ツールの死活監視と、管理システム自体の稼働監視を行う。

> **本システムは実質的に認証情報（シークレット）の集約先です。**
> 機密情報の暗号化・アクセス制御・監査を最優先とします。

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| フロント / バックエンド | Next.js (App Router) / TypeScript |
| データストア | Google スプレッドシート (Google Sheets API) |
| 認証セッション | iron-session（署名付き HTTP-only Cookie） |
| ステータス保存 | スプレッドシート書き戻し（`last_status` / `last_checked_at`） |
| 定期実行 | 外部スケジューラ（UptimeRobot 等）から API ルートを叩く |
| ホスティング | Vercel（Hobby プラン） |

## ドキュメント

| ファイル | 内容 |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | 実装方針・セキュリティ必須ルール・ビルド順 |
| [`ツール管理システム_要件定義書_v3.md`](./ツール管理システム_要件定義書_v3.md) | 詳細仕様 |
| [`SETUP.md`](./SETUP.md) | 人間側の事前セットアップ手順（Google Cloud / スプレッドシート / 環境変数） |

## セットアップ

事前に [`SETUP.md`](./SETUP.md) の手順（Google Cloud プロジェクト、サービスアカウント、
スプレッドシートの作成・共有、シークレットの生成）を完了させてください。

```bash
npm install
cp .env.example .env   # SETUP.md で用意した値を記入する
npm run dev
```

`.env` は**絶対にコミットしない**でください（`.gitignore` 済み）。
