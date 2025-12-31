import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { runCLI, IntegrationHelpers } from '../../src/test_helpers/integration_helpers.js';

describe('CLI Config File Contract', () => {
  let helpers;

  beforeEach(() => {
    helpers = new IntegrationHelpers();
  });

  afterEach(() => {
    helpers.cleanup();
  });

  test('should accept --config parameter', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');
    const configContent = JSON.stringify({
      timeout: 30
    });
    const configFile = helpers.createTempFile(configContent, 'config.json');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile
    ]);

    // Should accept config parameter
    assert.strictEqual(result.code, 0, `Should exit with code 0 when config is valid. stderr: ${result.stderr}`);
  });

  test('should error when config file does not exist', async () => {
    const result = await runCLI([
      'https://example.com/rss.xml',
      '--config', 'nonexistent-config.json'
    ]);

    // Should fail with missing config file
    assert.strictEqual(result.code, 4, 'Should exit with code 4 for configuration error');
  });

  test('should error when config file has invalid JSON', async () => {
    const invalidConfigFile = helpers.createTempFile('{ invalid json }', 'invalid-config.json');

    const result = await runCLI([
      'https://example.com/rss.xml',
      '--config', invalidConfigFile
    ]);

    // Should fail with invalid JSON
    assert.strictEqual(result.code, 4, 'Should exit with code 4 for configuration error');
  });

  test('should validate config schema', async () => {
    const configContent = JSON.stringify({
      timeout: 'invalid'  // Invalid: should be number
    });
    const configFile = helpers.createTempFile(configContent, 'invalid-schema-config.json');

    const result = await runCLI([
      'https://example.com/rss.xml',
      '--config', configFile
    ]);

    // Should fail with invalid config values
    assert.strictEqual(result.code, 4, 'Should exit with code 4 for configuration error');
  });
});
