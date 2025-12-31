/**
 * Error Handler for feedToHtml CLI
 * Provides structured error handling with appropriate exit codes
 */
export class ErrorHandler {
  constructor() {
    this.exitCodes = {
      SUCCESS: 0,
      NETWORK_ERROR: 1,
      PARSE_ERROR: 2,
      FILESYSTEM_ERROR: 3,
      CONFIG_ERROR: 4
    };
  }

  /**
   * Handle error and exit with appropriate code
   * @param {Error} error - Error to handle
   */
  handleError(error) {
    const errorInfo = this.categorizeError(error);

    // Output error to stderr
    console.error(`Error: ${errorInfo.message}`);

    // Output additional details if available
    if (errorInfo.details) {
      console.error(`Details: ${errorInfo.details}`);
    }

    // Output suggestion if available
    if (errorInfo.suggestion) {
      console.error(`Suggestion: ${errorInfo.suggestion}`);
    }

    process.exit(errorInfo.exitCode);
  }

  /**
   * Categorize error and determine exit code
   * @param {Error} error - Error to categorize
   * @returns {Object} Error information with exit code
   */
  categorizeError(error) {
    const message = error.message || 'Unknown error occurred';

    // Network errors (exit code 1)
    if (message.startsWith('NETWORK')) {
      return this.createErrorInfo(
        this.exitCodes.NETWORK_ERROR,
        message.replace('NETWORK ', ''),
        null,
        this.getNetworkSuggestion(message)
      );
    }

    // Parse errors (exit code 2)
    if (message.startsWith('PARSE')) {
      return this.createErrorInfo(
        this.exitCodes.PARSE_ERROR,
        message.replace('PARSE ', ''),
        null,
        this.getParseSuggestion(message)
      );
    }

    // Filesystem errors (exit code 3)
    if (message.startsWith('FILESYSTEM')) {
      return this.createErrorInfo(
        this.exitCodes.FILESYSTEM_ERROR,
        message.replace('FILESYSTEM ', ''),
        null,
        this.getFilesystemSuggestion(message)
      );
    }

    // Configuration errors (exit code 4)
    if (message.startsWith('CONFIG')) {
      return this.createErrorInfo(
        this.exitCodes.CONFIG_ERROR,
        message.replace('CONFIG ', ''),
        null,
        this.getConfigSuggestion(message)
      );
    }

    // Handle specific Node.js errors
    if (error.code) {
      return this.handleNodeJSError(error);
    }

    // Unknown error (exit code 4)
    return this.createErrorInfo(
      this.exitCodes.CONFIG_ERROR,
      message,
      error.stack ? `Stack trace: ${error.stack}` : null,
      'Please check the command arguments and try again'
    );
  }

  /**
   * Handle Node.js specific errors
   * @param {Error} error - Node.js error
   * @returns {Object} Error information
   */
  handleNodeJSError(error) {
    switch (error.code) {
      case 'ENOENT':
        return this.createErrorInfo(
          this.exitCodes.FILESYSTEM_ERROR,
          `File or directory not found: ${error.path || 'unknown'}`,
          null,
          'Check that the file path is correct and the file exists'
        );

      case 'EACCES':
      case 'EPERM':
        return this.createErrorInfo(
          this.exitCodes.FILESYSTEM_ERROR,
          `Permission denied: ${error.path || 'unknown'}`,
          null,
          'Check file permissions or run with appropriate privileges'
        );

      case 'ENOSPC':
        return this.createErrorInfo(
          this.exitCodes.FILESYSTEM_ERROR,
          'No space left on device',
          null,
          'Free up disk space and try again'
        );

      case 'ENOTDIR':
        return this.createErrorInfo(
          this.exitCodes.FILESYSTEM_ERROR,
          `Not a directory: ${error.path || 'unknown'}`,
          null,
          'Check that the path points to a valid directory'
        );

      case 'EISDIR':
        return this.createErrorInfo(
          this.exitCodes.FILESYSTEM_ERROR,
          `Is a directory: ${error.path || 'unknown'}`,
          null,
          'Specify a filename, not a directory'
        );

      default:
        return this.createErrorInfo(
          this.exitCodes.CONFIG_ERROR,
          error.message,
          `Error code: ${error.code}`,
          'Check the command arguments and try again'
        );
    }
  }

  /**
   * Create error information object
   * @param {number} exitCode - Exit code
   * @param {string} message - Error message
   * @param {string} [details] - Additional details
   * @param {string} [suggestion] - Suggestion for resolution
   * @returns {Object} Error information
   */
  createErrorInfo(exitCode, message, details = null, suggestion = null) {
    return {
      exitCode,
      message,
      details,
      suggestion
    };
  }

  /**
   * Get suggestion for network errors
   * @param {string} message - Error message
   * @returns {string} Suggestion
   */
  getNetworkSuggestion(message) {
    if (message.includes('timeout')) {
      return 'Try increasing the timeout with --timeout option or check your internet connection';
    }

    if (message.includes('fetch')) {
      return 'Check the RSS URL and your internet connection';
    }

    if (message.includes('HTTP')) {
      return 'The RSS feed server returned an error. Check if the URL is correct and accessible';
    }

    return 'Check the RSS URL and your internet connection';
  }

  /**
   * Get suggestion for parse errors
   * @param {string} message - Error message
   * @returns {string} Suggestion
   */
  getParseSuggestion(message) {
    if (message.includes('Invalid XML format')) {
      return 'The URL does not provide valid RSS or Atom feed. Check if it\'s the correct feed URL';
    }

    if (message.includes('missing channel')) {
      return 'The RSS feed is malformed. Try a different feed URL';
    }

    if (message.includes('must contain at least one item')) {
      return 'The RSS feed is empty. Check if the feed has any content';
    }

    return 'The RSS feed format is invalid. Try a different feed URL or contact the feed provider';
  }

  /**
   * Get suggestion for filesystem errors
   * @param {string} message - Error message
   * @returns {string} Suggestion
   */
  getFilesystemSuggestion(message) {
    if (message.includes('Permission denied')) {
      return 'Check file/directory permissions or run with appropriate privileges';
    }

    if (message.includes('Disk full')) {
      return 'Free up disk space and try again';
    }

    if (message.includes('Directory not writable')) {
      return 'Choose a different output directory with write permissions';
    }

    if (message.includes('cannot create directory')) {
      return 'Check parent directory permissions or create the directory manually';
    }

    return 'Check file/directory permissions and available disk space';
  }

  /**
   * Get suggestion for configuration errors
   * @param {string} message - Error message
   * @returns {string} Suggestion
   */
  getConfigSuggestion(message) {
    if (message.includes('RSS URL is required')) {
      return 'Provide an RSS feed URL as the first argument';
    }

    if (message.includes('Invalid RSS URL format')) {
      return 'Provide a valid HTTP or HTTPS URL for the RSS feed';
    }

    if (message.includes('Unknown option')) {
      return 'Use --help to see available options';
    }

    if (message.includes('Template')) {
      return 'Check that the template file exists and is readable';
    }

    if (message.includes('Configuration file')) {
      return 'Check that the configuration file exists and contains valid JSON';
    }

    if (message.includes('Timeout must be')) {
      return 'Specify a timeout between 1s and 300s (5 minutes)';
    }

    if (message.includes('Items per page must be')) {
      return 'Specify items per page between 1 and 1000';
    }

    return 'Use --help to see correct usage and available options';
  }

  /**
   * Handle unhandled promise rejections
   * @param {Error} error - Unhandled rejection error
   */
  handleUnhandledRejection(error) {
    console.error('Unhandled Promise Rejection:');
    this.handleError(error);
  }

  /**
   * Handle uncaught exceptions
   * @param {Error} error - Uncaught exception error
   */
  handleUncaughtException(error) {
    console.error('Uncaught Exception:');
    this.handleError(error);
  }

  /**
   * Setup global error handlers
   */
  setupGlobalHandlers() {
    process.on('unhandledRejection', (error) => {
      this.handleUnhandledRejection(error);
    });

    process.on('uncaughtException', (error) => {
      this.handleUncaughtException(error);
    });
  }

  /**
   * Get exit code name
   * @param {number} code - Exit code
   * @returns {string} Exit code name
   */
  getExitCodeName(code) {
    const names = {
      [this.exitCodes.SUCCESS]: 'SUCCESS',
      [this.exitCodes.NETWORK_ERROR]: 'NETWORK_ERROR',
      [this.exitCodes.PARSE_ERROR]: 'PARSE_ERROR',
      [this.exitCodes.FILESYSTEM_ERROR]: 'FILESYSTEM_ERROR',
      [this.exitCodes.CONFIG_ERROR]: 'CONFIG_ERROR'
    };

    return names[code] || 'UNKNOWN';
  }
}