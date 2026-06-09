import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { sanitizeRichText } from '../../src/utils/rich_text_sanitizer.js';

describe('sanitizeRichText', () => {
  // --- 空・非文字列入力 ---
  test('returns empty string for empty input', () => {
    assert.equal(sanitizeRichText(''), '');
  });

  test('returns empty string for null', () => {
    assert.equal(sanitizeRichText(null), '');
  });

  test('returns empty string for undefined', () => {
    assert.equal(sanitizeRichText(undefined), '');
  });

  // --- 通常テキストのエスケープ維持 ---
  test('escapes ampersand in plain text', () => {
    assert.equal(sanitizeRichText('Tom & Jerry'), 'Tom &amp; Jerry');
  });

  test('keeps bare less-than/greater-than as escaped text', () => {
    assert.equal(
      sanitizeRichText('5 < 10 and 20 > 15'),
      '5 &lt; 10 and 20 &gt; 15'
    );
  });

  // --- <br> の復元・正規化 ---
  test('restores <br>', () => {
    assert.equal(sanitizeRichText('a<br>b'), 'a<br>b');
  });

  test('normalizes <br/> to <br>', () => {
    assert.equal(sanitizeRichText('a<br/>b'), 'a<br>b');
  });

  test('normalizes <br /> to <br>', () => {
    assert.equal(sanitizeRichText('a<br />b'), 'a<br>b');
  });

  test('normalizes uppercase <BR> to <br>', () => {
    assert.equal(sanitizeRichText('a<BR>b'), 'a<br>b');
  });

  // --- <a> の復元 ---
  test('restores <a> with href and adds rel/target', () => {
    assert.equal(
      sanitizeRichText('<a href="https://e.com">x</a>'),
      '<a href="https://e.com" rel="nofollow noopener" target="_blank">x</a>'
    );
  });

  test('drops extra attributes on <a>, keeping only href', () => {
    const out = sanitizeRichText('<a href="https://e.com" onclick="evil()">x</a>');
    assert.ok(!out.includes('onclick'), 'onclick must be dropped');
    assert.ok(
      out.includes('<a href="https://e.com" rel="nofollow noopener" target="_blank">'),
      'only href is preserved'
    );
  });

  test('blocks javascript: href to #', () => {
    assert.equal(
      sanitizeRichText('<a href="javascript:alert(1)">x</a>'),
      '<a href="#" rel="nofollow noopener" target="_blank">x</a>'
    );
  });

  test('uses # when <a> has no href', () => {
    assert.equal(
      sanitizeRichText('<a>x</a>'),
      '<a href="#" rel="nofollow noopener" target="_blank">x</a>'
    );
  });

  test('allows relative href', () => {
    assert.equal(
      sanitizeRichText('<a href="/rel/path">x</a>'),
      '<a href="/rel/path" rel="nofollow noopener" target="_blank">x</a>'
    );
  });

  // --- 許可外タグの除去(中身は残す) ---
  test('strips disallowed tag but keeps content', () => {
    assert.equal(sanitizeRichText('<p>foo</p>'), 'foo');
  });

  test('strips script tag, keeps text content harmless', () => {
    assert.equal(sanitizeRichText('<script>alert(1)</script>'), 'alert(1)');
  });

  test('strips self-contained img tag entirely', () => {
    assert.equal(sanitizeRichText('<img src=x onerror=evil>'), '');
  });

  // --- 安全性: 全エスケープ起点で XSS にならない ---
  test('quoted-attribute breakout does not produce a live tag', () => {
    const out = sanitizeRichText('<a href="https://e.com"><img src=x onerror=alert(1)></a>');
    assert.ok(!out.includes('<img'), 'no live img tag');
    assert.ok(out.startsWith('<a href="https://e.com"'), 'a tag restored');
    assert.ok(out.endsWith('</a>'), 'closing a tag restored');
  });

  test('keeps URL query-string ampersands correctly escaped', () => {
    assert.equal(
      sanitizeRichText('<a href="https://e.com/?a=1&b=2">x</a>'),
      '<a href="https://e.com/?a=1&amp;b=2" rel="nofollow noopener" target="_blank">x</a>'
    );
  });

  // --- 性能: 未終端タグ大量入力で二次爆発(ReDoS)しないこと ---
  test('pathological unterminated-tag input stays linear (no ReDoS)', () => {
    // Many "<a" starts with no closing ">" — the O(n^2) failure mode.
    const evil = '<a href="'.repeat(50000);
    const start = Date.now();
    const out = sanitizeRichText(evil);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 2000, `should finish quickly, took ${elapsed}ms`);
    assert.ok(!out.includes('<a'), 'unterminated tags must not become live markup');
  });

  // --- 既知の制約: 属性値内の '>' は表示崩れになるが、決して live markup にはならない ---
  test("'>' inside an attribute never yields live markup (documented limitation)", () => {
    const out = sanitizeRichText('<a title="a>b" href="https://e.com">link</a>');
    // Cosmetic corruption is acceptable; the security invariant is what we pin:
    // no executable tag escapes, and any leaked remainder stays HTML-escaped.
    assert.ok(!/<(?!\/?(?:a|br)\b)/.test(out), 'only <a>/<br> may appear as live tags');
    assert.ok(!out.includes('onerror') && !out.includes('javascript:'), 'no dangerous content');
  });
});
