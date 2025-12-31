import { XMLParser } from 'fast-xml-parser';
import { readFileSync, existsSync } from 'node:fs';
import { RSSFeed } from '../models/rss_feed.js';
import { RSSItem } from '../models/rss_item.js';

/**
 * RSS Parser Service for fetching and parsing RSS/Atom feeds
 */
export class RSSParser {
  constructor() {
    // Configure XML parser with options for both RSS and Atom
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
      parseTrueNumberOnly: false
    });
  }

  /**
   * Fetch and parse RSS/Atom feed from URL
   * @param {string} url - RSS/Atom feed URL
   * @param {number} [timeout=60] - Request timeout in seconds
   * @returns {Promise<RSSFeed>} Parsed RSS feed
   */
  async fetchAndParse(url, timeout = 60) {
    try {
      const xmlContent = await this.fetchFeed(url, timeout * 1000);
      return this.parseXML(xmlContent);
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`NETWORK Failed to fetch RSS feed: ${error.message}`);
      }

      if (error.message.includes('timeout')) {
        throw new Error(`NETWORK Failed to fetch RSS feed: timeout after ${timeout} seconds`);
      }

      if (error.message.startsWith('NETWORK') || error.message.startsWith('PARSE')) {
        throw error;
      }

      throw new Error(`NETWORK Failed to fetch RSS feed: ${error.message}`);
    }
  }


  /**
   * Parse RSS/Atom feed from local file
   * @param {string} filePath - Path to local feed file
   * @returns {RSSFeed} Parsed RSS feed
   */
  parseFromFile(filePath) {
    try {
      if (!existsSync(filePath)) {
        throw new Error(`FILESYSTEM Feed file not found: ${filePath}`);
      }

      const xmlContent = readFileSync(filePath, 'utf-8');
      return this.parseXML(xmlContent);
    } catch (error) {
      if (error.message.startsWith('FILESYSTEM') || error.message.startsWith('PARSE')) {
        throw error;
      }

      throw new Error(`FILESYSTEM Failed to read feed file: ${error.message}`);
    }
  }

  /**
   * Fetch RSS feed content from URL
   * @param {string} url - Feed URL
   * @param {number} timeout - Request timeout in milliseconds
   * @returns {Promise<string>} XML content
   */
  async fetchFeed(url, timeout) {
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`CONFIG Invalid RSS URL format: ${url}`);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'feedToHtml/1.0.0 (RSS to HTML converter)',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('xml') && !contentType.includes('rss') && !contentType.includes('atom')) {
        console.warn(`Warning: Content-Type is not XML/RSS/Atom: ${contentType}`);
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
   * Parse XML content into RSSFeed object
   * @param {string} xmlContent - XML content
   * @returns {RSSFeed} Parsed RSS feed
   */
  parseXML(xmlContent) {
    try {
      const parsedXML = this.xmlParser.parse(xmlContent);

      // Detect feed format
      if (parsedXML.rss) {
        return this.parseRSSFeed(parsedXML.rss);
      } else if (parsedXML.feed) {
        return this.parseAtomFeed(parsedXML.feed);
      } else {
        throw new Error('PARSE Invalid XML format: not a valid RSS or Atom feed');
      }
    } catch (error) {
      if (error.message.startsWith('PARSE')) {
        throw error;
      }

      throw new Error(`PARSE Invalid XML format in RSS feed: ${error.message}`);
    }
  }

  /**
   * Parse RSS 2.0 format
   * @param {Object} rssData - Parsed RSS XML data
   * @returns {RSSFeed} RSS feed object
   */
  parseRSSFeed(rssData) {
    const channel = rssData.channel;
    if (!channel) {
      throw new Error('PARSE RSS feed missing channel element');
    }

    const feedData = {
      title: this.extractText(channel.title),
      description: this.extractText(channel.description),
      link: this.extractText(channel.link),
      language: this.extractText(channel.language),
      lastBuildDate: this.parseDate(channel.lastBuildDate || channel.pubDate),
      items: []
    };

    // Parse RSS items
    const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);

    feedData.items = items.map(item => this.parseRSSItem(item));

    return new RSSFeed(feedData);
  }

  /**
   * Parse Atom format
   * @param {Object} atomData - Parsed Atom XML data
   * @returns {RSSFeed} RSS feed object (converted from Atom)
   */
  parseAtomFeed(atomData) {
    const feedData = {
      title: this.extractText(atomData.title),
      description: this.extractText(atomData.subtitle) || this.extractText(atomData.title),
      link: this.extractAtomLink(atomData.link),
      language: atomData['@_xml:lang'] || atomData.language || '',
      lastBuildDate: this.parseDate(atomData.updated),
      items: []
    };

    // Parse Atom entries
    const entries = Array.isArray(atomData.entry) ? atomData.entry : (atomData.entry ? [atomData.entry] : []);

    feedData.items = entries.map(entry => this.parseAtomEntry(entry));

    return new RSSFeed(feedData);
  }

  /**
   * Parse RSS item
   * @param {Object} item - RSS item data
   * @returns {RSSItem} RSS item object
   */
  parseRSSItem(item) {
    const itemData = {
      title: this.extractText(item.title),
      description: this.extractText(item.description),
      link: this.extractText(item.link),
      pubDate: this.parseDate(item.pubDate),
      author: this.extractText(item.author),
      guid: this.extractText(item.guid),
      categories: this.extractCategories(item.category)
    };

    return new RSSItem(itemData);
  }

  /**
   * Parse Atom entry
   * @param {Object} entry - Atom entry data
   * @returns {RSSItem} RSS item object (converted from Atom)
   */
  parseAtomEntry(entry) {
    const itemData = {
      title: this.extractText(entry.title),
      description: this.extractAtomContent(entry.content || entry.summary),
      link: this.extractAtomLink(entry.link),
      pubDate: this.parseDate(entry.published || entry.updated),
      author: this.extractAtomAuthor(entry.author),
      guid: this.extractText(entry.id),
      categories: this.extractAtomCategories(entry.category)
    };

    return new RSSItem(itemData);
  }

  /**
   * Extract text content from XML element
   * @param {*} element - XML element
   * @returns {string} Text content
   */
  extractText(element) {
    if (!element) return '';

    if (typeof element === 'string') return element;

    if (element['#text']) return String(element['#text']);

    if (typeof element === 'object' && element !== null) {
      return String(element);
    }

    return '';
  }

  /**
   * Extract Atom link URL
   * @param {*} link - Atom link element(s)
   * @returns {string} Link URL
   */
  extractAtomLink(link) {
    if (!link) return '';

    // Handle array of links - prefer alternate, then self, then any other type
    if (Array.isArray(link)) {
      // Try alternate first (standard for ATOM feeds)
      const alternateLink = link.find(l => l['@_rel'] === 'alternate');
      if (alternateLink && alternateLink['@_href']) {
        return alternateLink['@_href'];
      }

      // Try self link as fallback (common in social media feeds)
      const selfLink = link.find(l => l['@_rel'] === 'self');
      if (selfLink && selfLink['@_href']) {
        return selfLink['@_href'];
      }

      // Try any link without rel attribute or with other rel types
      const anyLink = link.find(l => l['@_href'] && (!l['@_rel'] || l['@_rel'] !== 'next'));
      if (anyLink && anyLink['@_href']) {
        return anyLink['@_href'];
      }

      return '';
    }

    // Handle single link
    if (typeof link === 'object' && link['@_href']) {
      return link['@_href'];
    }

    return String(link);
  }

  /**
   * Extract Atom content
   * @param {*} content - Atom content element
   * @returns {string} Content text
   */
  extractAtomContent(content) {
    if (!content) return '';

    if (typeof content === 'string') return content;

    if (content['#text']) return content['#text'];

    if (content['@_type'] === 'html' || content['@_type'] === 'xhtml') {
      return content['#text'] || content.div || '';
    }

    return this.extractText(content);
  }

  /**
   * Extract Atom author
   * @param {*} author - Atom author element
   * @returns {string} Author name
   */
  extractAtomAuthor(author) {
    if (!author) return '';

    if (typeof author === 'string') return author;

    if (author.name) return this.extractText(author.name);

    if (author.email) return this.extractText(author.email);

    return this.extractText(author);
  }

  /**
   * Extract RSS categories
   * @param {*} category - RSS category element(s)
   * @returns {Array<string>} Category names
   */
  extractCategories(category) {
    if (!category) return [];

    if (Array.isArray(category)) {
      return category.map(cat => this.extractText(cat)).filter(cat => cat);
    }

    const catText = this.extractText(category);
    return catText ? [catText] : [];
  }

  /**
   * Extract Atom categories
   * @param {*} category - Atom category element(s)
   * @returns {Array<string>} Category names
   */
  extractAtomCategories(category) {
    if (!category) return [];

    if (Array.isArray(category)) {
      return category.map(cat => cat['@_term'] || cat['@_label'] || '').filter(cat => cat);
    }

    if (typeof category === 'object') {
      const term = category['@_term'] || category['@_label'] || '';
      return term ? [term] : [];
    }

    return [];
  }

  /**
   * Parse date string into Date object
   * @param {*} dateString - Date string
   * @returns {Date|null} Parsed date or null
   */
  parseDate(dateString) {
    if (!dateString) return null;

    const dateStr = this.extractText(dateString);
    if (!dateStr) return null;

    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate feed has minimum required content
   * @param {RSSFeed} feed - Feed to validate
   * @throws {Error} If feed doesn't meet minimum requirements
   */
  validateFeed(feed) {
    if (!feed.title || feed.title.trim().length === 0) {
      throw new Error('PARSE Feed must have a title');
    }

    if (!feed.items || feed.items.length === 0) {
      throw new Error('PARSE Feed must contain at least one item');
    }

    // Validate at least one item has required fields (title and link are sufficient)
    const validItems = feed.items.filter(item =>
      item.title && item.title.trim().length > 0 &&
      item.link && item.link.trim().length > 0
    );

    if (validItems.length === 0) {
      throw new Error('PARSE Feed must contain at least one item with title and link');
    }
  }
}