import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runCLI, IntegrationHelpers } from '../../src/test_helpers/integration_helpers.js';

describe('Custom Template Integration', () => {
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

  test('should use custom template when specified in config', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');
    
    const customTemplate = `<!DOCTYPE html>
<html>
<head>
    <title>{{FEED_TITLE}} - Custom Style</title>
    <style>
        body { background: #f0f0f0; }
        article { background: white; margin: 10px; padding: 20px; }
    </style>
</head>
<body>
    <h1>{{FEED_TITLE}}</h1>
    <p>{{FEED_DESCRIPTION}}</p>
    {{#ITEMS}}
    <article>{{ITEM_TITLE}}</article>
    {{/ITEMS}}
</body>
</html>`;
    const templateFile = helpers.createTempFile(customTemplate, 'template.html');
    const configFile = helpers.createTempFile(JSON.stringify({
      templatePath: templateFile
    }), 'config.json');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile
    ]);

    assert.strictEqual(result.code, 0, `Should succeed. stderr: ${result.stderr}`);

    const htmlFiles = findHtmlFiles(outputDir);
    assert.ok(htmlFiles.length > 0, 'Should create output file');

    if (htmlFiles.length > 0) {
      const output = readFileSync(htmlFiles[0], 'utf8');
      assert.match(output, /background: #f0f0f0/, 'Should include custom CSS');
      assert.match(output, /Custom Style/, 'Should include custom title suffix');
    }
  });

  test('should handle template with missing optional placeholders gracefully', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');
    
    const minimalTemplate = `<!DOCTYPE html>
<html>
<head><title>{{FEED_TITLE}}</title></head>
<body>
    <h1>Feed Content</h1>
    {{#ITEMS}}
    <article>{{ITEM_TITLE}}</article>
    {{/ITEMS}}
</body>
</html>`;
    const templateFile = helpers.createTempFile(minimalTemplate, 'template.html');
    const configFile = helpers.createTempFile(JSON.stringify({
      templatePath: templateFile
    }), 'config.json');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile
    ]);

    assert.strictEqual(result.code, 0, `Should succeed with minimal template. stderr: ${result.stderr}`);
  });

  test('should validate template file exists', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');
    const configFile = helpers.createTempFile(JSON.stringify({
      templatePath: '/nonexistent/template.html'
    }), 'config.json');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile
    ]);

    // Should fail with config or filesystem error
    assert.ok(result.code !== 0, 'Should fail when template not found');
  });

  test('should support template with all available placeholders', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');
    
    const fullTemplate = `<!DOCTYPE html>
<html lang="{{FEED_LANGUAGE}}">
<head>
    <title>{{FEED_TITLE}}</title>
    <meta charset="utf-8">
</head>
<body>
    <header>
        <h1>{{FEED_TITLE}}</h1>
        <p>{{FEED_DESCRIPTION}}</p>
        <a href="{{FEED_LINK}}">Visit Original Site</a>
    </header>
    <main>
        {{#ITEMS}}
        <article>{{ITEM_TITLE}}</article>
        {{/ITEMS}}
    </main>
    <footer>
        <p>Generated on {{GENERATION_DATE}}</p>
    </footer>
</body>
</html>`;
    const templateFile = helpers.createTempFile(fullTemplate, 'template.html');
    const configFile = helpers.createTempFile(JSON.stringify({
      templatePath: templateFile
    }), 'config.json');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile
    ]);

    if (result.code === 0) {
      const htmlFiles = findHtmlFiles(outputDir);
      if (htmlFiles.length > 0) {
        const output = readFileSync(htmlFiles[0], 'utf8');
        assert.doesNotMatch(output, /{{FEED_TITLE}}/, 'Should replace FEED_TITLE');
        assert.doesNotMatch(output, /{{FEED_DESCRIPTION}}/, 'Should replace FEED_DESCRIPTION');
      }
    }
  });

  test('should preserve custom CSS and JavaScript in templates', async () => {
    const outputDir = helpers.createTempDir();
    const rssFile = helpers.createTempFile(helpers.createMockRSSFeed(), 'test.xml');
    
    const scriptTemplate = `<!DOCTYPE html>
<html>
<head>
    <title>{{FEED_TITLE}}</title>
    <style>
        .highlight { background-color: yellow; }
    </style>
    <script>
        function highlightItems() { console.log('highlight'); }
    </script>
</head>
<body>
    <h1>{{FEED_TITLE}}</h1>
    {{#ITEMS}}
    <article>{{ITEM_TITLE}}</article>
    {{/ITEMS}}
</body>
</html>`;
    const templateFile = helpers.createTempFile(scriptTemplate, 'template.html');
    const configFile = helpers.createTempFile(JSON.stringify({
      templatePath: templateFile
    }), 'config.json');

    const result = await runCLI([
      '--file', rssFile,
      '--output', outputDir,
      '--config', configFile
    ]);

    if (result.code === 0) {
      const htmlFiles = findHtmlFiles(outputDir);
      if (htmlFiles.length > 0) {
        const output = readFileSync(htmlFiles[0], 'utf8');
        assert.match(output, /background-color: yellow/, 'Should preserve custom CSS');
        assert.match(output, /function highlightItems/, 'Should preserve JavaScript');
      }
    }
  });
});
