import { writeFileSync, mkdirSync, existsSync, unlinkSync, copyFileSync } from 'node:fs';
import { dirname, resolve, join, extname, basename } from 'node:path';
import { OutputFile } from '../models/output_file.js';

/**
 * File Writer Service for HTML output generation and file system operations
 */
export class FileWriter {
  constructor() {
    this.writtenFiles = [];
  }

  /**
   * Write single HTML file to filesystem
   * @param {OutputFile} outputFile - Output file to write
   * @param {string} [outputDir] - Output directory (defaults to current directory)
   * @returns {string} Absolute path of written file
   */
  writeFile(outputFile, outputDir = process.cwd()) {
    try {
      if (!(outputFile instanceof OutputFile)) {
        throw new Error('Invalid output file: must be OutputFile instance');
      }

      const absolutePath = resolve(outputDir, outputFile.filename);
      const dirPath = dirname(absolutePath);

      // Ensure output directory exists
      this.ensureDirectoryExists(dirPath);

      // Write file
      writeFileSync(absolutePath, outputFile.content, 'utf8');

      // Track written file
      this.writtenFiles.push({
        path: absolutePath,
        size: outputFile.getSize(),
        itemCount: outputFile.itemCount,
        pageNumber: outputFile.pageNumber
      });

      return absolutePath;
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        throw new Error(`FILESYSTEM Permission denied: cannot write to ${outputFile.filename}`);
      }

      if (error.code === 'ENOSPC') {
        throw new Error(`FILESYSTEM Disk full: cannot write ${outputFile.filename}`);
      }

      if (error.code === 'ENOTDIR') {
        throw new Error(`FILESYSTEM Invalid path: ${outputFile.filename} contains non-directory component`);
      }

      if (error.message.startsWith('FILESYSTEM')) {
        throw error;
      }

      throw new Error(`FILESYSTEM Failed to write file ${outputFile.filename}: ${error.message}`);
    }
  }

  /**
   * Write multiple HTML files (for pagination)
   * @param {Array<OutputFile>} outputFiles - Array of output files
   * @param {string} [outputDir] - Output directory
   * @returns {Array<string>} Array of absolute paths of written files
   */
  writeFiles(outputFiles, outputDir = process.cwd()) {
    if (!Array.isArray(outputFiles)) {
      throw new Error('Output files must be an array');
    }

    const writtenPaths = [];

    try {
      for (const outputFile of outputFiles) {
        const path = this.writeFile(outputFile, outputDir);
        writtenPaths.push(path);
      }

      return writtenPaths;
    } catch (error) {
      // If any file fails, try to clean up successfully written files
      this.cleanupFiles(writtenPaths);
      throw error;
    }
  }

  /**
   * Ensure directory exists, create if necessary
   * @param {string} dirPath - Directory path
   */
  ensureDirectoryExists(dirPath) {
    if (!existsSync(dirPath)) {
      try {
        mkdirSync(dirPath, { recursive: true });
      } catch (error) {
        if (error.code === 'EACCES' || error.code === 'EPERM') {
          throw new Error(`FILESYSTEM Permission denied: cannot create directory ${dirPath}`);
        }

        throw new Error(`FILESYSTEM Failed to create directory ${dirPath}: ${error.message}`);
      }
    }
  }

  /**
   * Validate output directory is writable
   * @param {string} outputDir - Directory to check
   * @throws {Error} If directory is not writable
   */
  validateOutputDirectory(outputDir) {
    try {
      const resolvedDir = resolve(outputDir);

      if (!existsSync(resolvedDir)) {
        // Check if parent directory exists and is writable
        const parentDir = dirname(resolvedDir);
        if (!existsSync(parentDir)) {
          throw new Error(`FILESYSTEM Parent directory does not exist: ${parentDir}`);
        }
      }

      // Test write access by creating a temporary file
      const testFile = join(resolvedDir, '.feedtohtml-write-test');
      try {
        writeFileSync(testFile, 'test', 'utf8');
        // Clean up test file
        try {
          unlinkSync(testFile);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      } catch (writeError) {
        if (writeError.code === 'EACCES' || writeError.code === 'EPERM') {
          throw new Error(`FILESYSTEM Directory not writable: ${resolvedDir}`);
        }
        throw writeError;
      }
    } catch (error) {
      if (error.message.startsWith('FILESYSTEM')) {
        throw error;
      }

      throw new Error(`FILESYSTEM Invalid output directory: ${error.message}`);
    }
  }

  /**
   * Get statistics about written files
   * @returns {Object} File writing statistics
   */
  getStats() {
    const totalFiles = this.writtenFiles.length;
    const totalSize = this.writtenFiles.reduce((sum, file) => sum + file.size, 0);
    const totalItems = this.writtenFiles.reduce((sum, file) => sum + file.itemCount, 0);

    return {
      filesWritten: totalFiles,
      totalSize,
      formattedTotalSize: this.formatBytes(totalSize),
      totalItems,
      averageFileSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0,
      files: [...this.writtenFiles]
    };
  }

  /**
   * Format bytes into human-readable string
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Clean up files (delete them)
   * @param {Array<string>} filePaths - Array of file paths to delete
   */
  cleanupFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        unlinkSync(filePath);
      } catch (error) {
        console.error(`Warning: Failed to clean up file ${filePath}: ${error.message}`);
      }
    }
  }

  /**
   * Create success summary for output
   * @param {string} feedUrl - Original RSS feed URL
   * @param {Array<string>} writtenPaths - Paths of written files
   * @param {number} totalItems - Total number of items processed
   * @returns {string} Success message
   */
  createSuccessSummary(feedUrl, writtenPaths, totalItems) {
    if (writtenPaths.length === 1) {
      return `Successfully converted RSS feed to ${writtenPaths[0]} (${totalItems} items)`;
    } else {
      const fileList = writtenPaths.map(path => `  - ${path}`).join('\n');
      return `Successfully converted RSS feed to ${writtenPaths.length} files (${totalItems} items):\n${fileList}`;
    }
  }

  /**
   * Validate file can be written before processing
   * @param {string} filename - Target filename
   * @param {string} outputDir - Output directory
   * @returns {boolean} True if file can be written
   */
  canWriteFile(filename, outputDir = process.cwd()) {
    try {
      const absolutePath = resolve(outputDir, filename);
      const dirPath = dirname(absolutePath);

      // Check directory exists or can be created
      if (!existsSync(dirPath)) {
        // Check if we can create the directory
        const parentDir = dirname(dirPath);
        if (!existsSync(parentDir)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file extension recommendation
   * @param {string} filename - Filename to check
   * @returns {string} Recommended filename with proper extension
   */
  getRecommendedFilename(filename) {

    const ext = extname(filename).toLowerCase();

    if (ext === '.html' || ext === '.htm') {
      return filename;
    }

    // Add .html extension if no extension or wrong extension
    const nameWithoutExt = ext ? basename(filename, ext) : filename;
    return `${nameWithoutExt}.html`;
  }

  /**
   * Check if file already exists
   * @param {string} filename - Filename to check
   * @param {string} outputDir - Output directory
   * @returns {boolean} True if file exists
   */
  fileExists(filename, outputDir = process.cwd()) {
    const absolutePath = resolve(outputDir, filename);
    return existsSync(absolutePath);
  }

  /**
   * Reset tracking for new operation
   */
  reset() {
    this.writtenFiles = [];
  }

  /**
   * Backup existing file if it exists
   * @param {string} filename - Target filename
   * @param {string} outputDir - Output directory
   * @returns {string|null} Backup filename or null if no backup created
   */
  backupExistingFile(filename, outputDir = process.cwd()) {
    const absolutePath = resolve(outputDir, filename);

    if (!existsSync(absolutePath)) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `${filename}.backup-${timestamp}`;
    const backupPath = resolve(outputDir, backupFilename);

    try {
      copyFileSync(absolutePath, backupPath);
      return backupFilename;
    } catch (error) {
      console.warn(`Warning: Failed to create backup of ${filename}: ${error.message}`);
      return null;
    }
  }
}