# テンプレートエンジン XSS 修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** セキュリティレビューで指摘された3件の XSS（ITEM_LINK の属性インジェクション/`javascript:`、ITEM_DESCRIPTION の denylist バイパス、フィードレベル値の未エスケープ）を、出力エンコーディングの一貫適用で修正する。

**Architecture:** URL スキーム検証を独立ユーティリティ `src/utils/url_sanitizer.js` に切り出し、`src/services/template_engine.js` から利用する。信頼できないフィード/Outbox 由来の全値に対し、HTML 本文は `escapeHTML`、URL は `escapeHTML(sanitizeUrl(...))` を適用。本文 HTML は完全エスケープ（HTML 無効化）し、既存の denylist 実装 `processItemDescription` は削除する。

**Tech Stack:** Node.js 20+ (ESM)、テストは組み込み `node:test` + `node:assert/strict`。依存追加なし。

設計書: `docs/superpowers/specs/2026-06-09-template-engine-xss-fix-design.md`

---

## File Structure

- **Create `src/utils/url_sanitizer.js`** — `sanitizeUrl(rawUrl)` を export。URL のスキーム許可リスト検証のみを担う純関数。
- **Create `tests/unit/test_url_sanitizer.js`** — `sanitizeUrl` の単体テスト。
- **Modify `src/services/template_engine.js`** — import 追加、`prepareFeedValues`（104-112 行）と `generateItemHTML` の `itemValues`（161-168 行）でエスケープ適用、`processItemDescription`（196-215 行）を削除。
- **Create `tests/unit/test_template_engine.js`** — エスケープ挙動の単体テスト。

テスト命名は既存規約 `tests/unit/test_*.js` に合わせる（設計書のファイル名はこの規約に読み替え）。

---

### Task 1: URL サニタイザユーティリティ

**Files:**
- Create: `src/utils/url_sanitizer.js`
- Test: `tests/unit/test_url_sanitizer.js`

- [ ] **Step 1: Write the failing test**

`tests/unit/test_url_sanitizer.js` を新規作成:

```javascript
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { sanitizeUrl } from '../../src/utils/url_sanitizer.js';

describe('sanitizeUrl', () => {
  test('allows http URLs', () => {
    assert.equal(sanitizeUrl('http://example.com/x'), 'http://example.com/x');
  });

  test('allows https URLs', () => {
    assert.equal(sanitizeUrl('https://example.com/x'), 'https://example.com/x');
  });

  test('allows mailto URLs', () => {
    assert.equal(sanitizeUrl('mailto:a@example.com'), 'mailto:a@example.com');
  });

  test('allows relative paths', () => {
    assert.equal(sanitizeUrl('/relative/path'), '/relative/path');
  });

  test('allows protocol-relative URLs', () => {
    assert.equal(sanitizeUrl('//host/path'), '//host/path');
  });

  test('allows fragment URLs', () => {
    assert.equal(sanitizeUrl('#fragment'), '#fragment');
  });

  test('blocks javascript: scheme', () => {
    assert.equal(sanitizeUrl('javascript:alert(1)'), '#');
  });

  test('blocks JavaScript: scheme regardless of case', () => {
    assert.equal(sanitizeUrl('JavaScript:alert(1)'), '#');
  });

  test('blocks javascript: with embedded tab', () => {
    assert.equal(sanitizeUrl('java\tscript:alert(1)'), '#');
  });

  test('blocks javascript: with embedded newline', () => {
    assert.equal(sanitizeUrl('java\nscript:alert(1)'), '#');
  });

  test('blocks data: scheme', () => {
    assert.equal(sanitizeUrl('data:text/html,<script>alert(1)</script>'), '#');
  });

  test('blocks vbscript: scheme', () => {
    assert.equal(sanitizeUrl('vbscript:msgbox(1)'), '#');
  });

  test('returns # for empty string', () => {
    assert.equal(sanitizeUrl(''), '#');
  });

  test('returns # for whitespace-only string', () => {
    assert.equal(sanitizeUrl('   '), '#');
  });

  test('returns # for non-string input', () => {
    assert.equal(sanitizeUrl(null), '#');
    assert.equal(sanitizeUrl(undefined), '#');
    assert.equal(sanitizeUrl(123), '#');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/test_url_sanitizer.js`
Expected: FAIL（`Cannot find module '.../src/utils/url_sanitizer.js'` でロード失敗）

- [ ] **Step 3: Write minimal implementation**

`src/utils/url_sanitizer.js` を新規作成:

```javascript
/**
 * URL sanitization utility for safe HTML attribute output.
 */

const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto']);

/**
 * Sanitize a URL for safe use in an HTML href/src attribute.
 *
 * Allows http/https/mailto and scheme-less URLs (relative paths,
 * protocol-relative `//host`, `/path`, `#fragment`). URLs with any other
 * scheme (javascript:, data:, vbscript:, etc.) are replaced with '#'.
 *
 * HTML-escaping of the returned value is the caller's responsibility.
 *
 * @param {string} rawUrl - Raw URL from untrusted feed content
 * @returns {string} A safe URL string, or '#' if disallowed
 */
export function sanitizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string') {
    return '#';
  }

  // Strip control characters (incl. tab/newline that browsers ignore when
  // parsing a scheme, e.g. "java\tscript:") and surrounding whitespace.
  const cleaned = rawUrl.replace(/[\x00-\x1F\x7F]/g, '').trim();

  if (cleaned === '') {
    return '#';
  }

  // A scheme is: a letter, then letters/digits/+/-/. , then ':'.
  // Protocol-relative ("//host") and relative ("/path", "#frag") URLs do not
  // match because they start with '/' or '#'.
  const schemeMatch = cleaned.match(/^([a-z][a-z0-9+.\-]*):/i);

  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    return ALLOWED_SCHEMES.has(scheme) ? cleaned : '#';
  }

  // No scheme: relative / protocol-relative / fragment — allowed as-is.
  return cleaned;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/test_url_sanitizer.js`
Expected: PASS（全テストグリーン）

- [ ] **Step 5: Commit**

```bash
git add src/utils/url_sanitizer.js tests/unit/test_url_sanitizer.js
git commit -m "feat: URLスキーム検証ユーティリティ sanitizeUrl を追加

http/https/mailtoとスキーム無しURLを許可し、javascript:等の危険
スキームを # に置換する。XSS修正(Vuln 1/3)の基盤。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: テンプレートエンジンへのエスケープ適用

**Files:**
- Modify: `src/services/template_engine.js`（import 追加 / `prepareFeedValues` 104-112 / `generateItemHTML` の `itemValues` 161-168 / `processItemDescription` 196-215 を削除）
- Test: `tests/unit/test_template_engine.js`

- [ ] **Step 1: Write the failing test**

`tests/unit/test_template_engine.js` を新規作成:

```javascript
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { TemplateEngine } from '../../src/services/template_engine.js';

function makeItem(overrides = {}) {
  return {
    title: 'T',
    link: 'http://example.com',
    description: '',
    pubDate: null,
    author: '',
    categories: [],
    hasAuthor() { return false; },
    hasCategories() { return false; },
    getCategoriesString() { return ''; },
    ...overrides
  };
}

function makeFeed(overrides = {}) {
  return {
    title: '',
    description: '',
    link: '',
    language: 'en',
    getItemCount() { return 0; },
    ...overrides
  };
}

describe('TemplateEngine XSS escaping', () => {
  test('ITEM_LINK attribute breakout is escaped (Vuln 1)', () => {
    const engine = new TemplateEngine();
    const html = engine.generateItemHTML(
      makeItem({ link: '"><img src=x onerror=alert(1)>' })
    );
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'),
      'raw <img> tag must not appear');
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'),
      'breakout payload must be HTML-escaped');
  });

  test('javascript: link becomes href="#" (Vuln 1)', () => {
    const engine = new TemplateEngine();
    const html = engine.generateItemHTML(
      makeItem({ link: 'javascript:alert(1)' })
    );
    assert.ok(html.includes('href="#"'), 'href should be neutralized to #');
    assert.ok(!html.includes('javascript:alert(1)'),
      'javascript: scheme must not survive');
  });

  test('ITEM_DESCRIPTION HTML is fully escaped (Vuln 2)', () => {
    const engine = new TemplateEngine();
    const html = engine.generateItemHTML(
      makeItem({ description: '<img src=x onerror=alert(1)>' })
    );
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'),
      'description HTML must be escaped');
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'),
      'raw <img> tag must not appear');
  });

  test('FEED_TITLE is escaped (Vuln 3)', () => {
    const engine = new TemplateEngine();
    const values = engine.prepareFeedValues(
      makeFeed({ title: '</title><script>alert(1)</script>' })
    );
    assert.ok(!values.FEED_TITLE.includes('<script>'),
      'raw <script> must not appear');
    assert.ok(values.FEED_TITLE.includes('&lt;script&gt;'),
      'title must be HTML-escaped');
  });

  test('FEED_LINK javascript: scheme is neutralized (Vuln 3)', () => {
    const engine = new TemplateEngine();
    const values = engine.prepareFeedValues(
      makeFeed({ link: 'javascript:alert(1)' })
    );
    assert.equal(values.FEED_LINK, '#');
  });

  test('legitimate values pass through correctly', () => {
    const engine = new TemplateEngine();
    const values = engine.prepareFeedValues(
      makeFeed({ title: 'My Feed', link: 'https://example.com', description: 'Hi' })
    );
    assert.equal(values.FEED_TITLE, 'My Feed');
    assert.equal(values.FEED_LINK, 'https://example.com');
    assert.equal(values.FEED_DESCRIPTION, 'Hi');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/test_template_engine.js`
Expected: FAIL（少なくとも Vuln 1/2/3 のテストが失敗。現状コードは link・description・feed 値をエスケープしていないため、`&lt;img ...` を含まず raw タグが残る／`href="#"` にならない）

- [ ] **Step 3: Add the import**

`src/services/template_engine.js` の先頭、既存 import の直後に追加:

```javascript
import { HTMLTemplate } from '../models/html_template.js';
import { sanitizeUrl } from '../utils/url_sanitizer.js';
```

（1 行目 `import { HTMLTemplate } ...` の次の行に `sanitizeUrl` の import を挿入する）

- [ ] **Step 4: Escape feed-level values (Vuln 3)**

`prepareFeedValues`（現 104-112 行）の `return {...}` を以下に置き換える:

```javascript
  prepareFeedValues(feed) {
    return {
      FEED_TITLE: this.escapeHTML(feed.title || ''),
      FEED_DESCRIPTION: this.escapeHTML(feed.description || ''),
      FEED_LINK: this.escapeHTML(sanitizeUrl(feed.link || '')),
      FEED_LANGUAGE: this.escapeHTML(feed.language || 'en'),
      TOTAL_ITEMS: feed.getItemCount().toString()
    };
  }
```

注: `FEED_LINK` は `sanitizeUrl` の戻り値（`'#'` 等）を `escapeHTML` に通す。`'#'` はエスケープしても `'#'` のまま。

- [ ] **Step 5: Escape item link and description (Vuln 1 / Vuln 2)**

`generateItemHTML` の `itemValues`（現 161-168 行）を以下に置き換える:

```javascript
    const itemValues = {
      ITEM_TITLE: this.escapeHTML(item.title || 'Untitled'),
      ITEM_LINK: this.escapeHTML(sanitizeUrl(item.link || '#')),
      ITEM_DESCRIPTION: this.escapeHTML(item.description || ''),
      ITEM_DATE: this.formatItemDate(item),
      ITEM_AUTHOR: item.hasAuthor() ? this.escapeHTML(item.author) : '',
      ITEM_CATEGORIES: item.hasCategories() ? this.escapeHTML(item.getCategoriesString()) : ''
    };
```

- [ ] **Step 6: Remove the denylist method (Vuln 2)**

`processItemDescription`（現 196-215 行）のメソッド全体（JSDoc コメント行を含む）を削除する。削除対象は次のブロック:

```javascript
  /**
   * Process item description (clean HTML, truncate if needed)
   * @param {string} description - Raw description
   * @returns {string} Processed description
   */
  processItemDescription(description) {
    if (!description) return '';

    // Remove or escape potentially dangerous HTML
    let processed = description
      .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
      .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '') // Remove iframe tags
      .replace(/on\w+="[^"]*"/gi, ''); // Remove event handlers

    // Convert relative URLs to absolute (basic implementation)
    // This is a simplified version - a full implementation would need the base URL
    processed = processed.replace(/src="\/([^"]+)"/g, 'src="/$1"');

    return processed;
  }
```

Step 5 で `ITEM_DESCRIPTION` の呼び出しを `escapeHTML` に切り替えたため、このメソッドへの参照は残っていない。

- [ ] **Step 7: Verify no remaining references to the deleted method**

Run: `grep -n "processItemDescription" src/services/template_engine.js`
Expected: 出力なし（参照が完全に消えている）

- [ ] **Step 8: Run the new tests to verify they pass**

Run: `node --test tests/unit/test_template_engine.js`
Expected: PASS（全テストグリーン）

- [ ] **Step 9: Run the full test suite (no regressions)**

Run: `npm test`
Expected: 既存テストを含め全て PASS

- [ ] **Step 10: Commit**

```bash
git add src/services/template_engine.js tests/unit/test_template_engine.js
git commit -m "fix: テンプレートエンジンのXSSを修正(出力エンコーディング)

- ITEM_LINK/FEED_LINKをsanitizeUrl+escapeHTMLで無害化(Vuln 1/3)
- ITEM_DESCRIPTIONを完全エスケープ化(Vuln 2)
- フィードレベル値(FEED_TITLE等)をescapeHTML適用(Vuln 3)
- denylist方式のprocessItemDescriptionを削除

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:**
  - Vuln 1（ITEM_LINK）→ Task 2 Step 5。
  - Vuln 2（ITEM_DESCRIPTION denylist）→ Task 2 Step 5（escape）+ Step 6（削除）。
  - Vuln 3（フィードレベル）→ Task 2 Step 4。
  - `url_sanitizer.js` 仕様 → Task 1。
  - テスト計画（url_sanitizer / template_engine）→ Task 1 Step 1、Task 2 Step 1。
  - 「内部生成値は変更しない」「テンプレートは対象外」→ 変更箇所を該当値に限定しており遵守。
- **Placeholder scan:** TBD/TODO/「適切に処理」等のプレースホルダなし。全コードステップに実コードを記載。
- **Type consistency:** `sanitizeUrl` の名称・シグネチャ（`(rawUrl: string) => string`）は Task 1 定義と Task 2 利用で一致。`escapeHTML` は既存メソッドを流用。テストの `makeItem`/`makeFeed` が参照する `item`/`feed` のプロパティ・メソッドは `generateItemHTML`/`prepareFeedValues` の利用と一致。

備考: Outbox 機能（`outboxtohtml`）も同じ `TemplateEngine` を経由するため、本修正により Mastodon 本文 HTML もエスケープされる（設計書で承認済みのトレードオフ）。
