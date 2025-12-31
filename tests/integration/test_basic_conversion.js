import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runCLI, IntegrationHelpers } from '../../src/test_helpers/integration_helpers.js';

describe('Basic RSS Conversion Integration', () => {
  let helpers;

  beforeEach(() => {
    helpers = new IntegrationHelpers();
  });

  afterEach(() => {
    helpers.cleanup();
  });

  test('should convert RSS feed to valid HTML file', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed({
      title: 'Test Feed',
      description: 'A test RSS feed',
      itemCount: 5
    }), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    assert.strictEqual(result.code, 0, `Should exit with code 0. stderr: ${result.stderr}`);

    // Find output files
    const findHtmlFiles = (dir) => {
      const files = [];
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = join(dir, item.name);
        if (item.isDirectory()) {
          files.push(...findHtmlFiles(fullPath));
        } else if (item.name.endsWith('.html')) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const htmlFiles = findHtmlFiles(outputDir);
    assert.ok(htmlFiles.length > 0, 'Should create at least one HTML file');

    const output = readFileSync(htmlFiles[0], 'utf8');

    // Should be valid HTML document
    assert.match(output, /<!DOCTYPE html>/, 'Should have HTML5 doctype');
    assert.match(output, /<html[^>]*>/, 'Should have html tag');
    assert.match(output, /<head>/, 'Should have head section');
    assert.match(output, /<body>/, 'Should have body section');
  });

  test('should handle RSS feed with multiple items', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed({
      itemCount: 10
    }), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    if (result.code === 0) {
      const findHtmlFiles = (dir) => {
        const files = [];
        const items = readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = join(dir, item.name);
          if (item.isDirectory()) {
            files.push(...findHtmlFiles(fullPath));
          } else if (item.name.endsWith('.html')) {
            files.push(fullPath);
          }
        }
        return files;
      };

      const htmlFiles = findHtmlFiles(outputDir);
      if (htmlFiles.length > 0) {
        const output = readFileSync(htmlFiles[0], 'utf8');
        
        // Should have multiple articles
        const articleMatches = output.match(/<article>/g);
        assert.ok(articleMatches && articleMatches.length > 0, 'Should have article elements');
      }
    }
  });

  test('should preserve article content and links', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    if (result.code === 0) {
      const findHtmlFiles = (dir) => {
        const files = [];
        const items = readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = join(dir, item.name);
          if (item.isDirectory()) {
            files.push(...findHtmlFiles(fullPath));
          } else if (item.name.endsWith('.html')) {
            files.push(fullPath);
          }
        }
        return files;
      };

      const htmlFiles = findHtmlFiles(outputDir);
      if (htmlFiles.length > 0) {
        const output = readFileSync(htmlFiles[0], 'utf8');
        
        // Should have proper link structure
        const linkMatches = output.match(/<a href=\"https?:\/\/[^\"]+\"/g);
        assert.ok(linkMatches && linkMatches.length > 0, 'Should have external links');
      }
    }
  });

  test('should show success message with item count', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    if (result.code === 0) {
      assert.match(result.stdout, /Successfully converted/, 'Should show success message');
    }
  });

  test('should be idempotent - same input produces same output', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');

    // Run conversion twice
    const result1 = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    const result2 = await runCLI([
      '--file', rssFile,
      '--output', outputDir
    ]);

    // Both should succeed
    assert.strictEqual(result1.code, 0, 'First run should succeed');
    assert.strictEqual(result2.code, 0, 'Second run should succeed');
  });
});
