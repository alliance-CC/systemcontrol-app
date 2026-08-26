# SETUP.md — 事前セットアップ手順（人間が実施）

Claude Code はアプリのコードと `.env.example` までは作れるが、**クラウド上の設定や本物のシークレットは用意できない**。以下は人間が行う作業。CLAUDE.md はこれらを完了済みとして扱う。

順番の目安：1〜2（Google 側）→ 3（スプレッドシート）→ 4（鍵の生成）→ 5（Vercel）→ 6（スケジューラ）。6 はフェーズ5の実装後でよい。

---

## 1. Google Cloud プロジェクトと Sheets API

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成（既存でも可）。
2. 「API とサービス」→「ライブラリ」で **Google Sheets API** を有効化する。

## 2. サービスアカウントと鍵

1. 「IAM と管理」→「サービスアカウント」→ 新規作成。
2. 作成したサービスアカウントの「キー」タブ →「鍵を追加」→ **JSON** を選択し、鍵ファイルをダウンロード。
3. JSON 内の `client_email`（= サービスアカウントのメール）と `private_key` を後で環境変数に使う。**この JSON はリポジトリに置かない。**

## 3. スプレッドシートの作成・共有

1. 新しい Google スプレッドシートを作成。
2. 以下の3タブを作り、**1行目にヘッダー**を入れる（列名は CLAUDE.md / 仕様書 §3 と一致させる）。

   - **タブ1 `master`**：`category` / `subcategory` / `google_account`
   - **タブ2 `records`**：`id` / `system_name` / `google_account` / `category` / `subcategory` / `details_json` / `health_check_url` / `last_status` / `last_checked_at` / `search_blob` / `created_at` / `updated_at` / `created_by` / `updated_by`
   - **タブ3 `users`**：`login_id` / `password_hash` / `role` / `created_at`

3. スプレッドシート右上の「共有」から、**手順2のサービスアカウントのメールを「編集者」で追加**する。人間アカウント以外はこのサービスアカウントのみに絞る。
4. URL の `/d/` と `/edit` の間にある **スプレッドシート ID** を控える。
5. **初期ユーザー**：`users` タブは当面ヘッダーのみでよい。ログインパスワードは平文で入れず、フェーズ2実装後にハッシュ生成用の簡易スクリプト（bcrypt/argon2）で `password_hash` を作って1行追加する（Claude Code にスクリプト作成を依頼できる）。

## 4. シークレットの生成

ターミナルで以下を実行して値を生成（例）。

```bash
# 暗号化鍵（AES-256-GCM 用、32バイト）
openssl rand -base64 32
# セッションシークレット（iron-session 用、32文字以上）
openssl rand -base64 32
# スケジューラ用トークン
openssl rand -hex 32
```

## 5. 環境変数（ローカル `.env` と Vercel の両方）

`.env` はコミットしない（`.env.example` のみコミット）。Vercel では「Project → Settings → Environment Variables」に設定する。

| 変数名 | 内容 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | サービスアカウントの `client_email` |
| `GOOGLE_PRIVATE_KEY` | サービスアカウントの `private_key`（下記の注意参照） |
| `GOOGLE_SHEET_ID` | 手順3で控えたスプレッドシート ID |
| `ENCRYPTION_KEY` | 手順4の暗号化鍵 |
| `SESSION_SECRET` | 手順4のセッションシークレット |
| `CRON_SECRET` | 手順4のスケジューラ用トークン（`/api/patrol` 保護用） |

> **`GOOGLE_PRIVATE_KEY` の注意**：JSON 内の private_key は改行を含む。環境変数に入れる際は改行を `\n` にエスケープして1行で格納し、コード側で `.replace(/\\n/g, '\n')` して使うのが定番。

### Vercel の学習利用オプトアウト（重要）

本システムは認証情報を扱うため、Vercel アカウント設定で**送信コンテンツのモデル学習利用をオプトアウト**し、現行の利用規約・データ処理条件を確認しておく。

## 6. 外部スケジューラ（UptimeRobot 等）

死活監視は Vercel Cron を使わず外部から叩く。フェーズ5の実装後に設定する。

1. UptimeRobot 等で監視を1つ作成し、URL を `https://<デプロイURL>/api/patrol` に設定。
2. 実行間隔を **5〜10分**に設定。
3. リクエストヘッダーに `Authorization: Bearer <CRON_SECRET>`（実装に合わせる）を付け、無認可の呼び出しを弾けるようにする。
4. あわせて `/api/health` も別監視として登録すると、システム自体の稼働監視（仕様書 §9）になる。IP 制限を敷く場合は監視元からの到達を許可する。
