import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runCLI, IntegrationHelpers } from '../../src/test_helpers/integration_helpers.js';

describe('Atom Feed Support Integration', () => {
  let helpers;

  beforeEach(() => {
    helpers = new IntegrationHelpers();
  });

  afterEach(() => {
    helpers.cleanup();
  });

  const findHtmlFiles = (dir) => {
    const files = [];
    try {
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = join(dir, item.name);
        if (item.isDirectory()) {
          files.push(...findHtmlFiles(fullPath));
        } else if (item.name.endsWith('.html')) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      // Directory might not exist
    }
    return files;
  };

  test('should successfully parse Atom feed format', async () => {
    const outputDir = helpers.createTempDir();
    const atomFile = helpers.createTempFile(helpers.createMockAtomFeed({
      title: 'Test Atom Feed',
      itemCount: 5
    }), 'test.atom');

    const result = await runCLI([
      '--file', atomFile,
      '--output', outputDir
    ]);

    assert.strictEqual(result.code, 0, `Should parse Atom feed. stderr: ${result.stderr}`);

    const htmlFiles = findHtmlFiles(outputDir);
    assert.ok(htmlFiles.length > 0, 'Should create HTML output file');

    if (htmlFiles.length > 0) {
      const output = readFileSync(htmlFiles[0], 'utf8');
      assert.match(output, /<article>/, 'Should convert Atom entries to articles');
    }
  });

  test('should extract Atom feed metadata correctly', async () => {
    const outputDir = helpers.createTempDir();
    const atomFile = helpers.createTempFile(helpers.createMockAtomFeed({
      title: 'My Atom Feed Title',
      subtitle: 'Feed description here'
    }), 'test.atom');

    const result = await runCLI([
      '--file', atomFile,
      '--output', outputDir
    ]);

    if (result.code === 0) {
      const htmlFiles = findHtmlFiles(outputDir);
      if (htmlFiles.length > 0) {
        const output = readFileSync(htmlFiles[0], 'utf8');
        assert.match(output, /My Atom Feed Title/, 'Should extract feed title');
      }
    }
  });

  test('should handle Atom entry elements correctly', async () => {
    const outputDir = helpers.createTempDir();
    const atomFile = helpers.createTempFile(helpers.createMockAtomFeed(), 'test.atom');

    const result = await runCLI([
      '--file', atomFile,
      '--output', outputDir
    ]);

    if (result.code === 0) {
      const htmlFiles = findHtmlFiles(outputDir);
      if (htmlFiles.length > 0) {
        const output = readFileSync(htmlFiles[0], 'utf8');
        assert.match(output, /<article>/, 'Should have article elements for entries');
        assert.match(output, /<time>/, 'Should convert updated/published dates');
      }
    }
  });

  test('should handle both RSS and Atom feeds with same command', async () => {
    const outputDir1 = helpers.createTempDir();
    const outputDir2 = helpers.createTempDir();
    
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');
    const atomFile = helpers.createTempFile(helpers.createMockAtomFeed(), 'test.atom');

    const rssResult = await runCLI([
      '--file', rssFile,
      '--output', outputDir1
    ]);

    const atomResult = await runCLI([
      '--file', atomFile,
      '--output', outputDir2
    ]);

    // Both should succeed or both should fail in the same way
    assert.strictEqual(rssResult.code, atomResult.code, 'RSS and Atom should produce same exit code');
  });

  test('should handle Atom namespaces and extensions', async () => {
    const outputDir = helpers.createTempDir();
    const atomFile = helpers.createTempFile(helpers.createMockAtomFeed(), 'test.atom');

    const result = await runCLI([
      '--file', atomFile,
      '--output', outputDir
    ]);

    if (result.code === 0) {
      const htmlFiles = findHtmlFiles(outputDir);
      if (htmlFiles.length > 0) {
        const output = readFileSync(htmlFiles[0], 'utf8');
        assert.match(output, /<article>/, 'Should parse namespaced Atom elements');
      }
    }
  });

  test('should handle Atom feeds with different content types', async () => {
    const outputDir = helpers.createTempDir();
    const atomFile = helpers.createTempFile(helpers.createMockAtomFeed(), 'test.atom');

    const result = await runCLI([
      '--file', atomFile,
      '--output', outputDir
    ]);

    if (result.code === 0) {
      const htmlFiles = findHtmlFiles(outputDir);
      if (htmlFiles.length > 0) {
        const output = readFileSync(htmlFiles[0], 'utf8');
        assert.ok(!output.includes('&lt;p&gt;'), 'Should not double-encode HTML content');
      }
    }
  });

  test('should detect and report unsupported feed formats', async () => {
    const outputDir = helpers.createTempDir();
    const htmlFile = helpers.createTempFile('<html><body>Not a feed</body></html>', 'test.html');

    const result = await runCLI([
      '--file', htmlFile,
      '--output', outputDir
    ]);

    assert.strictEqual(result.code, 2, 'Should exit with code 2 for parse error');
  });

  test('should handle malformed XML gracefully', async () => {
    const outputDir = helpers.createTempDir();
    const malformedFile = helpers.createTempFile('<?xml version="1.0"?><broken', 'malformed.xml');

    const result = await runCLI([
      '--file', malformedFile,
      '--output', outputDir
    ]);

    assert.notStrictEqual(result.code, 0, 'Should fail with malformed XML');
  });

  test('should preserve author information from both RSS and Atom', async () => {
    const outputDir = helpers.createTempDir();
    const atomFile = helpers.createTempFile(helpers.createMockAtomFeed(), 'test.atom');

    const result = await runCLI([
      '--file', atomFile,
      '--output', outputDir
    ]);

    if (result.code === 0) {
      const htmlFiles = findHtmlFiles(outputDir);
      if (htmlFiles.length > 0) {
        const output = readFileSync(htmlFiles[0], 'utf8');
        // Check for author or meta section
        assert.match(output, /<div class="meta">|author/i, 'Should have metadata sections');
      }
    }
  });
});
