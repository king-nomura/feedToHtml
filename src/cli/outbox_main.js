#!/usr/bin/env node

import { OutboxArgumentParser } from './outbox_argument_parser.js';
import { ErrorHandler } from './error_handler.js';
import { OutboxToHtml } from '../outboxtohtml.js';

/**
 * Main CLI entry point for outboxToHtml
 */
class OutboxToHtmlCLI {
  constructor() {
    this.argumentParser = new OutboxArgumentParser();
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
      const outboxUrl = this.argumentParser.getOutboxUrl(parsed);
      const filePath = this.argumentParser.getFilePath(parsed);

      if (!outboxUrl && !filePath) {
        throw new Error('CONFIG Outbox URL or --file option is required');
      }

      // Build options from CLI arguments
      const configOverrides = this.argumentParser.toConfigOverrides(parsed);
      const options = {
        ...configOverrides,
        configPath: parsed.options.config,
        filePath: filePath || undefined
      };

      // Create OutboxToHtml instance and convert
      const outboxToHtml = OutboxToHtml.create(options);
      const source = filePath || outboxUrl;
      const result = await outboxToHtml.convert(outboxUrl, options);

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
  const cli = new OutboxToHtmlCLI();
  cli.run();
}

export { OutboxToHtmlCLI };
