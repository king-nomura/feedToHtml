import { describe, it } from 'node:test';
import assert from 'node:assert';
import { OutboxItem } from '../../src/models/outbox_item.js';

describe('OutboxItem', () => {
  describe('constructor', () => {
    it('should create an OutboxItem with required fields', () => {
      const item = new OutboxItem({
        link: 'https://example.com/post/1',
        description: 'Test content'
      });

      assert.strictEqual(item.link, 'https://example.com/post/1');
      assert.strictEqual(item.description, 'Test content');
      assert.strictEqual(item.title, '');
      assert.strictEqual(item.author, '');
      assert.strictEqual(item.guid, '');
      assert.deepStrictEqual(item.categories, []);
      assert.strictEqual(item.pubDate, null);
    });

    it('should create an OutboxItem with all fields', () => {
      const pubDate = new Date('2025-10-03T00:46:10.899Z');
      const item = new OutboxItem({
        title: 'Optional Title',
        description: 'Test content',
        link: 'https://example.com/post/1',
        pubDate: pubDate,
        author: 'Author Name',
        guid: 'unique-id-123',
        categories: ['tech', 'ai']
      });

      assert.strictEqual(item.title, 'Optional Title');
      assert.strictEqual(item.description, 'Test content');
      assert.strictEqual(item.link, 'https://example.com/post/1');
      assert.strictEqual(item.pubDate, pubDate);
      assert.strictEqual(item.author, 'Author Name');
      assert.strictEqual(item.guid, 'unique-id-123');
      assert.deepStrictEqual(item.categories, ['tech', 'ai']);
    });

    it('should throw error for missing link', () => {
      assert.throws(() => {
        new OutboxItem({
          description: 'Test content'
        });
      }, /Item link is required/);
    });

    it('should throw error for invalid link URL', () => {
      assert.throws(() => {
        new OutboxItem({
          link: 'not-a-valid-url',
          description: 'Test content'
        });
      }, /Item link must be a valid URL/);
    });
  });

  describe('fromActivityPub', () => {
    it('should create OutboxItem from ActivityPub activity', () => {
      const activity = {
        id: 'https://social.example.com/activities/123',
        object: {
          content: 'Test post content'
        },
        published: '2025-10-03T00:46:10.899592Z'
      };

      const item = OutboxItem.fromActivityPub(activity);

      assert.strictEqual(item.link, 'https://social.example.com/activities/123');
      assert.strictEqual(item.guid, 'https://social.example.com/activities/123');
      assert.strictEqual(item.description, 'Test post content');
      assert.strictEqual(item.title, '');
      assert.ok(item.pubDate instanceof Date);
    });

    it('should handle activity without published date', () => {
      const activity = {
        id: 'https://social.example.com/activities/456',
        object: {
          content: 'Test content'
        }
      };

      const item = OutboxItem.fromActivityPub(activity);

      assert.strictEqual(item.pubDate, null);
    });
  });

  describe('getFormattedPubDate', () => {
    it('should return formatted date', () => {
      const item = new OutboxItem({
        link: 'https://example.com/post/1',
        pubDate: new Date('2025-10-03T00:00:00Z')
      });

      assert.strictEqual(item.getFormattedPubDate(), '2025-10-03');
    });

    it('should return empty string when no pubDate', () => {
      const item = new OutboxItem({
        link: 'https://example.com/post/1'
      });

      assert.strictEqual(item.getFormattedPubDate(), '');
    });
  });

  describe('hasAuthor', () => {
    it('should return true when author is present', () => {
      const item = new OutboxItem({
        link: 'https://example.com/post/1',
        author: 'Test Author'
      });

      assert.strictEqual(item.hasAuthor(), true);
    });

    it('should return false when author is empty', () => {
      const item = new OutboxItem({
        link: 'https://example.com/post/1',
        author: ''
      });

      assert.ok(!item.hasAuthor(), 'hasAuthor should return falsy value for empty author');
    });
  });

  describe('hasCategories', () => {
    it('should return true when categories exist', () => {
      const item = new OutboxItem({
        link: 'https://example.com/post/1',
        categories: ['tech']
      });

      assert.strictEqual(item.hasCategories(), true);
    });

    it('should return false when categories is empty', () => {
      const item = new OutboxItem({
        link: 'https://example.com/post/1',
        categories: []
      });

      assert.strictEqual(item.hasCategories(), false);
    });
  });

  describe('toJSON', () => {
    it('should return plain object representation', () => {
      const item = new OutboxItem({
        title: 'Title',
        description: 'Content',
        link: 'https://example.com/post/1',
        pubDate: new Date('2025-10-03T00:00:00Z'),
        author: 'Author',
        guid: 'guid-123',
        categories: ['cat1', 'cat2']
      });

      const json = item.toJSON();

      assert.strictEqual(json.title, 'Title');
      assert.strictEqual(json.description, 'Content');
      assert.strictEqual(json.link, 'https://example.com/post/1');
      assert.strictEqual(json.author, 'Author');
      assert.strictEqual(json.guid, 'guid-123');
      assert.deepStrictEqual(json.categories, ['cat1', 'cat2']);
    });
  });
});
