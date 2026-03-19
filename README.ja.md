# CC Inspector

> 🌐 他の言語で読む：[English](README.md) | [简体中文](README.zh.md) | [日本語](README.ja.md)

CC Inspector は、Claude Code API リクエストを監視・記録するための開発者向けツールです。プロキシを通じて `/v1/messages` リクエストをインターセプトし、詳細なリクエスト/レスポンスデータを記録し、リアルタイム可視化ダッシュボードを提供します。

## インストール

### npm 経由でインストール（推奨）

```bash
npm install -g claude-code-inspector
```

### ソースコードからインストール

```bash
git clone https://github.com/devtalker/claude-code-inspector.git
cd claude-code-inspector
npm install
```

## 機能

- **リクエストプロキシ**：Claude Code API リクエストをインターセプトし、アップストリームサーバーに転送
- **リアルタイムログ**：すべてのリクエストヘッダー、ボディ、レスポンス、ストリーミングイベントを記録
- **ダッシュボード**：リクエストステータス、トークン使用量、レイテンシ、コストを可視化
- **WebSocket プッシュ**：新しいリクエストと更新をフロントエンドにリアルタイムプッシュ
- **データ永続化**：すべてのリクエストログを SQLite に保存
- **エクスポート機能**：リクエストデータを JSON または CSV 形式でエクスポート
- **トークン統計**：入力/出力トークンとキャッシュ使用量を自動計算
- **コスト見積もり**：モデル価格に基づいてリクエストあたりのコストを計算

## 技術スタック

- **フレームワーク**：Next.js 16 + React 19
- **言語**：TypeScript
- **データベース**：SQLite (better-sqlite3)
- **WebSocket**：ws
- **スタイリング**：Tailwind CSS 4
- **テスト**：Vitest

## クイックスタート

### 方法 1: npm パッケージを使用（推奨）

インストール後、`cc-inspector` コマンドでサービスを起動します：

```bash
# サービスを起動
cc-inspector
```

起動後にアクセス：
- **ダッシュボード**：http://localhost:3000/dashboard
- **ホーム**：http://localhost:3000

### 方法 2: ソースコードから実行

**要件：**
- Node.js 18+
- npm / yarn / pnpm

**依存関係のインストール：**

```bash
npm install
```

**開発サーバーの起動：**

```bash
npm run dev
```

アクセス：
- **ダッシュボード**：http://localhost:3000/dashboard
- **ホーム**：http://localhost:3000

### 環境変数の設定

CC Inspector は、リクエストを転送する LLM サービスプロバイダーを知る必要があります。2 つの設定方法があります：

**方法 1: Claude Code グローバル設定で設定（npm パッケージユーザーに推奨）**

`~/.claude/settings.json` を編集：

```json
{
  "env": {
    "UPSTREAM_BASE_URL": "https://api.anthropic.com",
    "UPSTREAM_API_KEY": "your-api-key"
  }
}
```

**方法 2: `.env.local` ファイルを作成（ソースコード実行ユーザー向け）**

```bash
# .env.local
UPSTREAM_BASE_URL=https://api.anthropic.com  # アップストリーム API ベース URL
UPSTREAM_API_KEY=your-api-key                 # アップストリーム API キー
```

> 注意：`UPSTREAM_BASE_URL` が設定されていない場合、プログラムは自動的に `ANTHROPIC_BASE_URL` の値を使用します。

### Claude Code のプロキシ設定

CC Inspector を起動した後、Claude Code が Anthropic API に直接送信する代わりに、プロキシサーバーにリクエストを送信するように設定する必要があります。

Claude Code で以下のコマンドを実行して baseURL を設定：

```bash
/mcp set anthropic_base_url http://localhost:3000/api/proxy
```

または、`~/.claude/settings.json` を手動で編集：

```json
{
  "anthropic_base_url": "http://localhost:3000/api/proxy"
}
```

設定後、Claude Code からのすべての API リクエストは CC Inspector を経由し、その後アップストリーム API に転送されます。

**設定の確認：**

1. CC Inspector を起動：`cc-inspector` または `npm run dev`
2. ダッシュボードにアクセス：http://localhost:3000/dashboard
3. Claude Code で任意のリクエストを実行
4. ダッシュボードに新しいリクエストレコードが表示されるはずです

## プロジェクト構成

```
claude-code-inspector/
├── app/                       # Next.js App Router
│   ├── dashboard/            # 監視ダッシュボードページ
│   ├── api/                  # API ルート
│   │   ├── proxy/           # プロキシエンドポイント
│   │   ├── requests/        # リクエストログ API
│   │   └── events/          # SSE イベント API
│   └── v1/messages/         # 元のメッセージエンドポイント
├── lib/                      # コアロジックライブラリ
│   ├── proxy/               # プロキシフォワーダー
│   │   ├── handlers.ts      # リクエストハンドラー
│   │   ├── forwarder.ts     # フォワーダー
│   │   └── ws-server.ts     # WebSocket サーバー
│   └── recorder/            # データレコーダー
│       ├── index.ts         # レコーダーエントリー
│       ├── store.ts         # SQLite ストレージ
│       └── schema.ts        # データベーススキーマ
├── components/              # React コンポーネント
│   ├── JsonViewer.tsx      # JSON ビューワー
│   └── JsonModal.tsx       # JSON モーダル
├── db/                      # SQLite データベースファイル
└── server.ts               # カスタムサーバー（WebSocket + Next.js）
```

## API エンドポイント

| エンドポイント | メソッド | 説明 |
|--------------|--------|------|
| `/api/proxy` | POST | リクエストをプロキシし、アップストリームに転送 |
| `/api/requests` | GET | 最近のリクエストログを取得 |
| `/api/requests/:id` | GET | 単一リクエストの詳細を取得 |
| `/api/requests/export` | GET | リクエストデータをエクスポート（JSON/CSV） |
| `/api/events` | GET | SSE イベントストリーム |
| `/api/ws` | WebSocket | リアルタイムプッシュ接続 |

## データモデル

リクエストログには以下のフィールドが含まれます：

- `id`: 一意のリクエスト識別子
- `session_id`: セッション識別子
- `endpoint`: リクエストエンドポイント
- `method`: HTTP メソッド
- `request_headers/body`: リクエストヘッダーとボディ
- `response_status/body/headers`: レスポンスステータス、ボディ、ヘッダー
- `streaming_events`: SSE ストリーミングイベント
- `input_tokens/output_tokens`: 入力/出力トークン
- `cache_read_tokens/cache_creation_tokens`: キャッシュ読み取り/作成トークン
- `latency_ms`: リクエストレイテンシ（ミリ秒）
- `first_token_ms`: 初回トークン時間（ミリ秒）
- `model`: 使用されたモデル
- `cost_usd`: 推定コスト（USD）
- `error_message`: エラーメッセージ（ある場合）

## スクリプト

**ソースコード実行ユーザー：**

```bash
# 開発
npm run dev          # 開発サーバーを起動

# ビルドと実行
npm run build        # 本番バージョンをビルド
npm run start        # 本番サーバーを起動

# テストとチェック
npm run test         # テストを実行
npm run lint         # ESLint チェック
```

**npm パッケージユーザー：**

```bash
cc-inspector         # サービスを起動
```

## データベース

データは `db/inspector.sqlite` に保存され、以下のテーブルを含みます：

- `request_logs`: リクエストログテーブル
- `settings`: 設定テーブル

## 注意事項

1. **WebSocket**：本番環境では `wss://` 接続を使用してください
2. **プロキシモード**：Claude Code がプロキシエンドポイントを使用するように設定されていることを確認してください
3. **トークン計算**：コスト見積もりは公式価格に基づく参考値です

## 開発

### テストの実行

```bash
npm run test
```

### デバッグ

サーバーログはすべてのリクエストと WebSocket 接続情報を出力します。コンソール出力を確認するか、`db/inspector.sqlite` を使用してデータベースを直接クエリしてください。

## ライセンス

MIT
