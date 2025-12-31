import { resolve, dirname, basename, extname } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * OutputFile model representing generated HTML output file
 */
export class OutputFile {
  /**
   * Create an OutputFile instance
   * @param {Object} fileData - File data
   * @param {string} fileData.filename - Output filename
   * @param {string} fileData.content - Generated HTML content
   * @param {number} fileData.itemCount - Number of items in this file
   * @param {number} [fileData.pageNumber] - Page number (for pagination)
   */
  constructor(fileData) {
    this.filename = fileData.filename;
    this.content = fileData.content;
    this.itemCount = fileData.itemCount;
    this.pageNumber = fileData.pageNumber || 1;

    this.validate();
  }

  /**
   * Validate the output file data
   * @throws {Error} If validation fails
   */
  validate() {
    if (!this.filename || typeof this.filename !== 'string') {
      throw new Error('Filename is required and must be a string');
    }

    if (this.filename.trim().length === 0) {
      throw new Error('Filename cannot be empty');
    }

    if (!this.content || typeof this.content !== 'string') {
      throw new Error('Content is required and must be a string');
    }

    if (this.content.trim().length === 0) {
      throw new Error('Content cannot be empty');
    }

    if (!Number.isInteger(this.itemCount) || this.itemCount < 0) {
      throw new Error('Item count must be a non-negative integer');
    }

    if (!Number.isInteger(this.pageNumber) || this.pageNumber < 1) {
      throw new Error('Page number must be a positive integer');
    }

    // Validate filename extension
    const ext = extname(this.filename).toLowerCase();
    if (ext !== '.html' && ext !== '.htm') {
      console.warn(`Warning: Output filename should have .html or .htm extension: ${this.filename}`);
    }
  }

  /**
   * Get a plain object representation of the output file
   * @returns {Object} Plain object with file data
   */
  toJSON() {
    return {
      filename: this.filename,
      content: this.content,
      itemCount: this.itemCount,
      pageNumber: this.pageNumber
    };
  }

  /**
   * Get the file size in bytes
   * @returns {number} File size in bytes
   */
  getSize() {
    return Buffer.byteLength(this.content, 'utf8');
  }

  /**
   * Get human-readable file size
   * @returns {string} File size with appropriate unit
   */
  getFormattedSize() {
    const bytes = this.getSize();

    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  /**
   * Get the absolute file path
   * @param {string} [outputDir] - Output directory (defaults to current directory)
   * @returns {string} Absolute file path
   */
  getAbsolutePath(outputDir = process.cwd()) {
    return resolve(outputDir, this.filename);
  }

  /**
   * Check if this is a paginated file
   * @returns {boolean} True if page number is greater than 1 or filename indicates pagination
   */
  isPaginated() {
    return this.pageNumber > 1 || /-\d+\.html?$/i.test(this.filename);
  }

  /**
   * Get base filename without page number
   * @returns {string} Base filename
   */
  getBaseFilename() {
    // Remove page number suffix like "-1", "-2", etc.
    const name = basename(this.filename, extname(this.filename));
    const ext = extname(this.filename);

    const baseMatch = name.match(/^(.+)-\d+$/);
    if (baseMatch) {
      return baseMatch[1] + ext;
    }

    return this.filename;
  }

  /**
   * Validate that the content is valid HTML
   * @returns {boolean} True if content appears to be valid HTML
   */
  isValidHTML() {
    // Basic HTML validation
    const hasDoctype = /<!DOCTYPE\s+html>/i.test(this.content);
    const hasHtmlTag = /<html[^>]*>/i.test(this.content);
    const hasClosingHtmlTag = /<\/html>/i.test(this.content);

    return hasDoctype && hasHtmlTag && hasClosingHtmlTag;
  }

  /**
   * Check if output directory exists and is writable
   * @param {string} outputDir - Directory to check
   * @returns {boolean} True if directory exists and is writable
   */
  static isDirectoryWritable(outputDir) {
    try {
      const { accessSync, constants } = require('node:fs');
      accessSync(outputDir, constants.W_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate paginated filename
   * @param {string} baseFilename - Base filename
   * @param {number} pageNumber - Page number
   * @returns {string} Paginated filename
   */
  static generatePaginatedFilename(baseFilename, pageNumber) {
    const name = basename(baseFilename, extname(baseFilename));
    const ext = extname(baseFilename);

    if (pageNumber === 1) {
      return `${name}-1${ext}`;
    }

    return `${name}-${pageNumber}${ext}`;
  }

  /**
   * Create OutputFile for pagination
   * @param {string} baseFilename - Base filename
   * @param {string} content - HTML content
   * @param {number} itemCount - Number of items
   * @param {number} pageNumber - Page number
   * @returns {OutputFile} New OutputFile instance
   */
  static createPaginated(baseFilename, content, itemCount, pageNumber) {
    const filename = OutputFile.generatePaginatedFilename(baseFilename, pageNumber);

    return new OutputFile({
      filename,
      content,
      itemCount,
      pageNumber
    });
  }

  /**
   * Create OutputFile for single page
   * @param {string} filename - Output filename
   * @param {string} content - HTML content
   * @param {number} itemCount - Number of items
   * @returns {OutputFile} New OutputFile instance
   */
  static createSingle(filename, content, itemCount) {
    return new OutputFile({
      filename,
      content,
      itemCount,
      pageNumber: 1
    });
  }

  /**
   * Create OutputFile for monthly output
   * @param {string} yearMonth - Year-month string (YYYY-MM)
   * @param {string} outputDir - Output directory
   * @param {string} content - HTML content
   * @param {number} itemCount - Number of items
   * @returns {OutputFile} New OutputFile instance
   */
  static createMonthly(yearMonth, outputDir, content, itemCount) {
    const [year] = yearMonth.split('-');
    const filename = `${year}/${yearMonth}.html`;

    return new OutputFile({
      filename,
      content,
      itemCount,
      pageNumber: 1
    });
  }

  /**
   * Check if this is a monthly output file
   * @returns {boolean} True if filename matches YYYY/YYYY-MM.html pattern
   */
  isMonthlyOutput() {
    return /^\d{4}\/\d{4}-\d{2}\.html$/i.test(this.filename);
  }

  /**
   * Get year-month from filename if monthly output
   * @returns {string|null} YYYY-MM or null if not monthly output
   */
  getYearMonth() {
    const match = this.filename.match(/(\d{4}-\d{2})\.html$/i);
    return match ? match[1] : null;
  }

  /**
   * Get file statistics
   * @returns {Object} File statistics
   */
  getStats() {
    const lines = this.content.split('\n').length;
    const words = this.content.split(/\s+/).filter(word => word.length > 0).length;
    const characters = this.content.length;

    return {
      size: this.getSize(),
      formattedSize: this.getFormattedSize(),
      lines,
      words,
      characters,
      itemCount: this.itemCount,
      pageNumber: this.pageNumber,
      isPaginated: this.isPaginated(),
      isValidHTML: this.isValidHTML()
    };
  }

  /**
   * Get summary for logging
   * @returns {string} Summary string
   */
  getSummary() {
    const stats = this.getStats();

    if (this.isPaginated()) {
      return `Page ${this.pageNumber}: ${this.filename} (${stats.formattedSize}, ${this.itemCount} items)`;
    } else {
      return `${this.filename} (${stats.formattedSize}, ${this.itemCount} items)`;
    }
  }
}