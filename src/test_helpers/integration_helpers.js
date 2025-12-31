import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Integration test helpers for feedToHtml
 */
export class IntegrationHelpers {
  constructor() {
    this.tempDirs = [];
    this.testFiles = [];
  }

  /**
   * Create temporary directory for testing
   * @param {string} [prefix='feedtohtml-test'] - Directory prefix
   * @returns {string} Temporary directory path
   */
  createTempDir(prefix = 'feedtohtml-test') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const dirName = `${prefix}-${timestamp}-${random}`;
    const dirPath = join(tmpdir(), dirName);

    mkdirSync(dirPath, { recursive: true });
    this.tempDirs.push(dirPath);

    return dirPath;
  }

  /**
   * Create temporary file with content
   * @param {string} content - File content
   * @param {string} [filename] - Filename
   * @param {string} [dir] - Directory (uses temp dir if not specified)
   * @returns {string} File path
   */
  createTempFile(content, filename = null, dir = null) {
    if (!dir) {
      dir = this.createTempDir();
    }

    if (!filename) {
      filename = `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.tmp`;
    }

    const filePath = join(dir, filename);
    writeFileSync(filePath, content, 'utf8');
    this.testFiles.push(filePath);

    return filePath;
  }

  /**
   * Create mock RSS feed XML
   * @param {Object} [options] - RSS feed options
   * @returns {string} RSS XML content
   */
  createMockRSSFeed(options = {}) {
    const {
      title = 'Test RSS Feed',
      description = 'Test RSS feed for integration testing',
      link = 'https://example.com',
      itemCount = 3
    } = options;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${title}</title>
    <description>${description}</description>
    <link>${link}</link>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
`;

    for (let i = 1; i <= itemCount; i++) {
      xml += `
    <item>
      <title>Test Item ${i}</title>
      <description>This is test item ${i} description with some content.</description>
      <link>https://example.com/item-${i}</link>
      <pubDate>${new Date(Date.now() - i * 24 * 60 * 60 * 1000).toUTCString()}</pubDate>
      <author>test@example.com</author>
      <category>Test Category ${i % 2 + 1}</category>
    </item>`;
    }

    xml += `
  </channel>
</rss>`;

    return xml;
  }

  /**
   * Create mock Atom feed XML
   * @param {Object} [options] - Atom feed options
   * @returns {string} Atom XML content
   */
  createMockAtomFeed(options = {}) {
    const {
      title = 'Test Atom Feed',
      subtitle = 'Test Atom feed for integration testing',
      link = 'https://example.com',
      itemCount = 3
    } = options;

    const feedId = 'urn:uuid:' + Date.now().toString(36);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${title}</title>
  <subtitle>${subtitle}</subtitle>
  <link href="${link}" />
  <id>${feedId}</id>
  <updated>${new Date().toISOString()}</updated>
`;

    for (let i = 1; i <= itemCount; i++) {
      const entryId = 'urn:uuid:' + (Date.now() + i).toString(36);
      xml += `
  <entry>
    <title>Test Entry ${i}</title>
    <link href="https://example.com/entry-${i}" />
    <id>${entryId}</id>
    <updated>${new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()}</updated>
    <summary>This is test entry ${i} summary with some content.</summary>
    <author>
      <name>Test Author ${i}</name>
      <email>test${i}@example.com</email>
    </author>
    <category term="Test Category ${i % 2 + 1}" />
  </entry>`;
    }

    xml += `
</feed>`;

    return xml;
  }

  /**
   * Create mock HTML template
   * @param {Object} [options] - Template options
   * @returns {string} HTML template content
   */
  createMockHTMLTemplate(options = {}) {
    const {
      title = '{{FEED_TITLE}}',
      includeStyles = true,
      includePagination = false
    } = options;

    let template = `<!DOCTYPE html>
<html lang="{{FEED_LANGUAGE}}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>`;

    if (includeStyles) {
      template += `
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #ccc; margin-bottom: 20px; }
        article { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
        .meta { color: #666; font-size: 0.9em; margin-bottom: 10px; }
        .content { line-height: 1.6; }
        .categories { margin-top: 10px; font-size: 0.9em; color: #888; }
    </style>`;
    }

    template += `
</head>
<body>
    <div class="header">
        <h1>{{FEED_TITLE}}</h1>
        <p>{{FEED_DESCRIPTION}}</p>
        <p><strong>Total Items:</strong> {{TOTAL_ITEMS}}</p>
    </div>

    <div class="content">
        {{ITEMS}}
    </div>`;

    if (includePagination) {
      template += `

    <div class="pagination">
        <p>Page {{PAGE_NUMBER}} of {{TOTAL_PAGES}}</p>
    </div>`;
    }

    template += `

    <div class="footer">
        <p><em>Generated on {{GENERATION_DATE}}</em></p>
    </div>
</body>
</html>`;

    return template;
  }

  /**
   * Create mock configuration
   * @param {Object} [options] - Configuration options
   * @returns {Object} Configuration object
   */
  createMockConfig(options = {}) {
    return {
      timeout: options.timeout || 30000,
      itemsPerPage: options.itemsPerPage || null,
      outputDir: options.outputDir || this.createTempDir(),
      template: options.template || null,
      userAgent: options.userAgent || 'feedToHtml-test/1.0.0',
      verbose: options.verbose || false,
      ...options
    };
  }

  /**
   * Create mock HTTP server response for RSS feeds
   * @param {string} content - RSS/Atom content
   * @param {Object} [options] - Response options
   * @returns {Object} Mock response
   */
  createMockResponse(content, options = {}) {
    return {
      ok: options.ok !== false,
      status: options.status || 200,
      statusText: options.statusText || 'OK',
      headers: new Map([
        ['content-type', options.contentType || 'application/rss+xml; charset=utf-8'],
        ['content-length', content.length.toString()],
        ...Object.entries(options.headers || {})
      ]),
      text: async () => content,
      ...options
    };
  }

  /**
   * Wait for specified time (for async testing)
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after timeout
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Assert file exists and has content
   * @param {string} filePath - File path to check
   * @param {string} [expectedContent] - Expected content (partial match)
   * @throws {Error} If file doesn't exist or content doesn't match
   */
  assertFileExists(filePath, expectedContent = null) {
    if (!existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    if (expectedContent !== null) {
      const content = readFileSync(filePath, 'utf8');
      if (!content.includes(expectedContent)) {
        throw new Error(`File content does not include expected text: ${expectedContent}`);
      }
    }
  }

  /**
   * Assert HTML file is valid
   * @param {string} filePath - HTML file path
   * @throws {Error} If HTML is not valid
   */
  assertValidHTML(filePath) {
    const content = readFileSync(filePath, 'utf8');

    // Basic HTML validation
    if (!content.includes('<!DOCTYPE html>')) {
      throw new Error('HTML file missing DOCTYPE declaration');
    }

    if (!content.includes('<html')) {
      throw new Error('HTML file missing html tag');
    }

    if (!content.includes('</html>')) {
      throw new Error('HTML file missing closing html tag');
    }

    if (!content.includes('<head>') || !content.includes('</head>')) {
      throw new Error('HTML file missing head section');
    }

    if (!content.includes('<body>') || !content.includes('</body>')) {
      throw new Error('HTML file missing body section');
    }
  }

  /**
   * Get file size in bytes
   * @param {string} filePath - File path
   * @returns {number} File size
   */
  getFileSize(filePath) {
    const { statSync } = require('node:fs');
    return statSync(filePath).size;
  }

  /**
   * Read JSON file
   * @param {string} filePath - JSON file path
   * @returns {Object} Parsed JSON
   */
  readJSONFile(filePath) {
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Create timeout promise for testing timeouts
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise} Promise that rejects with timeout error
   */
  createTimeoutPromise(ms) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Mock fetch function for testing
   * @param {string} url - URL to mock
   * @param {Object} response - Mock response
   * @returns {Function} Mock fetch function
   */
  createMockFetch(url, response) {
    return async (requestUrl, options) => {
      if (requestUrl === url) {
        return response;
      }
      throw new Error(`Network error: ${requestUrl}`);
    };
  }

  /**
   * Clean up all temporary files and directories
   */
  cleanup() {
    // Remove temporary files
    for (const filePath of this.testFiles) {
      try {
        if (existsSync(filePath)) {
          rmSync(filePath, { force: true });
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Remove temporary directories
    for (const dirPath of this.tempDirs) {
      try {
        if (existsSync(dirPath)) {
          rmSync(dirPath, { recursive: true, force: true });
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    this.testFiles = [];
    this.tempDirs = [];
  }

  /**
   * Create integration test suite structure
   * @param {string} suiteName - Test suite name
   * @returns {Object} Test suite configuration
   */
  createTestSuite(suiteName) {
    const tempDir = this.createTempDir(suiteName);
    const inputDir = join(tempDir, 'input');
    const outputDir = join(tempDir, 'output');
    const configDir = join(tempDir, 'config');

    mkdirSync(inputDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    mkdirSync(configDir, { recursive: true });

    return {
      name: suiteName,
      tempDir,
      inputDir,
      outputDir,
      configDir,
      cleanup: () => this.cleanup()
    };
  }
}


/**
 * Run CLI command and return result
 * @param {Array<string>} args - CLI arguments
 * @param {Object} [options] - Options
 * @returns {Promise<Object>} Result with code, stdout, stderr
 */
export async function runCLI(args, options = {}) {
  const { spawn } = await import('node:child_process');
  const { cwd = process.cwd(), timeout = 30000 } = options;

  return new Promise((resolve) => {
    const child = spawn('node', ['src/cli/main.js', ...args], {
      cwd,
      timeout,
      env: { ...process.env, ...options.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        code: code || 0,
        stdout,
        stderr
      });
    });

    child.on('error', (err) => {
      resolve({
        code: 1,
        stdout,
        stderr: err.message
      });
    });
  });
}
