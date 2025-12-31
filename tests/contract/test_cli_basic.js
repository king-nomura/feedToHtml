import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { runCLI, IntegrationHelpers } from '../../src/test_helpers/integration_helpers.js';

describe('CLI Basic Usage Contract', () => {
  let helpers;

  beforeEach(() => {
    helpers = new IntegrationHelpers();
  });

  afterEach(() => {
    helpers.cleanup();
  });

  test('should accept RSS URL and output directory option', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    // Should succeed with valid arguments
    assert.strictEqual(result.code, 0, `Should exit with code 0 on success. stderr: ${result.stderr}`);
    assert.match(result.stdout, /Successfully converted/, 'Should show success message');
  });

  test('should show error when missing arguments', async () => {
    const result = await runCLI([]);

    // Should fail with missing arguments
    assert.notStrictEqual(result.code, 0, 'Should exit with non-zero code on error');
    assert.match(result.stderr, /RSS URL|required/i, 'Should show error about missing URL');
  });

  test('should show help with --help flag', async () => {
    const result = await runCLI(['--help']);

    // Should succeed and show help
    assert.strictEqual(result.code, 0, 'Should exit with code 0 for help');
    assert.match(result.stdout, /USAGE:/i, 'Should show usage information');
  });

  test('should validate RSS URL format', async () => {
    const result = await runCLI(['invalid-url']);

    // Should fail with invalid URL
    assert.strictEqual(result.code, 4, 'Should exit with code 4 for configuration error');
  });
});
