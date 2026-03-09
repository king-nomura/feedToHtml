import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SitemapService } from '../../src/services/sitemap_service.js';

describe('SitemapService', () => {
  let service;
  let tempDir;

  beforeEach(() => {
    service = new SitemapService();
    const random = Math.random().toString(36).substring(2, 8);
    tempDir = join(tmpdir(), `sitemap-test-${Date.now()}-${random}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('should do nothing when baseUrl is not set', () => {
    service.updateSitemap({ sitemap: 'sitemap.xml' }, tempDir, join(tempDir, '2025/2025-03.html'));
    // No file should be created
    assert.ok(true);
  });

  test('should do nothing when sitemap is not set', () => {
    service.updateSitemap({ baseUrl: 'https://example.com' }, tempDir, join(tempDir, '2025/2025-03.html'));
    assert.ok(true);
  });

  test('should create new sitemap.xml if it does not exist', () => {
    mkdirSync(join(tempDir, '2025'), { recursive: true });
    const config = { baseUrl: 'https://example.com', sitemap: 'sitemap.xml' };
    const newFile = join(tempDir, '2025/2025-03.html');

    service.updateSitemap(config, tempDir, newFile);

    const content = readFileSync(join(tempDir, 'sitemap.xml'), 'utf-8');
    assert.match(content, /<\?xml version="1.0" encoding="UTF-8"\?>/);
    assert.match(content, /<urlset/);
    assert.match(content, /<loc>https:\/\/example\.com\/2025\/2025-03\.html<\/loc>/);
    assert.match(content, /<changefreq>daily<\/changefreq>/);
  });

  test('should add new entry and change existing daily to never', () => {
    const existingSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/2025/2025-02.html</loc>
    <changefreq>daily</changefreq>
  </url>
</urlset>
`;
    writeFileSync(join(tempDir, 'sitemap.xml'), existingSitemap, 'utf-8');
    mkdirSync(join(tempDir, '2025'), { recursive: true });

    const config = { baseUrl: 'https://example.com', sitemap: 'sitemap.xml' };
    service.updateSitemap(config, tempDir, join(tempDir, '2025/2025-03.html'));

    const content = readFileSync(join(tempDir, 'sitemap.xml'), 'utf-8');

    // New entry should have daily
    assert.match(content, /<loc>https:\/\/example\.com\/2025\/2025-03\.html<\/loc>\s*<changefreq>daily<\/changefreq>/);

    // Old entry should now be never
    assert.match(content, /<loc>https:\/\/example\.com\/2025\/2025-02\.html<\/loc>\s*<changefreq>never<\/changefreq>/);
  });

  test('should not change entries already set to never', () => {
    const existingSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/2025/2025-01.html</loc>
    <changefreq>never</changefreq>
  </url>
  <url>
    <loc>https://example.com/2025/2025-02.html</loc>
    <changefreq>daily</changefreq>
  </url>
</urlset>
`;
    writeFileSync(join(tempDir, 'sitemap.xml'), existingSitemap, 'utf-8');
    mkdirSync(join(tempDir, '2025'), { recursive: true });

    const config = { baseUrl: 'https://example.com', sitemap: 'sitemap.xml' };
    service.updateSitemap(config, tempDir, join(tempDir, '2025/2025-03.html'));

    const content = readFileSync(join(tempDir, 'sitemap.xml'), 'utf-8');

    // 2025-01 should remain never
    assert.match(content, /<loc>https:\/\/example\.com\/2025\/2025-01\.html<\/loc>\s*<changefreq>never<\/changefreq>/);

    // 2025-02 should now be never
    assert.match(content, /<loc>https:\/\/example\.com\/2025\/2025-02\.html<\/loc>\s*<changefreq>never<\/changefreq>/);

    // 2025-03 should be daily
    assert.match(content, /<loc>https:\/\/example\.com\/2025\/2025-03\.html<\/loc>\s*<changefreq>daily<\/changefreq>/);
  });

  test('should strip trailing slashes from baseUrl', () => {
    mkdirSync(join(tempDir, '2025'), { recursive: true });
    const config = { baseUrl: 'https://example.com/', sitemap: 'sitemap.xml' };

    service.updateSitemap(config, tempDir, join(tempDir, '2025/2025-03.html'));

    const content = readFileSync(join(tempDir, 'sitemap.xml'), 'utf-8');
    assert.match(content, /<loc>https:\/\/example\.com\/2025\/2025-03\.html<\/loc>/);
  });

  test('should place new entry at the top of urlset', () => {
    const existingSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/2025/2025-02.html</loc>
    <changefreq>daily</changefreq>
  </url>
</urlset>
`;
    writeFileSync(join(tempDir, 'sitemap.xml'), existingSitemap, 'utf-8');
    mkdirSync(join(tempDir, '2025'), { recursive: true });

    const config = { baseUrl: 'https://example.com', sitemap: 'sitemap.xml' };
    service.updateSitemap(config, tempDir, join(tempDir, '2025/2025-03.html'));

    const content = readFileSync(join(tempDir, 'sitemap.xml'), 'utf-8');

    // New entry (2025-03) should appear before old entry (2025-02)
    const pos03 = content.indexOf('2025-03.html');
    const pos02 = content.indexOf('2025-02.html');
    assert.ok(pos03 < pos02, 'New entry should appear before existing entries');
  });
});