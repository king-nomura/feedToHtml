# feedToHtml - Claude Code コンテキスト

## プロジェクト概要
JavaScript/Node.jsで構築されたRSSからHTMLへの変換コマンドラインツール。RSS/Atomフィードをカスタマイズテンプレートと月別グループ化機能付きのHTMLに変換します。

## 技術スタック
- **言語**: JavaScript (Node.js 20+)
- **依存関係**: 外部依存関係を最小限に抑制
  - `fast-xml-parser` RSS/XML解析用
  - ネイティブ Node.js `fetch` HTTP リクエスト用
  - 組み込み `node:test` テスト用
- **対象**: クロスプラットフォーム CLIツール (Linux/macOS/Windows)

## プロジェクト構造
```
feedToHtml/
├── src/
│   ├── models/          # データモデル (RSSFeed, RSSItem, Configuration, OutboxItem等)
│   ├── services/        # コアサービス (RSSパーサ, テンプレートエンジン, ファイル書き込み等)
│   ├── cli/             # コマンドラインインターフェース処理
│   │   ├── main.js      # feedtohtml CLI エントリーポイント
│   │   └── outbox_main.js  # outboxtohtml CLI エントリーポイント (実験的)
│   ├── lib/             # ライブラリ関数
│   ├── test_helpers/    # テストヘルパー関数
│   └── utils/           # ユーティリティ関数
├── tests/
│   ├── contract/        # CLI インターフェース コントラクトテスト
│   ├── integration/     # エンドツーエンド テストシナリオ
│   ├── unit/            # 個別コンポーネント単体テスト
│   └── fixtures/        # テスト用フィクスチャ
└── templates/
    └── template.html    # デフォルト HTML テンプレート
```

## 主要機能

### feedtohtml (メイン機能)
- RSS 2.0 および Atom フィード対応
- 月別グループ化による自動整理
- インクリメンタル更新（既存ファイルに新規記事のみ追加）
- カスタムHTMLテンプレート対応
- 設定ファイルによる柔軟な設定

### outboxtohtml (実験的機能)
- ActivityPub Outbox（Mastodon等）からHTMLへの変換
- ダイレクトメッセージ・センシティブコンテンツの自動フィルタリング

## CLIインターフェース

### feedtohtml
```bash
# 基本使用法
node src/cli/main.js <RSS_URL>

# 出力ディレクトリ指定
node src/cli/main.js <RSS_URL> --output ./public

# ローカルファイルから変換
node src/cli/main.js --file <FILE> --output ./public

# 設定ファイル使用
node src/cli/main.js <RSS_URL> --config <CONFIG_FILE>
```

### outboxtohtml (実験的)
```bash
node src/cli/outbox_main.js <OUTBOX_URL> --output ./public
node src/cli/outbox_main.js --file <FILE> --output ./public
```

## 設定スキーマ
```json
{
  "templatePath": "string (オプション)",
  "timeout": "number (オプション, デフォルト: 60)",
  "outputDir": "string (オプション)",
  "dateFormat": {
    "locale": "string (例: ja-JP)",
    "options": "object (Intl.DateTimeFormat オプション)"
  }
}
```

## テンプレートシステム
- `{{PLACEHOLDER}}` 構文を使用するHTMLテンプレート
- フィードレベル: `{{FEED_TITLE}}`, `{{FEED_DESCRIPTION}}`, `{{FEED_LINK}}`, `{{YEAR_MONTH}}`
- アイテムブロック: `{{#ITEMS}}...{{/ITEMS}}` 内で `{{ITEM_TITLE}}`, `{{ITEM_LINK}}` 等
- 条件付き表示: `{{#ITEM_AUTHOR}}...{{/ITEM_AUTHOR}}`
- ナビゲーション: `{{MONTHLY_NAV}}`, `{{GENERATION_DATE}}`

## エラーハンドリング
構造化された終了コード:
- 0: 成功
- 1: ネットワークエラー
- 2: 解析エラー
- 3: ファイルシステムエラー
- 4: 設定エラー

## 開発ガイドライン
- **テストファースト**: 実装前にテストを記述
- **単一責任**: 各モジュールは明確で集中した目的を持つ
- **エラー耐性**: ネットワーク/解析/ファイルシステムエラーの適切な処理
- **最小依存関係**: Node.js組み込み機能で十分な場合は外部ライブラリを避ける

## テスト実行
```bash
npm test
```

## リポジトリ
https://github.com/king-nomura/feedToHtml
