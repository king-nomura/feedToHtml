import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * File utility functions for feedToHtml
 */
export class FileUtils {
  /**
   * Check if path exists and is accessible
   * @param {string} filePath - Path to check
   * @returns {boolean} True if path exists
   */
  static exists(filePath) {
    try {
      return existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if path is a file
   * @param {string} filePath - Path to check
   * @returns {boolean} True if path is a file
   */
  static isFile(filePath) {
    try {
      const stats = statSync(filePath);
      return stats.isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if path is a directory
   * @param {string} filePath - Path to check
   * @returns {boolean} True if path is a directory
   */
  static isDirectory(filePath) {
    try {
      const stats = statSync(filePath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file size in bytes
   * @param {string} filePath - Path to file
   * @returns {number} File size in bytes
   */
  static getFileSize(filePath) {
    try {
      const stats = statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get file modification time
   * @param {string} filePath - Path to file
   * @returns {Date|null} Modification time or null
   */
  static getModificationTime(filePath) {
    try {
      const stats = statSync(filePath);
      return stats.mtime;
    } catch (error) {
      return null;
    }
  }

  /**
   * Ensure directory exists, create if necessary
   * @param {string} dirPath - Directory path
   * @returns {boolean} True if directory exists or was created
   */
  static ensureDirectory(dirPath) {
    try {
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Read file content as string
   * @param {string} filePath - Path to file
   * @param {string} [encoding='utf8'] - File encoding
   * @returns {string|null} File content or null on error
   */
  static readFileContent(filePath, encoding = 'utf8') {
    try {
      return readFileSync(filePath, encoding);
    } catch (error) {
      return null;
    }
  }

  /**
   * Write content to file
   * @param {string} filePath - Path to file
   * @param {string} content - Content to write
   * @param {string} [encoding='utf8'] - File encoding
   * @returns {boolean} True if successful
   */
  static writeFileContent(filePath, content, encoding = 'utf8') {
    try {
      // Ensure directory exists
      const dir = dirname(filePath);
      this.ensureDirectory(dir);

      writeFileSync(filePath, content, encoding);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete file
   * @param {string} filePath - Path to file
   * @returns {boolean} True if successful
   */
  static deleteFile(filePath) {
    try {
      unlinkSync(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Copy file
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   * @returns {boolean} True if successful
   */
  static copyFile(sourcePath, destPath) {
    try {
      const content = readFileSync(sourcePath);
      this.ensureDirectory(dirname(destPath));
      writeFileSync(destPath, content);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate file hash
   * @param {string} filePath - Path to file
   * @param {string} [algorithm='sha256'] - Hash algorithm
   * @returns {string|null} File hash or null on error
   */
  static getFileHash(filePath, algorithm = 'sha256') {
    try {
      const content = readFileSync(filePath);
      const hash = createHash(algorithm);
      hash.update(content);
      return hash.digest('hex');
    } catch (error) {
      return null;
    }
  }

  /**
   * Get content hash (for in-memory content)
   * @param {string} content - Content to hash
   * @param {string} [algorithm='sha256'] - Hash algorithm
   * @returns {string} Content hash
   */
  static getContentHash(content, algorithm = 'sha256') {
    const hash = createHash(algorithm);
    hash.update(content, 'utf8');
    return hash.digest('hex');
  }

  /**
   * Validate filename is safe
   * @param {string} filename - Filename to validate
   * @returns {Object} Validation result
   */
  static validateFilename(filename) {
    const result = {
      isValid: false,
      errors: [],
      warnings: [],
      sanitized: filename
    };

    // Check for empty filename
    if (!filename || filename.trim().length === 0) {
      result.errors.push('Filename cannot be empty');
      return result;
    }

    // Check for path separators
    if (filename.includes('/') || filename.includes('\\')) {
      result.errors.push('Filename cannot contain path separators');
    }

    // Check for reserved characters
    const reservedChars = /[<>:"|?*]/;
    if (reservedChars.test(filename)) {
      result.errors.push('Filename contains reserved characters');
    }

    // Check for reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const nameWithoutExt = basename(filename, extname(filename)).toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      result.errors.push(`Filename uses reserved name: ${nameWithoutExt}`);
    }

    // Check filename length
    if (filename.length > 255) {
      result.errors.push('Filename is too long (max 255 characters)');
    }

    // Warnings for potential issues
    if (filename.startsWith('.') && filename !== '.html' && filename !== '.htm') {
      result.warnings.push('Filename starts with dot (hidden file)');
    }

    if (filename.includes(' ')) {
      result.warnings.push('Filename contains spaces');
    }

    if (!/\.(html?|xml)$/i.test(filename)) {
      result.warnings.push('Filename does not have HTML or XML extension');
    }

    // Create sanitized version
    result.sanitized = this.sanitizeFilename(filename);

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Sanitize filename by removing/replacing problematic characters
   * @param {string} filename - Filename to sanitize
   * @returns {string} Sanitized filename
   */
  static sanitizeFilename(filename) {
    if (!filename) return 'output.html';

    let sanitized = filename;

    // Replace reserved characters with underscores
    sanitized = sanitized.replace(/[<>:"|?*]/g, '_');

    // Replace path separators with underscores
    sanitized = sanitized.replace(/[/\\]/g, '_');

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');

    // Trim whitespace and dots
    sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');

    // Ensure it's not empty
    if (sanitized.length === 0) {
      sanitized = 'output.html';
    }

    // Ensure it has proper extension
    if (!/\.(html?|xml)$/i.test(sanitized)) {
      sanitized += '.html';
    }

    // Limit length
    if (sanitized.length > 255) {
      const ext = extname(sanitized);
      const name = basename(sanitized, ext);
      sanitized = name.substring(0, 255 - ext.length) + ext;
    }

    return sanitized;
  }

  /**
   * Generate unique filename if file already exists
   * @param {string} filePath - Desired file path
   * @param {string} [outputDir] - Output directory
   * @returns {string} Unique filename
   */
  static generateUniqueFilename(filePath, outputDir = process.cwd()) {
    const fullPath = resolve(outputDir, filePath);

    if (!existsSync(fullPath)) {
      return filePath;
    }

    const ext = extname(filePath);
    const name = basename(filePath, ext);
    let counter = 1;

    while (true) {
      const newFilename = `${name}-${counter}${ext}`;
      const newFullPath = resolve(outputDir, newFilename);

      if (!existsSync(newFullPath)) {
        return newFilename;
      }

      counter++;

      // Safety check to prevent infinite loop
      if (counter > 1000) {
        throw new Error('Could not generate unique filename after 1000 attempts');
      }
    }
  }

  /**
   * Get temporary filename
   * @param {string} [prefix='temp'] - Filename prefix
   * @param {string} [extension='.tmp'] - File extension
   * @returns {string} Temporary filename
   */
  static getTempFilename(prefix = 'temp', extension = '.tmp') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}${extension}`;
  }

  /**
   * Check if directory is writable
   * @param {string} dirPath - Directory path
   * @returns {boolean} True if writable
   */
  static isDirectoryWritable(dirPath) {
    try {
      const testFile = join(dirPath, this.getTempFilename('write-test', '.tmp'));
      writeFileSync(testFile, 'test');
      unlinkSync(testFile);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Format file size in human-readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Get file extension recommendation for HTML output
   * @param {string} filename - Original filename
   * @returns {string} Filename with appropriate extension
   */
  static getHtmlFilename(filename) {
    const ext = extname(filename).toLowerCase();

    // If already has HTML extension, keep it
    if (ext === '.html' || ext === '.htm') {
      return filename;
    }

    // Remove existing extension and add .html
    const nameWithoutExt = basename(filename, ext);
    return nameWithoutExt + '.html';
  }

  /**
   * Create backup of existing file
   * @param {string} filePath - File to backup
   * @param {string} [suffix] - Backup suffix (default: timestamp)
   * @returns {string|null} Backup filename or null if failed
   */
  static createBackup(filePath, suffix = null) {
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const ext = extname(filePath);
      const name = basename(filePath, ext);
      const dir = dirname(filePath);

      const backupSuffix = suffix || new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `${name}.backup-${backupSuffix}${ext}`;
      const backupPath = join(dir, backupFilename);

      const content = readFileSync(filePath);
      writeFileSync(backupPath, content);

      return backupFilename;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up old backup files
   * @param {string} dirPath - Directory to clean
   * @param {number} [maxAge=7] - Maximum age in days
   * @param {string} [pattern='*.backup-*'] - Backup file pattern
   * @returns {number} Number of files cleaned up
   */
  static cleanupBackups(dirPath, maxAge = 7, pattern = '.backup-') {
    try {
      const { readdirSync } = require('node:fs');
      const files = readdirSync(dirPath);
      const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        if (file.includes(pattern)) {
          const filePath = join(dirPath, file);
          const stats = statSync(filePath);

          if (now - stats.mtime.getTime() > maxAgeMs) {
            try {
              unlinkSync(filePath);
              cleaned++;
            } catch (error) {
              // Ignore individual file errors
            }
          }
        }
      }

      return cleaned;
    } catch (error) {
      return 0;
    }
  }
}