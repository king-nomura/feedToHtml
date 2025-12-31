/**
 * CLI Argument Parser for feedToHtml
 */
export class ArgumentParser {
  constructor() {
    this.options = new Map();
    this.positionalArgs = [];
    this.helpText = '';
    this.version = '1.0.0';
  }

  /**
   * Parse command line arguments
   * @param {Array<string>} args - Command line arguments (usually process.argv.slice(2))
   * @returns {Object} Parsed arguments and options
   */
  parse(args) {
    const result = {
      positional: [],
      options: {},
      help: false,
      version: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Handle help flags
      if (arg === '--help' || arg === '-h') {
        result.help = true;
        continue;
      }

      // Handle version flags
      if (arg === '--version' || arg === '-v') {
        result.version = true;
        continue;
      }

      // Handle long options with = (--option=value)
      if (arg.startsWith('--') && arg.includes('=')) {
        const [key, ...valueParts] = arg.substring(2).split('=');
        const value = valueParts.join('=');
        result.options[this.camelCase(key)] = this.parseValue(value);
        continue;
      }

      // Handle long options (--option value)
      if (arg.startsWith('--')) {
        const key = arg.substring(2);
        const nextArg = args[i + 1];

        // Check if next argument is a value (not another option)
        if (nextArg && !nextArg.startsWith('-')) {
          result.options[this.camelCase(key)] = this.parseValue(nextArg);
          i++; // Skip the value argument
        } else {
          // Boolean flag
          result.options[this.camelCase(key)] = true;
        }
        continue;
      }

      // Handle short options (-o value or -o=value)
      if (arg.startsWith('-') && arg.length > 1) {
        if (arg.includes('=')) {
          const [key, ...valueParts] = arg.substring(1).split('=');
          const value = valueParts.join('=');
          const longKey = this.shortToLong(key);
          if (longKey) {
            result.options[this.camelCase(longKey)] = this.parseValue(value);
          }
        } else {
          const key = arg.substring(1);
          const longKey = this.shortToLong(key);
          const nextArg = args[i + 1];

          if (longKey && nextArg && !nextArg.startsWith('-')) {
            result.options[this.camelCase(longKey)] = this.parseValue(nextArg);
            i++; // Skip the value argument
          } else if (longKey) {
            // Boolean flag
            result.options[this.camelCase(longKey)] = true;
          } else {
            throw new Error(`CONFIG Unknown option: ${arg}`);
          }
        }
        continue;
      }

      // Positional argument
      result.positional.push(arg);
    }

    // Validate required arguments
    this.validateArgs(result);

    return result;
  }

  /**
   * Convert kebab-case to camelCase
   * @param {string} str - kebab-case string
   * @returns {string} camelCase string
   */
  camelCase(str) {
    return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  /**
   * Map short options to long options
   * @param {string} shortKey - Short option key
   * @returns {string|null} Long option key or null
   */
  shortToLong(shortKey) {
    const mapping = {
      'h': 'help',
      'v': 'version',
      'o': 'output',
      't': 'template',
      'c': 'config',
      'T': 'timeout',
      'V': 'verbose',
      'u': 'user-agent',
      'f': 'file'
    };

    return mapping[shortKey] || null;
  }

  /**
   * Parse value from string
   * @param {string} value - String value
   * @returns {*} Parsed value
   */
  parseValue(value) {
    // Try to parse as number
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }

    // Try to parse as boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Return as string
    return value;
  }

  /**
   * Validate parsed arguments
   * @param {Object} result - Parsed arguments
   * @throws {Error} If validation fails
   */
  validateArgs(result) {
    // RSS URL or file is required (first positional argument or --file option)
    if (!result.help && !result.version && result.positional.length === 0 && !result.options.file) {
      throw new Error('CONFIG RSS URL or --file option is required');
    }

    // Validate timeout
    if (result.options.timeout && (result.options.timeout < 1 || result.options.timeout > 300)) {
      throw new Error('CONFIG Timeout must be between 1s and 300s');
    }
  }

  /**
   * Generate help text
   * @returns {string} Help text
   */
  getHelp() {
    return `feedToHtml v${this.version} - RSS to HTML Converter

USAGE:
  feedtohtml <RSS_URL> [options]
  feedtohtml --file <FILE> [options]

ARGUMENTS:
  RSS_URL      RSS or Atom feed URL to convert

OPTIONS:
  -f, --file FILE         Local RSS/Atom feed file path
  -h, --help              Show this help message
  -v, --version           Show version information
  -o, --output DIR        Output directory (default: current directory)
  -t, --template FILE     HTML template file path
  -c, --config FILE       Configuration file path
  -T, --timeout SECONDS   Network timeout in seconds (default: 60)
  -u, --user-agent STR    Custom User-Agent header
  -V, --verbose           Enable verbose output

OUTPUT FORMAT:
  Items are grouped by publication month and saved as:
  <output_dir>/YYYY/YYYY-MM.html (e.g., ./output/2025/2025-01.html)

  Incremental updates: If an HTML file already exists, only new items
  (based on pubDate and link) are added to the top of the file.

EXAMPLES:
  feedtohtml https://example.com/rss.xml
  feedtohtml https://example.com/rss.xml --output ./public
  feedtohtml https://example.com/rss.xml --template ./my-template.html
  feedtohtml https://example.com/rss.xml --output ./public --verbose

CONFIGURATION:
  Configuration can be provided via:
  1. Command line options (highest priority)
  2. Environment variables (FEEDTOHTML_*)
  3. Configuration file (feedtohtml.config.json)
  4. Default values (lowest priority)

EXIT CODES:
  0  Success
  1  Network error (failed to fetch RSS feed)
  2  Parse error (invalid RSS/Atom format)
  3  Filesystem error (cannot write output files)
  4  Configuration error (invalid arguments or config)

For more information, visit: https://github.com/example/feedtohtml`;
  }

  /**
   * Generate version information
   * @returns {string} Version text
   */
  getVersion() {
    return `feedToHtml v${this.version}
Node.js ${process.version}
Platform: ${process.platform} ${process.arch}`;
  }

  /**
   * Parse and handle special commands (help, version)
   * @param {Array<string>} args - Command line arguments
   * @returns {Object|null} Special command result or null
   */
  handleSpecialCommands(args) {
    const parsed = this.parse(args);

    if (parsed.help) {
      return {
        type: 'help',
        message: this.getHelp(),
        exitCode: 0
      };
    }

    if (parsed.version) {
      return {
        type: 'version',
        message: this.getVersion(),
        exitCode: 0
      };
    }

    return null;
  }

  /**
   * Convert parsed arguments to configuration overrides
   * @param {Object} parsed - Parsed arguments
   * @returns {Object} Configuration overrides
   */
  toConfigOverrides(parsed) {
    const overrides = {};

    // Map CLI options to configuration properties
    const mappings = {
      'output': 'outputDir',
      'template': 'template',
      'config': 'configPath',
      'timeout': 'timeout',
      'userAgent': 'userAgent',
      'verbose': 'verbose',
      'file': 'filePath'
    };

    for (const [cliKey, configKey] of Object.entries(mappings)) {
      if (parsed.options[cliKey] !== undefined) {
        overrides[configKey] = parsed.options[cliKey];
      }
    }

    return overrides;
  }

  /**
   * Get RSS URL from parsed arguments
   * @param {Object} parsed - Parsed arguments
   * @returns {string} RSS URL
   */
  getRssUrl(parsed) {
    return parsed.positional[0] || '';
  }


  /**
   * Get file path from parsed arguments
   * @param {Object} parsed - Parsed arguments
   * @returns {string} File path or empty string
   */
  getFilePath(parsed) {
    return parsed.options.file || '';
  }

  
}