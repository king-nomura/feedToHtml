#!/usr/bin/env node

import { ArgumentParser } from './argument_parser.js';
import { ErrorHandler } from './error_handler.js';
import { FeedToHtml } from '../feedtohtml.js';

/**
 * Main CLI entry point for feedToHtml
 */
class FeedToHtmlCLI {
  constructor() {
    this.argumentParser = new ArgumentParser();
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Main entry point
   * @param {Array<string>} [args] - Command line arguments
   */
  async run(args = process.argv.slice(2)) {
    try {
      // Handle special commands (help, version)
      const specialCommand = this.argumentParser.handleSpecialCommands(args);
      if (specialCommand) {
        console.log(specialCommand.message);
        process.exit(specialCommand.exitCode);
      }

      // Parse arguments
      const parsed = this.argumentParser.parse(args);
      const rssUrl = this.argumentParser.getRssUrl(parsed);
      const filePath = this.argumentParser.getFilePath(parsed);

      if (!rssUrl && !filePath) {
        throw new Error('CONFIG RSS URL or --file option is required');
      }

      // Build options from CLI arguments
      const configOverrides = this.argumentParser.toConfigOverrides(parsed);
      const options = {
        ...configOverrides,
        configPath: parsed.options.config,
        filePath: filePath || undefined
      };

      // Create FeedToHtml instance and convert
      const feedToHtml = FeedToHtml.create(options);
      const source = filePath || rssUrl;
      const result = await feedToHtml.convert(rssUrl, options);

      if (!result.success) {
        throw new Error(`${result.error.type.toUpperCase()} ${result.error.message}`);
      }

      // Output success message
      if (result.output.totalFiles > 0) {
        console.log(`Successfully converted: ${source}`);
        console.log(`Output directory: ${result.output.directory}`);
        console.log(`Files created/updated: ${result.output.totalFiles}`);
        result.output.files.forEach(file => {
          console.log(`  - ${file}`);
        });
      } else {
        console.log(`No new items to add from: ${source}`);
      }

      process.exit(0);

    } catch (error) {
      this.errorHandler.handleError(error);
    }
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new FeedToHtmlCLI();
  cli.run();
}