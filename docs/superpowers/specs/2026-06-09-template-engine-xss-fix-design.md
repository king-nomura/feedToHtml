# テンプレートエンジン XSS 修正 設計書

- 日付: 2026-06-09
- 対象: `src/services/template_engine.js`、新規 `src/utils/url_sanitizer.js`
- 背景: セキュリティレビューで3件の XSS（ストアド）が指摘された。フィード/Outbox は信頼できない第三者入力であり、生成 HTML は Web サイトとして公開される前提。

## 指摘された脆弱性

- **Vuln 1: 属性インジェクション / `javascript:` スキーム** — `template_engine.js:164, 190`
  フィードの `item.link` が未エスケープのまま `<a href="{{ITEM_LINK}}">` に展開される。属性ブレイクアウトおよび `javascript:` スキームで XSS。
- **Vuln 2: denylist 方式サニタイズのバイパス** — `template_engine.js:201-215`（呼び出し元 164 行目）
  `processItemDescription()` が `<script>`/`<iframe>`/`on\w+="..."` のみを除去するブラックリスト方式で、`<img src=x onerror=...>` 等で自明に回避され、生 HTML として挿入される。
- **Vuln 3: フィードレベル値の未エスケープ** — `template_engine.js:104-112`
  `FEED_TITLE`/`FEED_DESCRIPTION`/`FEED_LINK`/`FEED_LANGUAGE` が未エスケープのまま展開される（例: `<title>{{FEED_TITLE}}</title>` で `</title><script>` 注入）。

## 設計判断（確定事項）

1. **本文（`ITEM_DESCRIPTION`）は完全エスケープ（HTML 無効化）** する。
   - 最も安全で、依存追加ゼロ、実装が単純。
   - トレードオフ: description 内の段落/リンク/画像などの書式は失われ、プレーンテキスト表示になる。
2. **URL スキーム検証**: `http`/`https`/`mailto` に加え、スキーム無しの URL（相対パス・プロトコル相対 `//`・`/path`・`#frag`）を許可。それ以外の危険スキーム（`javascript:`/`data:`/`vbscript:` 等）は `#` に置換する。
   - 重要: HTML エスケープだけでは `href="javascript:alert(1)"`（特殊文字を含まない）はクリック時に実行されるため、スキーム許可リスト検証が別途必須。
3. **配置**: スキーム検証ロジックは独立ユーティリティに切り出して単体テスト可能にする（既存 `src/utils/` 構成に準拠）。
4. **Outbox 本文もエスケープ対象**: Outbox 機能は同じ `TemplateEngine` を経由するため、Mastodon 由来の本文 HTML もエスケープされ、タグがテキスト表示になる。実験的機能であり安全側に倒す方針として許容する（ユーザー承認済み）。

## コンポーネント設計

### 新規: `src/utils/url_sanitizer.js`

`sanitizeUrl(rawUrl)` をエクスポートする。

- 入力が文字列でない/空の場合は `'#'` を返す。
- 前処理: タブ・改行・その他の制御文字（`\x00-\x1F`）および先頭/末尾の空白を除去する。これによりブラウザがスキーム解釈時に無視する `java\tscript:` / `java\nscript:` 等の回避を防ぐ。
- スキーム判定: 前処理後の文字列が正規表現 `/^[a-z][a-z0-9+.\-]*:/i` にマッチする場合はスキーム有りとみなす。
  - スキームが `http` / `https` / `mailto`（大文字小文字を無視）なら **元の（前処理後の）URL を許可** して返す。
  - それ以外のスキームは `'#'` を返す。
- スキーム無し（相対パス、`//host`、`/path`、`#frag` など）はそのまま返す（許可）。
- 戻り値は生の URL 文字列。HTML 属性向けのエスケープは呼び出し側（`escapeHTML`）が行う。

注: スキーム検出はプロトコル相対 `//host` を「スキーム無し」と正しく扱う（`:` の前に `/` が現れるため正規表現にマッチしない）。

### 修正: `src/services/template_engine.js`

信頼できないフィード由来の全値に、コンテキストに応じたエスケープを一貫適用する。

- `prepareFeedValues()`（Vuln 3）:
  - `FEED_TITLE` → `escapeHTML(feed.title || '')`
  - `FEED_DESCRIPTION` → `escapeHTML(feed.description || '')`
  - `FEED_LANGUAGE` → `escapeHTML(feed.language || 'en')`
  - `FEED_LINK` → `escapeHTML(sanitizeUrl(feed.link || ''))`
  - `TOTAL_ITEMS` は数値由来のため現状維持。
- `generateItemHTML()`（Vuln 1）:
  - `ITEM_LINK` → `escapeHTML(sanitizeUrl(item.link || '#'))`
  - `ITEM_DESCRIPTION`（Vuln 2）→ `escapeHTML(item.description || '')`
  - 既存の `ITEM_TITLE` / `ITEM_AUTHOR` / `ITEM_CATEGORIES` のエスケープは現状維持。
- `processItemDescription()`（denylist 実装）は廃止する。呼び出しを `escapeHTML` に置き換え、未使用となったメソッドを削除する。
- `url_sanitizer.js` を `import` する。

## 影響範囲・対象外

- 内部生成値（`YEAR_MONTH` / `GENERATION_DATE` / `META_DATE` / `MONTHLY_NAV` / ページネーション）はフィード由来でなく安全なため変更しない。
- テンプレートファイル（`templates/template.html` 等）は運用者が用意する信頼境界内のため対象外（テンプレートインジェクションは脅威に含めない）。
- フィード URL・出力ディレクトリ・設定ファイルパスは CLI/設定由来の信頼された入力であり対象外。
- `latestPage` のパス検証は `src/models/configuration.js` で既に出力ディレクトリ外参照を拒否済み。

## テスト計画（`node:test`、依存追加なし）

### `tests/unit/url_sanitizer.test.js`（新規）

- `javascript:alert(1)` → `#`
- `JavaScript:alert(1)`（大文字混在）→ `#`
- `java\tscript:alert(1)` / `java\nscript:alert(1)`（制御文字混入）→ `#`
- `data:text/html,...` → `#`
- `vbscript:...` → `#`
- `http://example.com/x` → 維持
- `https://example.com/x` → 維持
- `mailto:a@example.com` → 維持
- `/relative/path` → 維持
- `//host/path`（プロトコル相対）→ 維持
- `#fragment` → 維持
- 空文字 / 非文字列 → `#`

### `tests/unit/template_engine.test.js`（追加または新規）

- 属性ブレイクアウト: `item.link = '"><img src=x onerror=alert(1)>'` が `href` を抜けず、`onerror` 実行可能な生 HTML として出力されないこと。
- `javascript:` リンク: `item.link = 'javascript:alert(1)'` が `href="#"` になること。
- description: `item.description = '<img src=x onerror=alert(1)>'` がエスケープされ（`&lt;img ...`）、実行可能タグとして出力されないこと。
- feed タイトル: `feed.title = '</title><script>alert(1)</script>'` がエスケープされること。
- feed リンク: `feed.link = 'javascript:alert(1)'` が `#` に正規化されること。

## 完了条件

- 上記テストがすべてパスする。
- `npm test`（既存テスト含む）がパスする。
- denylist 実装（`processItemDescription`）が削除されている。
