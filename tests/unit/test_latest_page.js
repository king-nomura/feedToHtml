import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { Configuration } from '../../src/models/configuration.js';

describe('Configuration latestPage validation', () => {
  test('should accept valid latestPage filename', () => {
    const config = new Configuration({ latestPage: 'latest.html' });
    assert.strictEqual(config.latestPage, 'latest.html');
  });

  test('should accept null latestPage (default)', () => {
    const config = new Configuration();
    assert.strictEqual(config.latestPage, null);
  });

  test('should accept empty string as null (falsy)', () => {
    const config = new Configuration({ latestPage: '' });
    assert.strictEqual(config.latestPage, null);
  });

  test('should reject non-string latestPage', () => {
    assert.throws(() => {
      new Configuration({ latestPage: 123 });
    }, /latestPage must be a string/);
  });

  test('should reject whitespace-only latestPage', () => {
    assert.throws(() => {
      new Configuration({ latestPage: '   ' });
    }, /latestPage cannot be empty/);
  });

  test('should reject path traversal with ../', () => {
    assert.throws(() => {
      new Configuration({ latestPage: '../latest.html' });
    }, /latestPage must not reference a path outside the output directory/);
  });

  test('should reject path traversal with nested ../', () => {
    assert.throws(() => {
      new Configuration({ latestPage: 'subdir/../../latest.html' });
    }, /latestPage must not reference a path outside the output directory/);
  });

  test('should accept subdirectory path within outputDir', () => {
    const config = new Configuration({ latestPage: 'subdir/latest.html' });
    assert.strictEqual(config.latestPage, 'subdir/latest.html');
  });

  test('should include latestPage in toJSON', () => {
    const config = new Configuration({ latestPage: 'latest.html' });
    const json = config.toJSON();
    assert.strictEqual(json.latestPage, 'latest.html');
  });
});
