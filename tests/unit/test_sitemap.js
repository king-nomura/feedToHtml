import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { Configuration } from '../../src/models/configuration.js';

describe('Configuration sitemap validation', () => {
  test('should accept valid baseUrl and sitemap', () => {
    const config = new Configuration({ baseUrl: 'https://example.com', sitemap: 'sitemap.xml' });
    assert.strictEqual(config.baseUrl, 'https://example.com');
    assert.strictEqual(config.sitemap, 'sitemap.xml');
  });

  test('should accept null baseUrl and sitemap (default)', () => {
    const config = new Configuration();
    assert.strictEqual(config.baseUrl, null);
    assert.strictEqual(config.sitemap, null);
  });

  test('should accept empty string as null (falsy)', () => {
    const config = new Configuration({ baseUrl: '', sitemap: '' });
    assert.strictEqual(config.baseUrl, null);
    assert.strictEqual(config.sitemap, null);
  });

  test('should reject non-string baseUrl', () => {
    assert.throws(() => {
      new Configuration({ baseUrl: 123 });
    }, /baseUrl must be a string/);
  });

  test('should reject whitespace-only baseUrl', () => {
    assert.throws(() => {
      new Configuration({ baseUrl: '   ' });
    }, /baseUrl cannot be empty/);
  });

  test('should reject non-string sitemap', () => {
    assert.throws(() => {
      new Configuration({ sitemap: 123 });
    }, /sitemap must be a string/);
  });

  test('should reject whitespace-only sitemap', () => {
    assert.throws(() => {
      new Configuration({ sitemap: '   ' });
    }, /sitemap cannot be empty/);
  });

  test('should reject path traversal with ../', () => {
    assert.throws(() => {
      new Configuration({ sitemap: '../sitemap.xml' });
    }, /sitemap must not reference a path outside the output directory/);
  });

  test('should reject path traversal with nested ../', () => {
    assert.throws(() => {
      new Configuration({ sitemap: 'subdir/../../sitemap.xml' });
    }, /sitemap must not reference a path outside the output directory/);
  });

  test('should accept subdirectory path within outputDir', () => {
    const config = new Configuration({ sitemap: 'subdir/sitemap.xml' });
    assert.strictEqual(config.sitemap, 'subdir/sitemap.xml');
  });

  test('should include baseUrl and sitemap in toJSON', () => {
    const config = new Configuration({ baseUrl: 'https://example.com', sitemap: 'sitemap.xml' });
    const json = config.toJSON();
    assert.strictEqual(json.baseUrl, 'https://example.com');
    assert.strictEqual(json.sitemap, 'sitemap.xml');
  });
});
