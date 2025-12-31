import { readFileSync, existsSync } from 'node:fs';
import { OutboxItem } from '../models/outbox_item.js';
import { OutboxFeed } from '../models/outbox_feed.js';

/**
 * Parser for ActivityPub outbox JSON
 * Fetches and parses ActivityPub outbox data from URL or local file
 */
export class OutboxParser {
  /**
   * Create an OutboxParser instance
   * @param {Object} options - Parser options
   * @param {number} [options.timeout=60000] - Fetch timeout in milliseconds
   */
  constructor(options = {}) {
    this.timeout = options.timeout || 60000;
  }

  /**
   * Fetch and parse ActivityPub outbox from URL
   * @param {string} url - Outbox URL
   * @param {number} [timeout] - Optional timeout override
   * @returns {Promise<OutboxFeed>} Parsed outbox feed
   */
  async fetchAndParse(url, timeout) {
    const effectiveTimeout = timeout || this.timeout;
    const jsonContent = await this.fetchOutbox(url, effectiveTimeout * 1000);
    return this.parseJSON(jsonContent, { link: url });
  }

  /**
   * Parse outbox from local JSON file
   * @param {string} filePath - Path to JSON file
   * @param {Object} [options] - Parse options
   * @param {string} [options.title] - Override title
   * @param {string} [options.description] - Override description
   * @returns {OutboxFeed} Parsed outbox feed
   */
  parseFromFile(filePath, options = {}) {
    try {
      if (!existsSync(filePath)) {
        throw new Error(`FILESYSTEM Outbox file not found: ${filePath}`);
      }

      const jsonContent = readFileSync(filePath, 'utf-8');
      return this.parseJSON(jsonContent, options);
    } catch (error) {
      if (error.message.startsWith('FILESYSTEM') || error.message.startsWith('PARSE')) {
        throw error;
      }

      throw new Error(`FILESYSTEM Failed to read outbox file: ${error.message}`);
    }
  }

  /**
   * Fetch outbox JSON from URL
   * @param {string} url - Outbox URL
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<string>} JSON content as string
   */
  async fetchOutbox(url, timeout) {
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`CONFIG Invalid outbox URL format: ${url}`);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'outboxToHtml/1.0.0 (ActivityPub to HTML converter)',
          'Accept': 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams", application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        console.warn(`Warning: Content-Type is not JSON: ${contentType}`);
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`timeout after ${timeout / 1000} seconds`);
      }

      throw error;
    }
  }

  /**
   * Parse JSON content into OutboxFeed
   * @param {string} jsonContent - JSON string to parse
   * @param {Object} [options] - Parse options
   * @param {string} [options.title] - Override title
   * @param {string} [options.description] - Override description
   * @param {string} [options.link] - Outbox URL
   * @returns {OutboxFeed} Parsed outbox feed
   */
  parseJSON(jsonContent, options = {}) {
    let data;
    try {
      data = JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`PARSE Invalid JSON: ${error.message}`);
    }

    return this.parseOutbox(data, options);
  }

  /**
   * Parse outbox data object into OutboxFeed
   * @param {Object} data - Parsed JSON data
   * @param {Object} [options] - Parse options
   * @returns {OutboxFeed} Parsed outbox feed
   */
  parseOutbox(data, options = {}) {
    // Get orderedItems array
    const orderedItems = data.orderedItems;
    if (!orderedItems || !Array.isArray(orderedItems)) {
      throw new Error('PARSE orderedItems array not found in outbox');
    }

    // Filter and parse items
    const items = orderedItems
      .filter(activity => this.isValidActivity(activity))
      .map(activity => this.parseActivity(activity));

    if (items.length === 0) {
      throw new Error('PARSE No valid items found in outbox (all filtered out or empty)');
    }

    // Create OutboxFeed
    return new OutboxFeed({
      title: options.title || 'ActivityPub Outbox',
      description: options.description || '',
      link: options.link || '',
      language: '',
      lastBuildDate: items.length > 0 && items[0].pubDate ? items[0].pubDate : null,
      items
    });
  }

  /**
   * Check if activity is valid for inclusion
   * @param {Object} activity - Activity object
   * @returns {boolean} True if activity should be included
   */
  isValidActivity(activity) {
    // Filter out direct messages
    if (activity.directMessage === true) {
      return false;
    }

    // Filter out sensitive content
    if (activity.object?.sensitive === true) {
      return false;
    }

    // Must have an id
    if (!activity.id) {
      return false;
    }

    // Must have content
    if (!activity.object?.content) {
      return false;
    }

    return true;
  }

  /**
   * Parse single activity into OutboxItem
   * @param {Object} activity - Activity object
   * @returns {OutboxItem} Parsed outbox item
   */
  parseActivity(activity) {
    return OutboxItem.fromActivityPub(activity);
  }

  /**
   * Validate parsed outbox feed
   * @param {OutboxFeed} feed - Feed to validate
   * @throws {Error} If validation fails
   */
  validateFeed(feed) {
    if (!feed) {
      throw new Error('PARSE Feed is null or undefined');
    }

    if (!feed.items || feed.items.length === 0) {
      throw new Error('PARSE Feed contains no valid items');
    }

    // Validate each item has required fields
    feed.items.forEach((item, index) => {
      if (!item.link) {
        throw new Error(`PARSE Item at index ${index} is missing required link field`);
      }
    });
  }
}
