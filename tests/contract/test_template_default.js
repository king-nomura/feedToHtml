import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(spawn);

describe('Default Template Contract', () => {
  test('should use default template when no template specified', async () => {
    const result = await execFile('node', [
      'src/cli/main.js',
      'https://example.com/valid-rss.xml',
      'default-output.html'
    ]).catch(err => err);

    if (result.code === 0) {
      const output = readFileSync('default-output.html', 'utf8');

      // Should be valid HTML5 document
      assert.match(output, /<!DOCTYPE html>/, 'Should have HTML5 doctype');
      assert.match(output, /<html[^>]*>/, 'Should have html tag');
      assert.match(output, /<head>/, 'Should have head section');
      assert.match(output, /<body>/, 'Should have body section');

      unlinkSync('default-output.html');
    }
  });

  test('should include required elements in default template', async () => {
    const result = await execFile('node', [
      'src/cli/main.js',
      'https://example.com/valid-rss.xml',
      'default-elements.html'
    ]).catch(err => err);

    if (result.code === 0) {
      const output = readFileSync('default-elements.html', 'utf8');

      // Should include required elements
      assert.match(output, /<title>/, 'Should have title element');
      assert.match(output, /<meta charset/, 'Should have charset meta tag');
      assert.match(output, /<h1>/, 'Should have main heading');
      assert.match(output, /<article>/, 'Should have article elements for feed items');

      unlinkSync('default-elements.html');
    }
  });

  test('should include basic CSS styling in default template', async () => {
    const result = await execFile('node', [
      'src/cli/main.js',
      'https://example.com/valid-rss.xml',
      'default-styled.html'
    ]).catch(err => err);

    if (result.code === 0) {
      const output = readFileSync('default-styled.html', 'utf8');

      // Should include basic styling
      assert.match(output, /<style>/, 'Should have style element');
      assert.match(output, /font-family/, 'Should include font styling');
      assert.match(output, /max-width/, 'Should include responsive design');

      unlinkSync('default-styled.html');
    }
  });

  test('should structure feed items as articles', async () => {
    const result = await execFile('node', [
      'src/cli/main.js',
      'https://example.com/valid-rss.xml',
      'article-structure.html'
    ]).catch(err => err);

    if (result.code === 0) {
      const output = readFileSync('article-structure.html', 'utf8');

      // Should structure items as articles
      assert.match(output, /<article>/, 'Should have article elements');
      assert.match(output, /<h2>.*<\/h2>/, 'Should have article headings');
      assert.match(output, /<time>/, 'Should have time elements for dates');
      assert.match(output, /<a href=".*">/, 'Should have links to original articles');

      unlinkSync('article-structure.html');
    }
  });

  test('should include generation date in default template', async () => {
    const result = await execFile('node', [
      'src/cli/main.js',
      'https://example.com/valid-rss.xml',
      'generation-date.html'
    ]).catch(err => err);

    if (result.code === 0) {
      const output = readFileSync('generation-date.html', 'utf8');

      // Should include generation timestamp
      assert.match(output, /Generated on/, 'Should show generation date');
      assert.match(output, /\d{4}-\d{2}-\d{2}/, 'Should include date in readable format');

      unlinkSync('generation-date.html');
    }
  });

  test('should be responsive and accessible', async () => {
    const result = await execFile('node', [
      'src/cli/main.js',
      'https://example.com/valid-rss.xml',
      'accessible-output.html'
    ]).catch(err => err);

    if (result.code === 0) {
      const output = readFileSync('accessible-output.html', 'utf8');

      // Should include accessibility features
      assert.match(output, /viewport/, 'Should have viewport meta tag');
      assert.match(output, /lang="/, 'Should have language attribute');
      assert.match(output, /<header>/, 'Should use semantic HTML elements');
      assert.match(output, /<main>/, 'Should have main content area');
      assert.match(output, /<footer>/, 'Should have footer element');

      unlinkSync('accessible-output.html');
    }
  });
});