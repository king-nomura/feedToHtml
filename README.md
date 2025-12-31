# feedToHtml

RSSフィードをHTMLに変換するコマンドラインツールです。RSS 2.0およびAtomフィードに対応し、カスタマイズ可能なHTMLテンプレートとページネーション機能を提供します。

## 特徴

- **軽量**: 最小限の依存関係でNode.js 20+で動作
- **フレキシブル**: カスタムHTMLテンプレートに対応
- **月別グループ化**: 記事を公開月ごとに自動整理
- **インクリメンタル更新**: 既存ファイルには新しい記事のみ追加
- **自動化対応**: cronジョブでの定期実行に最適
- **クロスプラットフォーム**: Linux、macOS、Windows対応

## インストール

```bash
git clone https://github.com/king-nomura/feedToHtml.git
cd feedToHtml
npm install
```

## 使用方法

### 基本的な使用方法

```bash
node src/cli/main.js <RSS_URL>
```

例：
```bash
node src/cli/main.js https://example.com/rss.xml
```

### 出力ディレクトリを指定

```bash
node src/cli/main.js <RSS_URL> --output <出力ディレクトリ>
```

例：
```bash
node src/cli/main.js https://example.com/rss.xml --output ./public
```

### ローカルファイルから変換

```bash
node src/cli/main.js --file <ローカルファイル> --output <出力ディレクトリ>
```

### 設定ファイルを使用した高度な設定

```bash
node src/cli/main.js <RSS_URL> --config <設定ファイル>
```

例：
```bash
node src/cli/main.js https://example.com/rss.xml --config config.json
```

### 出力形式

記事は公開日に基づいて月別にグループ化され、以下の構造で出力されます：

```
<output_dir>/
├── 2025/
│   ├── 2025-01.html
│   ├── 2025-02.html
│   └── ...
└── 2024/
    ├── 2024-11.html
    └── 2024-12.html
```

既存のHTMLファイルがある場合は、新しい記事のみが追加されます（インクリメンタル更新）。

## 設定ファイル

JSON形式の設定ファイルで以下のオプションを設定できます：

```json
{
  "templatePath": "./templates/custom.html",
  "timeout": 60,
  "outputDir": "./output",
  "dateFormat": {
    "locale": "ja-JP",
    "options": {
      "year": "numeric",
      "month": "long",
      "day": "numeric"
    }
  }
}
```

### 設定項目

- `templatePath` (オプション): カスタムHTMLテンプレートのパス
- `timeout` (オプション): ネットワークタイムアウト秒数（デフォルト: 60秒）
- `outputDir` (オプション): 出力ディレクトリのパス
- `dateFormat` (オプション): 日付フォーマット設定（Intl.DateTimeFormat準拠）

## HTMLテンプレート

デフォルトテンプレートをカスタマイズして独自のHTMLレイアウトを作成できます。テンプレートでは以下のプレースホルダーが使用できます：

### フィード情報
- `{{FEED_TITLE}}`: フィードのタイトル
- `{{FEED_DESCRIPTION}}`: フィードの説明
- `{{FEED_LINK}}`: フィードのリンク
- `{{YEAR_MONTH}}`: 年月（例: 2025年1月）

### 記事情報（ITEMSブロック内）
- `{{#ITEMS}}...{{/ITEMS}}`: 記事ループブロック
- `{{ITEM_TITLE}}`: 記事タイトル
- `{{ITEM_LINK}}`: 記事リンク
- `{{ITEM_DESCRIPTION}}`: 記事内容
- `{{ITEM_DATE}}`: 公開日
- `{{ITEM_AUTHOR}}`: 著者
- `{{ITEM_CATEGORIES}}`: カテゴリ

### ナビゲーション
- `{{MONTHLY_NAV}}`: 月別ナビゲーション
- `{{GENERATION_DATE}}`: 生成日時

### テンプレート例

```html
<!DOCTYPE html>
<html>
<head>
    <title>{{FEED_TITLE}}</title>
    <meta charset="UTF-8">
</head>
<body>
    <h1>{{FEED_TITLE}}</h1>
    <p>{{FEED_DESCRIPTION}}</p>
    
    {{#ITEMS}}
    <article>
        <h2><a href="{{ITEM_LINK}}">{{ITEM_TITLE}}</a></h2>
        <time>{{ITEM_DATE}}</time>
        <div>{{ITEM_DESCRIPTION}}</div>
    </article>
    {{/ITEMS}}
    
    <footer>
        Generated on {{GENERATION_DATE}}
    </footer>
</body>
</html>
```

## cronでの自動実行

定期的にRSSフィードを更新する場合のcrontab設定例：

```bash
# 毎時0分にRSSフィードを更新
0 * * * * cd /path/to/feedToHtml && node src/cli/main.js https://example.com/rss.xml --output /var/www/html/feeds
```

## エラーコード

プログラムは以下の終了コードを返します：

- `0`: 正常終了
- `1`: ネットワークエラー
- `2`: 解析エラー
- `3`: ファイルシステムエラー
- `4`: 設定エラー

## 対応フォーマット

- RSS 2.0
- Atom 1.0

## システム要件

- Node.js 20.0.0以上

## 実験的機能: outboxtohtml

ActivityPub Outbox（Mastodonなど）をHTMLに変換する実験的な機能も含まれています。

```bash
node src/cli/outbox_main.js <OUTBOX_URL> --output <出力ディレクトリ>
# または
node src/cli/outbox_main.js --file <ローカルファイル> --output <出力ディレクトリ>
```

> **注意**: この機能は実験的であり、APIが変更される可能性があります。

## 開発について

このプロジェクトは [Claude Code](https://claude.ai/code)（Anthropic社のAIコーディングアシスタント）を活用して開発されました。

### テスト実行

```bash
npm test
```

## ライセンス

MIT License

## 貢献

バグレポートや機能リクエストは [Issues](https://github.com/king-nomura/feedToHtml/issues) までお願いします。
