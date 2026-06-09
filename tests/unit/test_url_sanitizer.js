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
