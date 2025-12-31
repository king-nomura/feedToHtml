import { RSSParser } from './services/rss_parser.js';
import { TemplateEngine } from './services/template_engine.js';
import { MonthlyGroupingService } from './services/monthly_grouping_service.js';
import { HtmlParserService } from './services/html_parser_service.js';
import { FileWriter } from './services/file_writer.js';
import { ConfigurationLoader } from './services/configuration_loader.js';
import { HTMLTemplate } from './models/html_template.js';
import { OutputFile } from './models/output_file.js';
import { URLValidator } from './utils/url_validator.js';
import { FileUtils } from './utils/file_utils.js';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Main FeedToHtml API class - facade for all RSS to HTML conversion functionality
 * Outputs are organized by month: YYYY/YYYY-MM.html
 */
export class FeedToHtml {
  constructor(config = {}) {
    // Initialize services (except TemplateEngine which needs config)
    this.rssParser = new RSSParser();
    this.monthlyGroupingService = new MonthlyGroupingService();
    this.htmlParserService = new HtmlParserService();
    this.fileWriter = new FileWriter();
    this.configLoader = new ConfigurationLoader();
    this.urlValidator = new URLValidator();

    // Load configuration
    this.config = this.configLoader.load(config.configPath, config);

    // Initialize TemplateEngine with dateFormat from config
    this.templateEngine = new TemplateEngine(this.config.dateFormat);
  }

  /**
   * Convert RSS feed to HTML files organized by month
   * @param {string} rssUrl - RSS feed URL
   * @param {Object} [options] - Conversion options
   * @param {string} [options.template] - Template file path
   * @param {string} [options.outputDir] - Output directory
   * @param {boolean} [options.verbose] - Enable verbose logging
   * @returns {Promise<Object>} Conversion result
   */
  async convert(rssUrl, options = {}) {
    try {
      // Merge options with configuration
      const mergedConfig = this.configLoader.mergeConfigs(this.config.toJSON(), options);
      const source = options.filePath || rssUrl;

      let feed;

      if (options.filePath) {
        // Load from local file
        if (options.verbose) {
          console.log(`Configuration: ${this.configLoader.getConfigSummary(mergedConfig)}`);
          console.log(`Loading RSS feed from file: ${options.filePath}`);
        }

        feed = this.rssParser.parseFromFile(options.filePath);
      } else {
        // Validate URL
        const urlValidation = this.urlValidator.validate(rssUrl, {
          allowLocal: options.allowLocal || false,
          allowInsecure: options.allowInsecure !== false
        });

        if (!urlValidation.isValid) {
          throw new Error(`CONFIG Invalid RSS URL: ${urlValidation.errors.join(', ')}`);
        }

        // Show URL warnings if verbose
        if (options.verbose && urlValidation.warnings.length > 0) {
          console.warn('URL warnings:');
          urlValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
        }

        if (options.verbose) {
          console.log(`Configuration: ${this.configLoader.getConfigSummary(mergedConfig)}`);
          console.log(`Processing RSS feed: ${rssUrl}`);
          console.log('Fetching RSS feed...');
        }

        feed = await this.rssParser.fetchAndParse(rssUrl, mergedConfig.timeout);
      }
      this.rssParser.validateFeed(feed);

      if (options.verbose) {
        console.log(`Feed loaded: "${feed.title}" (${feed.getItemCount()} items)`);
      }

      // Load template
      const template = await this.loadTemplate(mergedConfig.templatePath);
      this.templateEngine.validateTemplate(template);

      // Reset file writer for new operation
      this.fileWriter.reset();

      // Get output directory
      const outputDir = mergedConfig.outputDir || process.cwd();

      // Group items by month
      const monthlyGroups = this.monthlyGroupingService.groupItemsByMonth(feed.items);

      if (options.verbose) {
        const processable = this.monthlyGroupingService.countProcessableItems(feed.items);
        const skipped = this.monthlyGroupingService.countSkippedItems(feed.items);
        console.log(`Items with pubDate: ${processable}, Items without pubDate (skipped): ${skipped}`);
        console.log(`Monthly groups: ${monthlyGroups.size}`);
      }

      // Check if all items were skipped
      if (monthlyGroups.size === 0) {
        console.warn('Warning: No items with valid pubDate found. No files will be generated.');
        return {
          success: true,
          feed: {
            title: feed.title,
            description: feed.description,
            itemCount: feed.getItemCount(),
            url: source
          },
          output: {
            files: [],
            directory: outputDir,
            totalFiles: 0,
            totalSize: 0
          },
          statistics: {
            skippedItems: feed.getItemCount(),
            newItems: 0,
            updatedFiles: 0
          }
        };
      }

      // Process each monthly group
      const outputFiles = [];
      const newlyCreatedPages = []; // Track newly created pages for updating previous page navigation
      let totalNewItems = 0;
      let updatedFiles = 0;

      // Get list of all available months for navigation
      const availableMonths = [...monthlyGroups.keys()];

      for (const [yearMonth, items] of monthlyGroups) {
        const filePath = this.monthlyGroupingService.generateFilePath(yearMonth, outputDir);
        const yearDirPath = this.monthlyGroupingService.getYearDirPath(yearMonth, outputDir);

        // Ensure year directory exists
        if (!existsSync(yearDirPath)) {
          mkdirSync(yearDirPath, { recursive: true });
          if (options.verbose) {
            console.log(`Created directory: ${yearDirPath}`);
          }
        }

        let itemsToRender = items;
        let isUpdate = false;

        // Check for existing file
        if (existsSync(filePath)) {
          isUpdate = true;
          const existingHtml = readFileSync(filePath, 'utf-8');
          const lastDate = this.htmlParserService.extractMetaDate(existingHtml);
          const existingLinks = this.htmlParserService.extractExistingLinks(existingHtml);

          // Filter for new items only
          const newItems = this.monthlyGroupingService.filterNewItems(items, lastDate, existingLinks);

          if (newItems.length === 0) {
            if (options.verbose) {
              console.log(`${yearMonth}: No new items to add`);
            }
            continue;
          }

          // Parse existing items for merging
          // We need to regenerate the entire file with merged items
          // Since we can't easily extract structured items from HTML,
          // we'll prepend new items HTML to existing main content

          if (options.verbose) {
            console.log(`${yearMonth}: Adding ${newItems.length} new items`);
          }

          itemsToRender = newItems;
          totalNewItems += newItems.length;
          updatedFiles++;
        } else {
          totalNewItems += items.length;
          if (options.verbose) {
            console.log(`${yearMonth}: Creating new file with ${items.length} items`);
          }
        }

        // Generate HTML content with navigation
        const adjacentMonths = this.monthlyGroupingService.findAdjacentMonths(yearMonth, availableMonths);

        // Track newly created pages to update previous page's navigation later
        if (!isUpdate && adjacentMonths.prev) {
          newlyCreatedPages.push({
            yearMonth,
            prevMonth: adjacentMonths.prev
          });
        }
        const htmlContent = this.templateEngine.generateHTML(feed, template, {
          yearMonth,
          pageItems: itemsToRender,
          adjacentMonths,
          generateRelativePath: (from, to) => this.monthlyGroupingService.generateRelativePath(from, to)
        });

        // If updating, we need to merge with existing content
        let finalHtml = htmlContent;
        if (isUpdate) {
          const existingHtml = readFileSync(filePath, 'utf-8');
          finalHtml = this.mergeHtmlContent(existingHtml, htmlContent, itemsToRender);
        }

        // Create output file
        const outputFile = OutputFile.createMonthly(
          yearMonth,
          outputDir,
          finalHtml,
          itemsToRender.length
        );

        outputFiles.push(outputFile);
      }

      // Write files
      if (outputFiles.length > 0) {
        this.fileWriter.validateOutputDirectory(outputDir);

        if (options.verbose) {
          console.log(`Writing ${outputFiles.length} file(s) to ${outputDir}...`);
        }

        const writtenPaths = this.fileWriter.writeFiles(outputFiles, outputDir);

        // Update previous pages' navigation to include links to newly created pages
        for (const { yearMonth, prevMonth } of newlyCreatedPages) {
          const prevFilePath = this.monthlyGroupingService.generateFilePath(prevMonth, outputDir);
          if (existsSync(prevFilePath)) {
            const prevHtml = readFileSync(prevFilePath, 'utf-8');
            const updatedHtml = this.templateEngine.updateNextLink(
              prevHtml,
              yearMonth,
              (from, to) => this.monthlyGroupingService.generateRelativePath(from, to),
              prevMonth
            );
            if (updatedHtml !== prevHtml) {
              writeFileSync(prevFilePath, updatedHtml, 'utf-8');
              if (options.verbose) {
                console.log(`Updated navigation in ${prevFilePath} to include link to ${yearMonth}`);
              }
            }
          }
        }

        // Create result
        const result = {
          success: true,
          feed: {
            title: feed.title,
            description: feed.description,
            itemCount: feed.getItemCount(),
            url: source
          },
          output: {
            files: writtenPaths,
            directory: outputDir,
            totalFiles: writtenPaths.length,
            totalSize: this.fileWriter.getStats().totalSize
          },
          statistics: {
            ...this.fileWriter.getStats(),
            newItems: totalNewItems,
            updatedFiles
          }
        };

        if (options.verbose) {
          console.log('Conversion completed successfully');
          console.log(`Files: ${result.output.totalFiles}`);
          console.log(`New items added: ${totalNewItems}`);
          console.log(`Total size: ${this.fileWriter.formatBytes(result.output.totalSize)}`);
        }

        return result;
      }

      return {
        success: true,
        feed: {
          title: feed.title,
          description: feed.description,
          itemCount: feed.getItemCount(),
            url: source
        },
        output: {
          files: [],
          directory: outputDir,
          totalFiles: 0,
          totalSize: 0
        },
        statistics: {
          newItems: 0,
          updatedFiles: 0
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: this.categorizeError(error)
        }
      };
    }
  }

  /**
   * Merge new HTML content with existing HTML
   * @param {string} existingHtml - Existing HTML content
   * @param {string} newHtml - New HTML content with items to add
   * @param {Array} newItems - New items being added
   * @returns {string} Merged HTML content
   */
  mergeHtmlContent(existingHtml, newHtml, newItems) {
    // Extract new items HTML from the new content
    const newItemsMatch = newHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const newItemsHtml = newItemsMatch ? newItemsMatch[1].trim() : '';

    // Extract existing items HTML
    const existingItemsMatch = existingHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const existingItemsHtml = existingItemsMatch ? existingItemsMatch[1].trim() : '';

    // Combine: new items first, then existing items
    const mergedItemsHtml = newItemsHtml + '\n\n' + existingItemsHtml;

    // Replace main content and update meta date
    let mergedHtml = existingHtml.replace(
      /(<main[^>]*>)[\s\S]*?(<\/main>)/i,
      `$1\n    ${mergedItemsHtml}\n    $2`
    );

    // Update meta date to current time
    mergedHtml = this.htmlParserService.updateMetaDate(mergedHtml, new Date());

    return mergedHtml;
  }

  /**
   * Convert RSS feed to HTML string (in-memory)
   * @param {string} rssUrl - RSS feed URL
   * @param {Object} [options] - Conversion options
   * @returns {Promise<Object>} Conversion result with HTML content
   */
  async convertToString(rssUrl, options = {}) {
    try {
      // Validate URL
      const urlValidation = this.urlValidator.validate(rssUrl, {
        allowLocal: options.allowLocal || false,
        allowInsecure: options.allowInsecure !== false
      });

      if (!urlValidation.isValid) {
        throw new Error(`CONFIG Invalid RSS URL: ${urlValidation.errors.join(', ')}`);
      }

      // Merge options with configuration
      const mergedConfig = this.configLoader.mergeConfigs(this.config.toJSON(), options);

      // Fetch and parse RSS feed
      const feed = await this.rssParser.fetchAndParse(rssUrl, mergedConfig.timeout);
      this.rssParser.validateFeed(feed);

      // Load template
      const template = await this.loadTemplate(mergedConfig.templatePath);
      this.templateEngine.validateTemplate(template);

      // Generate HTML content (use current month as default)
      const now = new Date();
      const yearMonth = this.monthlyGroupingService.getYearMonthKey(now);
      const htmlContent = this.templateEngine.generateHTML(feed, template, {
        yearMonth,
        pageItems: feed.items
      });

      return {
        success: true,
        html: htmlContent,
        feed: {
          title: feed.title,
          description: feed.description,
          itemCount: feed.getItemCount(),
            url: source
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: this.categorizeError(error)
        }
      };
    }
  }

  /**
   * Validate RSS feed without conversion
   * @param {string} rssUrl - RSS feed URL
   * @param {Object} [options] - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateFeed(rssUrl, options = {}) {
    try {
      // Validate URL
      const urlValidation = this.urlValidator.validate(rssUrl, {
        allowLocal: options.allowLocal || false,
        allowInsecure: options.allowInsecure !== false
      });

      if (!urlValidation.isValid) {
        return {
          success: false,
          url: {
            isValid: false,
            errors: urlValidation.errors,
            warnings: urlValidation.warnings
          }
        };
      }

      // Analyze RSS likelihood
      const rssAnalysis = this.urlValidator.analyzeRSSLikelihood(rssUrl);

      // Fetch and parse RSS feed (with shorter timeout for validation)
      const timeout = Math.min(options.timeout || 30, 30);
      const feed = await this.rssParser.fetchAndParse(rssUrl, timeout);
      this.rssParser.validateFeed(feed);

      // Analyze monthly distribution
      const monthlyGroups = this.monthlyGroupingService.groupItemsByMonth(feed.items);
      const monthlyDistribution = {};
      for (const [yearMonth, items] of monthlyGroups) {
        monthlyDistribution[yearMonth] = items.length;
      }

      return {
        success: true,
        url: {
          isValid: true,
          warnings: urlValidation.warnings,
          rssLikelihood: rssAnalysis
        },
        feed: {
          title: feed.title,
          description: feed.description,
          link: feed.link,
          language: feed.language,
          itemCount: feed.getItemCount(),
          lastBuildDate: feed.lastBuildDate,
          itemsWithPubDate: this.monthlyGroupingService.countProcessableItems(feed.items),
          itemsWithoutPubDate: this.monthlyGroupingService.countSkippedItems(feed.items),
          monthlyDistribution
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: this.categorizeError(error)
        }
      };
    }
  }

  /**
   * Get configuration information
   * @returns {Object} Configuration details
   */
  getConfig() {
    return {
      current: this.config.toJSON(),
      available: this.configLoader.findConfigFiles(),
      defaults: this.configLoader.getDefaultConfig()
    };
  }

  /**
   * Create sample configuration file
   * @param {string} filePath - Path to create config file
   * @returns {boolean} True if successful
   */
  createSampleConfig(filePath) {
    try {
      this.configLoader.createSampleConfig(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Load HTML template
   * @param {string} [templatePath] - Template file path
   * @returns {Promise<HTMLTemplate>} HTML template
   */
  async loadTemplate(templatePath) {
    if (!templatePath) {
      return HTMLTemplate.createDefault();
    }

    try {
      return await HTMLTemplate.loadFromFile(templatePath);
    } catch (error) {
      throw new Error(`CONFIG Failed to load template from ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Categorize error type
   * @param {Error} error - Error to categorize
   * @returns {string} Error category
   */
  categorizeError(error) {
    const message = error.message || '';

    if (message.startsWith('NETWORK')) return 'network';
    if (message.startsWith('PARSE')) return 'parse';
    if (message.startsWith('FILESYSTEM')) return 'filesystem';
    if (message.startsWith('CONFIG')) return 'config';

    return 'unknown';
  }

  /**
   * Get version information
   * @returns {Object} Version details
   */
  static getVersion() {
    return {
      version: '1.0.0',
      node: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }

  /**
   * Create FeedToHtml instance with default configuration
   * @param {Object} [options] - Configuration options
   * @returns {FeedToHtml} New instance
   */
  static create(options = {}) {
    return new FeedToHtml(options);
  }
}
