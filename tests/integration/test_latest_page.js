import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCLI, IntegrationHelpers } from '../../src/test_helpers/integration_helpers.js';

describe('Latest Page Redirect Integration', () => {
  let helpers;

  beforeEach(() => {
    helpers = new IntegrationHelpers();
  });

  afterEach(() => {
    helpers.cleanup();
  });

  test('should generate redirect HTML when latestPage is configured', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed({
      title: 'Test Feed',
      itemCount: 3
    }), 'test.xml');

    const configDir = helpers.createTempDir();
    const configFile = join(configDir, 'config.json');
    writeFileSync(configFile, JSON.stringify({
      outputDir: outputDir,
      latestPage: 'latest.html'
    }), 'utf-8');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile
    ]);

    assert.strictEqual(result.code, 0, `Should exit with code 0. stderr: ${result.stderr}`);

    const latestPagePath = join(outputDir, 'latest.html');
    assert.ok(existsSync(latestPagePath), 'latest.html should be created');

    const content = readFileSync(latestPagePath, 'utf-8');
    assert.match(content, /meta http-equiv="refresh"/, 'Should contain meta refresh tag');
    assert.match(content, /\.html/, 'Should reference an HTML file');
  });

  test('should not generate redirect HTML when latestPage is not configured', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed({
      title: 'Test Feed',
      itemCount: 3
    }), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    assert.strictEqual(result.code, 0, `Should exit with code 0. stderr: ${result.stderr}`);

    const latestPagePath = join(outputDir, 'latest.html');
    assert.ok(!existsSync(latestPagePath), 'latest.html should not be created');
  });

  test('should reject config with path traversal in latestPage', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed({
      itemCount: 3
    }), 'test.xml');

    const configDir = helpers.createTempDir();
    const configFile = join(configDir, 'config.json');
    writeFileSync(configFile, JSON.stringify({
      outputDir: outputDir,
      latestPage: '../escape.html'
    }), 'utf-8');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile
    ]);

    assert.notStrictEqual(result.code, 0, 'Should fail with path traversal');
  });
});
