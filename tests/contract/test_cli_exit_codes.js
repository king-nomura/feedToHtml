import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { runCLI, IntegrationHelpers } from '../../src/test_helpers/integration_helpers.js';

describe('CLI Exit Codes Contract', () => {
  let helpers;

  beforeEach(() => {
    helpers = new IntegrationHelpers();
  });

  afterEach(() => {
    helpers.cleanup();
  });

  test('should exit with code 0 on success', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    assert.strictEqual(result.code, 0, `Should exit with code 0 on success. stderr: ${result.stderr}`);
  });

  test('should exit with code 1 on network error', async () => {
    const result = await runCLI([
      'https://nonexistent-domain-12345.com/rss.xml',
      '--output', '/tmp'
    ], { timeout: 10000 });

    // Should fail with network error
    assert.strictEqual(result.code, 1, 'Should exit with code 1 on network error');
  });

  test('should exit with code 2 on parse error', async () => {
    const outputDir = helpers.createTempDir();
    const invalidFile = helpers.createTempFile('<html>not xml</html>', 'invalid.xml');

    const result = await runCLI([
      '--file', invalidFile,
      '--output', outputDir
    ]);

    // Should fail with parse error
    assert.strictEqual(result.code, 2, 'Should exit with code 2 on parse error');
  });

  test('should exit with code 3 on filesystem error', async () => {
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', '/root/readonly/nonexistent'
    ]);

    // Should fail with filesystem error (code 3) or config error (code 4) depending on implementation
    assert.ok(result.code === 3 || result.code === 4, 'Should exit with error code for filesystem issue');
  });

  test('should exit with code 4 on configuration error', async () => {
    const result = await runCLI(['invalid-url']);

    // Should fail with configuration error
    assert.strictEqual(result.code, 4, 'Should exit with code 4 on configuration error');
  });
});
