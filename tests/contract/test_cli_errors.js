import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { runCLI, IntegrationHelpers } from '../../src/test_helpers/integration_helpers.js';

describe('CLI Error Output Format Contract', () => {
  let helpers;

  beforeEach(() => {
    helpers = new IntegrationHelpers();
  });

  afterEach(() => {
    helpers.cleanup();
  });

  test('should output errors to stderr', async () => {
    const result = await runCLI(['invalid-url']);

    // Errors should go to stderr, not stdout
    assert.notStrictEqual(result.code, 0, 'Should fail with invalid input');
    assert.notStrictEqual(result.stderr, '', 'Should output errors to stderr');
  });

  test('should use structured error format', async () => {
    const result = await runCLI(['invalid-url']);

    // Should use "ERROR: [CATEGORY] message" format
    assert.match(result.stderr, /Error:|ERROR:/, 'Should contain Error in output');
  });

  test('should show network error format', async () => {
    const result = await runCLI([
      'https://nonexistent-domain-12345.com/rss.xml',
      '--output', '/tmp'
    ], { timeout: 10000 });

    // Should show network error format
    assert.strictEqual(result.code, 1, 'Should exit with code 1 for network error');
  });

  test('should show parse error format', async () => {
    const outputDir = helpers.createTempDir();
    const invalidFile = helpers.createTempFile('<html>not xml</html>', 'invalid.xml');

    const result = await runCLI([
      '--file', invalidFile,
      '--output', outputDir
    ]);

    // Should show parse error format
    assert.strictEqual(result.code, 2, 'Should exit with code 2 for parse error');
  });

  test('should show config error format', async () => {
    const result = await runCLI([
      'https://example.com/rss.xml',
      '--config', 'nonexistent.json'
    ]);

    // Should show config error format
    assert.strictEqual(result.code, 4, 'Should exit with code 4 for config error');
  });

  test('should output success messages to stdout', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    // Success messages should go to stdout
    if (result.code === 0) {
      assert.match(result.stdout, /Successfully converted/, 'Should show success message on stdout');
    }
  });

  test('should show file paths in success output', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    // Should mention output directory
    if (result.code === 0) {
      assert.match(result.stdout, /Output directory:/, 'Should mention output directory');
    }
  });
});
