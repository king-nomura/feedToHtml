/**
 * RSSItem model representing individual feed entry/article
 */
export class RSSItem {
  /**
   * Create an RSSItem instance
   * @param {Object} itemData - Raw item data
   * @param {string} itemData.title - Article title
   * @param {string} [itemData.description] - Article content/summary (optional)
   * @param {string} itemData.link - Article URL
   * @param {Date} [itemData.pubDate] - Publication date
   * @param {string} [itemData.author] - Article author
   * @param {string} [itemData.guid] - Unique identifier
   * @param {Array} [itemData.categories] - Article categories/tags
   */
  constructor(itemData) {
    this.title = itemData.title;
    this.description = itemData.description;
    this.link = itemData.link;
    this.pubDate = itemData.pubDate || null;
    this.author = itemData.author || '';
    this.guid = itemData.guid || '';
    this.categories = itemData.categories || [];

    this.validate();
  }

  /**
   * Validate the RSS item data
   * @throws {Error} If validation fails
   */
  validate() {
    if (!this.title || typeof this.title !== 'string' || this.title.trim().length === 0) {
      throw new Error('Item title is required and must be a non-empty string');
    }

    // Description is optional - can be empty string
    if (this.description && typeof this.description !== 'string') {
      throw new Error('Item description must be a string when provided');
    }

    if (!this.link || typeof this.link !== 'string') {
      throw new Error('Item link is required and must be a string');
    }

    // Validate URL format
    try {
      new URL(this.link);
    } catch (error) {
      throw new Error(`Item link must be a valid URL: ${this.link}`);
    }

    // Validate pubDate if present
    if (this.pubDate !== null && !(this.pubDate instanceof Date)) {
      throw new Error('pubDate must be a Date object or null');
    }

    // Validate author if present
    if (this.author && typeof this.author !== 'string') {
      throw new Error('Item author must be a string');
    }

    // Validate guid if present
    if (this.guid && typeof this.guid !== 'string') {
      throw new Error('Item guid must be a string');
    }

    // Validate categories
    if (!Array.isArray(this.categories)) {
      throw new Error('Item categories must be an array');
    }

    this.categories.forEach((category, index) => {
      if (typeof category !== 'string') {
        throw new Error(`Category at index ${index} must be a string`);
      }
    });
  }

  /**
   * Get a plain object representation of the item
   * @returns {Object} Plain object with item data
   */
  toJSON() {
    return {
      title: this.title,
      description: this.description,
      link: this.link,
      pubDate: this.pubDate,
      author: this.author,
      guid: this.guid,
      categories: [...this.categories]
    };
  }

  /**
   * Get formatted publication date
   * @returns {string} Formatted date string or empty string if not available
   */
  getFormattedPubDate() {
    if (!this.pubDate) {
      return '';
    }

    return this.pubDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Get human-readable publication date
   * @returns {string} Human-readable date string or empty string if not available
   */
  getHumanReadablePubDate() {
    if (!this.pubDate) {
      return '';
    }

    return this.pubDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Get categories as comma-separated string
   * @returns {string} Categories joined by commas
   */
  getCategoriesString() {
    return this.categories.join(', ');
  }

  /**
   * Get truncated description for preview
   * @param {number} [maxLength=200] - Maximum length of truncated description
   * @returns {string} Truncated description
   */
  getTruncatedDescription(maxLength = 200) {
    if (this.description.length <= maxLength) {
      return this.description;
    }

    // Find the last complete word within the limit
    const truncated = this.description.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > 0) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Check if item has author information
   * @returns {boolean} True if author is present and not empty
   */
  hasAuthor() {
    return this.author && this.author.trim().length > 0;
  }

  /**
   * Check if item has categories
   * @returns {boolean} True if categories array is not empty
   */
  hasCategories() {
    return this.categories.length > 0;
  }

  /**
   * Get age of the item in days
   * @returns {number|null} Age in days or null if no publication date
   */
  getAgeInDays() {
    if (!this.pubDate) {
      return null;
    }

    const now = new Date();
    const diffTime = now - this.pubDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Create RSSItem from raw XML data (static factory method)
   * @param {Object} xmlData - Parsed XML data for single item
   * @returns {RSSItem} New RSSItem instance
   */
  static fromXML(xmlData) {
    // This will be implemented by the RSS parser service
    throw new Error('fromXML method should be implemented by RSS parser service');
  }
}