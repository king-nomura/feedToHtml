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

  test('literal $$ in item description is preserved (no $-special corruption)', () => {
    const engine = new TemplateEngine();
    const html = engine.generateItemHTML(
      makeItem({ description: 'price a$$b' })
    );
    assert.ok(html.includes('price a$$b'),
      '$$ must be preserved literally, not collapsed to $');
  });

  test('literal $$ in feed title is preserved through generateHTML', () => {
    const engine = new TemplateEngine();
    const template = { content: '<h1>{{FEED_TITLE}}</h1>{{ITEMS}}' };
    const feed = makeFeed({ title: 'cost a$$b', items: [] });
    const html = engine.generateHTML(feed, template, {});
    assert.ok(html.includes('cost a$$b'),
      '$$ must be preserved literally in the template substitution path');
  });
});

describe('TemplateEngine description rich text', () => {
  test('ITEM_DESCRIPTION allows <br> and <a>', () => {
    const engine = new TemplateEngine();
    const html = engine.generateItemHTML(
      makeItem({ description: 'line1<br>line2 <a href="https://e.com">link</a>' })
    );
    assert.ok(html.includes('line1<br>line2'), '<br> must be preserved');
    assert.ok(
      html.includes('<a href="https://e.com" rel="nofollow noopener" target="_blank">link</a>'),
      '<a> must be preserved with rel/target'
    );
  });

  test('ITEM_DESCRIPTION strips disallowed tags but keeps content', () => {
    const engine = new TemplateEngine();
    const html = engine.generateItemHTML(
      makeItem({ description: '<script>alert(1)</script><p>hello</p>' })
    );
    assert.ok(!html.includes('<script>'), 'script tag must be stripped');
    assert.ok(html.includes('alert(1)hello'), 'inner text must remain');
  });

  test('ITEM_TITLE still fully escapes tags (not rich text)', () => {
    const engine = new TemplateEngine();
    const html = engine.generateItemHTML(
      makeItem({ title: 'hi<br>there' })
    );
    assert.ok(html.includes('hi&lt;br&gt;there'), 'title <br> must stay escaped');
    assert.ok(!html.includes('hi<br>there'), 'title must not get live <br>');
  });
});
