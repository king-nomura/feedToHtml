/**
 * OutboxItem model representing individual ActivityPub outbox entry
 * Implements the same interface as RSSItem for compatibility with TemplateEngine
 */
export class OutboxItem {
  /**
   * Create an OutboxItem instance
   * @param {Object} itemData - Raw item data
   * @param {string} [itemData.title] - Post title (usually empty for ActivityPub)
   * @param {string} itemData.description - Post content (from object.content)
   * @param {string} itemData.link - Post URL (from id)
   * @param {Date} [itemData.pubDate] - Publication date (from published)
   * @param {string} [itemData.author] - Post author
   * @param {string} [itemData.guid] - Unique identifier (from id)
   * @param {Array} [itemData.categories] - Post categories/tags
   */
  constructor(itemData) {
    this.title = itemData.title || '';
    this.description = itemData.description || '';
    this.link = itemData.link;
    this.pubDate = itemData.pubDate || null;
    this.author = itemData.author || '';
    this.guid = itemData.guid || '';
    this.categories = itemData.categories || [];

    this.validate();
  }

  /**
   * Validate the outbox item data
   * @throws {Error} If validation fails
   */
  validate() {
    // Title is optional for ActivityPub (unlike RSS)
    if (this.title && typeof this.title !== 'string') {
      throw new Error('Item title must be a string when provided');
    }

    // Description is optional
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
    if (!this.description || this.description.length <= maxLength) {
      return this.description || '';
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
   * Create OutboxItem from ActivityPub JSON data (static factory method)
   * @param {Object} activityData - Parsed ActivityPub activity object
   * @returns {OutboxItem} New OutboxItem instance
   */
  static fromActivityPub(activityData) {
    return new OutboxItem({
      title: '',
      description: activityData.object?.content || '',
      link: activityData.id,
      pubDate: activityData.published ? new Date(activityData.published) : null,
      author: '',
      guid: activityData.id,
      categories: []
    });
  }
}
