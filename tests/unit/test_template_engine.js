import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { TemplateEngine } from '../../src/services/template_engine.js';

function makeItem(overrides = {}) {
  return {
    title: 'T',
    link: 'http://example.com',
    description: '',
    pubDate: null,
    author: '',
    categories: [],
    hasAuthor() { return false; },
    hasCategories() { return false; },
    getCategoriesString() { return ''; },
    ...overrides
  };
}

function makeFeed(overrides = {}) {
  return {
    title: '',
    description: '',
    link: '',
    language: 'en',
    getItemCount() { return 0; },
    ...overrides
  };
}

describe('TemplateEngine XSS escaping', () => {
  test('ITEM_LINK attribute breakout is escaped (Vuln 1)', () => {
    const engine = new TemplateEngine();
    const html = engine.generateItemHTML(
      makeItem({ link: '"><img src=x onerror=alert(1)>' })
    );
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'),
      'raw <img> tag must not appear');
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'),
      'breakout payload must be HTML-escaped');
  });

  test('javascript: link becomes href="#" (Vuln 1)', () => {
    const engine = new TemplateEngine();
    const html = engine.generateItemHTML(
      makeItem({ link: 'javascript:alert(1)' })
    );
    assert.ok(html.includes('href="#"'), 'href should be neutralized to #');
    assert.ok(!html.includes('javascript:alert(1)'),
      'javascript: scheme must not survive');
  });

  test('ITEM_DESCRIPTION HTML is fully escaped (Vuln 2)', () => {
    const engine = new TemplateEngine();
    const html = engine.generateItemHTML(
      makeItem({ description: '<img src=x onerror=alert(1)>' })
    );
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'),
      'description HTML must be escaped');
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'),
      'raw <img> tag must not appear');
  });

  test('FEED_TITLE is escaped (Vuln 3)', () => {
    const engine = new TemplateEngine();
    const values = engine.prepareFeedValues(
      makeFeed({ title: '</title><script>alert(1)</script>' })
    );
    assert.ok(!values.FEED_TITLE.includes('<script>'),
      'raw <script> must not appear');
    assert.ok(values.FEED_TITLE.includes('&lt;script&gt;'),
      'title must be HTML-escaped');
  });

  test('FEED_LINK javascript: scheme is neutralized (Vuln 3)', () => {
    const engine = new TemplateEngine();
    const values = engine.prepareFeedValues(
      makeFeed({ link: 'javascript:alert(1)' })
    );
    assert.equal(values.FEED_LINK, '#');
  });

  test('legitimate values pass through correctly', () => {
    const engine = new TemplateEngine();
    const values = engine.prepareFeedValues(
      makeFeed({ title: 'My Feed', link: 'https://example.com', description: 'Hi' })
    );
    assert.equal(values.FEED_TITLE, 'My Feed');
    assert.equal(values.FEED_LINK, 'https://example.com');
    assert.equal(values.FEED_DESCRIPTION, 'Hi');
  });
});
