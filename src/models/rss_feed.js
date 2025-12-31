/**
 * RSSFeed model representing parsed RSS/Atom feed data
 */
export class RSSFeed {
  /**
   * Create an RSSFeed instance
   * @param {Object} feedData - Raw feed data
   * @param {string} feedData.title - Feed title
   * @param {string} feedData.description - Feed description
   * @param {string} [feedData.link] - Feed website URL (optional)
   * @param {string} [feedData.language] - Feed language
   * @param {Date} [feedData.lastBuildDate] - Last update timestamp
   * @param {Array} feedData.items - Array of feed items
   */
  constructor(feedData) {
    this.title = feedData.title;
    this.description = feedData.description;
    this.link = feedData.link;
    this.language = feedData.language || '';
    this.lastBuildDate = feedData.lastBuildDate || null;
    this.items = feedData.items || [];

    this.validate();
  }

  /**
   * Validate the RSS feed data
   * @throws {Error} If validation fails
   */
  validate() {
    if (!this.title || typeof this.title !== 'string' || this.title.trim().length === 0) {
      throw new Error('Feed title is required and must be a non-empty string');
    }

    if (!this.description || typeof this.description !== 'string' || this.description.trim().length === 0) {
      throw new Error('Feed description is required and must be a non-empty string');
    }

    // Link is optional - can be empty string, but if provided must be valid
    if (this.link && typeof this.link !== 'string') {
      throw new Error('Feed link must be a string when provided');
    }

    // Validate URL format if link is provided
    if (this.link && this.link.trim().length > 0) {
      try {
        new URL(this.link);
      } catch (error) {
        throw new Error(`Feed link must be a valid URL when provided: ${this.link}`);
      }
    }

    if (!Array.isArray(this.items)) {
      throw new Error('Feed items must be an array');
    }

    if (this.items.length === 0) {
      throw new Error('Feed must contain at least one item');
    }

    // Validate lastBuildDate if present
    if (this.lastBuildDate !== null && !(this.lastBuildDate instanceof Date)) {
      throw new Error('lastBuildDate must be a Date object or null');
    }

    // Validate language if present
    if (this.language && typeof this.language !== 'string') {
      throw new Error('Feed language must be a string');
    }
  }

  /**
   * Get a plain object representation of the feed
   * @returns {Object} Plain object with feed data
   */
  toJSON() {
    return {
      title: this.title,
      description: this.description,
      link: this.link,
      language: this.language,
      lastBuildDate: this.lastBuildDate,
      items: this.items.map(item => item.toJSON ? item.toJSON() : item)
    };
  }

  /**
   * Get the number of items in the feed
   * @returns {number} Number of feed items
   */
  getItemCount() {
    return this.items.length;
  }

  /**
   * Get items for a specific page (pagination)
   * @param {number} pageNumber - Page number (1-based)
   * @param {number} itemsPerPage - Number of items per page
   * @returns {Array} Array of items for the specified page
   */
  getItemsForPage(pageNumber, itemsPerPage) {
    if (pageNumber < 1) {
      throw new Error('Page number must be 1 or greater');
    }

    if (itemsPerPage < 1) {
      throw new Error('Items per page must be 1 or greater');
    }

    const startIndex = (pageNumber - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    return this.items.slice(startIndex, endIndex);
  }

  /**
   * Calculate total number of pages for pagination
   * @param {number} itemsPerPage - Number of items per page
   * @returns {number} Total number of pages
   */
  getTotalPages(itemsPerPage) {
    if (itemsPerPage < 1) {
      throw new Error('Items per page must be 1 or greater');
    }

    return Math.ceil(this.items.length / itemsPerPage);
  }

  /**
   * Get formatted last build date
   * @returns {string} Formatted date string or empty string if not available
   */
  getFormattedLastBuildDate() {
    if (!this.lastBuildDate) {
      return '';
    }

    return this.lastBuildDate.toISOString();
  }

  /**
   * Create RSSFeed from raw XML data (static factory method)
   * @param {Object} xmlData - Parsed XML data
   * @returns {RSSFeed} New RSSFeed instance
   */
  static fromXML(xmlData) {
    // This will be implemented by the RSS parser service
    throw new Error('fromXML method should be implemented by RSS parser service');
  }
}