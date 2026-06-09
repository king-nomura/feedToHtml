import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCLI, IntegrationHelpers } from '../../src/test_helpers/integration_helpers.js';

describe('Sitemap Integration', () => {
  let helpers;

  beforeEach(() => {
    helpers = new IntegrationHelpers();
  });

  afterEach(() => {
    helpers.cleanup();
  });

  test('should generate sitemap.xml when baseUrl and sitemap are configured', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed({
      title: 'Test Feed',
      itemCount: 3
    }), 'test.xml');

    const configDir = helpers.createTempDir();
    const configFile = join(configDir, 'config.json');
    writeFileSync(configFile, JSON.stringify({
      outputDir: outputDir,
      baseUrl: 'https://example.com',
      sitemap: 'sitemap.xml'
    }), 'utf-8');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile
    ]);

    assert.strictEqual(result.code, 0, `Should exit with code 0. stderr: ${result.stderr}`);

    const sitemapPath = join(outputDir, 'sitemap.xml');
    assert.ok(existsSync(sitemapPath), 'sitemap.xml should be created');

    const content = readFileSync(sitemapPath, 'utf-8');
    assert.match(content, /<urlset/, 'Should contain urlset element');
    assert.match(content, /https:\/\/example\.com\//, 'Should contain base URL');
    assert.match(content, /<changefreq>daily<\/changefreq>/, 'Should have daily changefreq');
  });

  test('should not generate sitemap.xml when baseUrl is not configured', async () => {
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

    const sitemapPath = join(outputDir, 'sitemap.xml');
    assert.ok(!existsSync(sitemapPath), 'sitemap.xml should not be created');
  });

  test('should reject config with path traversal in sitemap', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed({
      itemCount: 3
    }), 'test.xml');

    const configDir = helpers.createTempDir();
    const configFile = join(configDir, 'config.json');
    writeFileSync(configFile, JSON.stringify({
      outputDir: outputDir,
      baseUrl: 'https://example.com',
      sitemap: '../escape.xml'
    }), 'utf-8');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile
    ]);

    assert.notStrictEqual(result.code, 0, 'Should fail with path traversal');
  });
});
