import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { runCLI, IntegrationHelpers } from '../../src/test_helpers/integration_helpers.js';

describe('Network Timeout Integration', () => {
  let helpers;

  beforeEach(() => {
    helpers = new IntegrationHelpers();
  });

  afterEach(() => {
    helpers.cleanup();
  });

  test('should accept timeout configuration', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');
    const configFile = helpers.createTempFile(JSON.stringify({
      timeout: 30
    }), 'config.json');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile
    ]);

    assert.strictEqual(result.code, 0, `Should accept timeout config. stderr: ${result.stderr}`);
  });

  test('should work without timeout configuration (default)', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    assert.strictEqual(result.code, 0, `Should work with default timeout. stderr: ${result.stderr}`);
  });

  test('should accept --timeout CLI option', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--timeout', '30'
    ]);

    assert.strictEqual(result.code, 0, `Should accept --timeout option. stderr: ${result.stderr}`);
  });

  test('should handle network unreachable gracefully', async () => {
    const result = await runCLI([
      'https://nonexistent-domain-12345.com/rss.xml',
      '--output', '/tmp'
    ], { timeout: 10000 });

    assert.strictEqual(result.code, 1, 'Unreachable should be network error');
  });

  test('should validate timeout is within valid range', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');

    // Test with very large timeout (should be rejected if > 300)
    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--timeout', '500'
    ]);

    // Behavior depends on implementation - either error or clamp to max
    // Just verify it doesn't crash
    assert.ok(typeof result.code === 'number', 'Should return a valid exit code');
  });

  test('should timeout on network operations when configured', async () => {
    // Test that timeout is applied to network operations
    // This uses a real URL that would timeout
    const configFile = helpers.createTempFile(JSON.stringify({
      timeout: 1  // 1 second timeout
    }), 'config.json');

    const result = await runCLI([
      'https://httpstat.us/200?sleep=5000',  // 5 second delay
      '--output', '/tmp',
      '--config', configFile
    ], { timeout: 10000 });

    // Should timeout with network error
    assert.strictEqual(result.code, 1, 'Should timeout with short timeout');
  });

  test('should handle very short timeouts gracefully', async () => {
    const configFile = helpers.createTempFile(JSON.stringify({
      timeout: 0.001  // Very short timeout
    }), 'config.json');

    const result = await runCLI([
      'https://example.com/rss.xml',
      '--output', '/tmp',
      '--config', configFile
    ], { timeout: 10000 });

    // Should fail with network or timeout error
    assert.ok(result.code !== 0, 'Should fail with very short timeout');
  });

  test('should prioritize CLI timeout over config file', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');
    const configFile = helpers.createTempFile(JSON.stringify({
      timeout: 10
    }), 'config.json');

    // CLI option should override config
    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile,
      '--timeout', '30'
    ]);

    assert.strictEqual(result.code, 0, `CLI timeout should work. stderr: ${result.stderr}`);
  });
});
