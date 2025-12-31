import { describe, it } from 'node:test';
import assert from 'node:assert';
import { OutboxParser } from '../../src/services/outbox_parser.js';

describe('OutboxParser', () => {
  describe('parseJSON', () => {
    it('should parse valid outbox JSON', () => {
      const parser = new OutboxParser();
      const jsonContent = JSON.stringify({
        orderedItems: [
          {
            directMessage: false,
            id: 'https://social.example.com/activities/1',
            object: {
              content: 'Test post 1',
              sensitive: false
            },
            published: '2025-10-03T00:46:10.899592Z'
          },
          {
            directMessage: false,
            id: 'https://social.example.com/activities/2',
            object: {
              content: 'Test post 2',
              sensitive: false
            },
            published: '2025-10-02T12:30:00.000000Z'
          }
        ]
      });

      const feed = parser.parseJSON(jsonContent);

      assert.strictEqual(feed.items.length, 2);
      assert.strictEqual(feed.items[0].link, 'https://social.example.com/activities/1');
      assert.strictEqual(feed.items[0].description, 'Test post 1');
    });

    it('should filter out direct messages', () => {
      const parser = new OutboxParser();
      const jsonContent = JSON.stringify({
        orderedItems: [
          {
            directMessage: false,
            id: 'https://social.example.com/activities/1',
            object: {
              content: 'Public post',
              sensitive: false
            },
            published: '2025-10-03T00:00:00Z'
          },
          {
            directMessage: true,
            id: 'https://social.example.com/activities/2',
            object: {
              content: 'Direct message',
              sensitive: false
            },
            published: '2025-10-02T00:00:00Z'
          }
        ]
      });

      const feed = parser.parseJSON(jsonContent);

      assert.strictEqual(feed.items.length, 1);
      assert.strictEqual(feed.items[0].description, 'Public post');
    });

    it('should filter out sensitive content', () => {
      const parser = new OutboxParser();
      const jsonContent = JSON.stringify({
        orderedItems: [
          {
            directMessage: false,
            id: 'https://social.example.com/activities/1',
            object: {
              content: 'Normal post',
              sensitive: false
            },
            published: '2025-10-03T00:00:00Z'
          },
          {
            directMessage: false,
            id: 'https://social.example.com/activities/2',
            object: {
              content: 'Sensitive post',
              sensitive: true
            },
            published: '2025-10-02T00:00:00Z'
          }
        ]
      });

      const feed = parser.parseJSON(jsonContent);

      assert.strictEqual(feed.items.length, 1);
      assert.strictEqual(feed.items[0].description, 'Normal post');
    });

    it('should throw error for invalid JSON', () => {
      const parser = new OutboxParser();

      assert.throws(() => {
        parser.parseJSON('not valid json');
      }, /PARSE Invalid JSON/);
    });

    it('should throw error for missing orderedItems', () => {
      const parser = new OutboxParser();
      const jsonContent = JSON.stringify({
        someOtherField: []
      });

      assert.throws(() => {
        parser.parseJSON(jsonContent);
      }, /PARSE orderedItems array not found/);
    });

    it('should throw error when all items are filtered', () => {
      const parser = new OutboxParser();
      const jsonContent = JSON.stringify({
        orderedItems: [
          {
            directMessage: true,
            id: 'https://social.example.com/activities/1',
            object: {
              content: 'DM only',
              sensitive: false
            },
            published: '2025-10-03T00:00:00Z'
          }
        ]
      });

      assert.throws(() => {
        parser.parseJSON(jsonContent);
      }, /PARSE No valid items found/);
    });
  });

  describe('isValidActivity', () => {
    it('should return true for valid activity', () => {
      const parser = new OutboxParser();
      const activity = {
        directMessage: false,
        id: 'https://example.com/1',
        object: {
          content: 'Test',
          sensitive: false
        }
      };

      assert.strictEqual(parser.isValidActivity(activity), true);
    });

    it('should return false for direct message', () => {
      const parser = new OutboxParser();
      const activity = {
        directMessage: true,
        id: 'https://example.com/1',
        object: {
          content: 'Test',
          sensitive: false
        }
      };

      assert.strictEqual(parser.isValidActivity(activity), false);
    });

    it('should return false for sensitive content', () => {
      const parser = new OutboxParser();
      const activity = {
        directMessage: false,
        id: 'https://example.com/1',
        object: {
          content: 'Test',
          sensitive: true
        }
      };

      assert.strictEqual(parser.isValidActivity(activity), false);
    });

    it('should return false for activity without id', () => {
      const parser = new OutboxParser();
      const activity = {
        directMessage: false,
        object: {
          content: 'Test',
          sensitive: false
        }
      };

      assert.strictEqual(parser.isValidActivity(activity), false);
    });

    it('should return false for activity without content', () => {
      const parser = new OutboxParser();
      const activity = {
        directMessage: false,
        id: 'https://example.com/1',
        object: {
          sensitive: false
        }
      };

      assert.strictEqual(parser.isValidActivity(activity), false);
    });
  });

  describe('parseFromFile', () => {
    it('should throw error for non-existent file', () => {
      const parser = new OutboxParser();

      assert.throws(() => {
        parser.parseFromFile('/non/existent/file.json');
      }, /FILESYSTEM Outbox file not found/);
    });
  });

  describe('validateFeed', () => {
    it('should throw error for null feed', () => {
      const parser = new OutboxParser();

      assert.throws(() => {
        parser.validateFeed(null);
      }, /PARSE Feed is null/);
    });

    it('should throw error for feed with no items', () => {
      const parser = new OutboxParser();
      const feed = { items: [] };

      assert.throws(() => {
        parser.validateFeed(feed);
      }, /PARSE Feed contains no valid items/);
    });
  });
});
