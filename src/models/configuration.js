import { existsSync, accessSync, constants, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Configuration model for application settings
 */
export class Configuration {
  /**
   * Create a Configuration instance
   * @param {Object} [configData={}] - Configuration data
   * @param {string} [configData.templatePath] - Path to HTML template file
   * @param {number} [configData.timeout] - Network timeout in seconds
   * @param {string} [configData.outputDir] - Output directory path
   */
  constructor(configData = {}) {
    // Set defaults
    this.templatePath = configData.templatePath || null;
    this.timeout = configData.timeout || 60; // Default 60 seconds
    this.outputDir = configData.outputDir || process.cwd(); // Default to current directory
    this.dateFormat = configData.dateFormat || null; // Date format settings (Intl.DateTimeFormat)

    this.validate();
  }

  /**
   * Validate the configuration data
   * @throws {Error} If validation fails
   */
  validate() {
    // Validate templatePath if specified
    if (this.templatePath !== null) {
      if (typeof this.templatePath !== 'string') {
        throw new Error('templatePath must be a string');
      }

      if (this.templatePath.trim().length === 0) {
        throw new Error('templatePath cannot be empty');
      }

      // Resolve relative paths
      this.templatePath = resolve(this.templatePath);

      // Check if template file exists
      if (!existsSync(this.templatePath)) {
        throw new Error(`Template file not found: ${this.templatePath}`);
      }

      // Check if template file is readable
      try {
        accessSync(this.templatePath, constants.R_OK);
      } catch (error) {
        throw new Error(`Template file is not readable: ${this.templatePath}`);
      }
    }

    // Validate timeout
    if (typeof this.timeout !== 'number' || this.timeout <= 0) {
      throw new Error('timeout must be a positive number');
    }

    if (this.timeout > 600) { // 10 minutes max (600 seconds)
      throw new Error('timeout cannot exceed 600 seconds (10 minutes)');
    }

    // Validate outputDir
    if (typeof this.outputDir !== 'string') {
      throw new Error('outputDir must be a string');
    }

    // Resolve relative paths
    this.outputDir = resolve(this.outputDir);

    // Check if output directory exists, create if it doesn't
    if (existsSync(this.outputDir)) {
      try {
        accessSync(this.outputDir, constants.W_OK);
      } catch (error) {
        throw new Error(`Output directory is not writable: ${this.outputDir}`);
      }
    } else {
      // Try to create the output directory
      try {
        mkdirSync(this.outputDir, { recursive: true });
      } catch (error) {
        throw new Error(`Cannot create output directory: ${this.outputDir}. ${error.message}`);
      }

      // Verify the directory was created and is writable
      try {
        accessSync(this.outputDir, constants.W_OK);
      } catch (error) {
        throw new Error(`Created output directory is not writable: ${this.outputDir}`);
      }
    }

    // Validate dateFormat if specified
    if (this.dateFormat !== null) {
      if (typeof this.dateFormat !== 'object') {
        throw new Error('dateFormat must be an object');
      }

      // Validate locale if specified
      if (this.dateFormat.locale !== undefined) {
        if (typeof this.dateFormat.locale !== 'string') {
          throw new Error('dateFormat.locale must be a string');
        }
        // Verify locale is valid by attempting to create a DateTimeFormat
        try {
          new Intl.DateTimeFormat(this.dateFormat.locale);
        } catch (error) {
          throw new Error(`Invalid locale: ${this.dateFormat.locale}`);
        }
      }

      // Validate options if specified
      if (this.dateFormat.options !== undefined) {
        if (typeof this.dateFormat.options !== 'object' || this.dateFormat.options === null) {
          throw new Error('dateFormat.options must be an object');
        }
        // Verify options are valid by attempting to create a DateTimeFormat
        try {
          new Intl.DateTimeFormat(this.dateFormat.locale || 'en-US', this.dateFormat.options);
        } catch (error) {
          throw new Error(`Invalid dateFormat.options: ${error.message}`);
        }
      }
    }
  }

  /**
   * Get a plain object representation of the configuration
   * @returns {Object} Plain object with configuration data
   */
  toJSON() {
    return {
      templatePath: this.templatePath,
      timeout: this.timeout,
      outputDir: this.outputDir,
      dateFormat: this.dateFormat
    };
  }

  /**
   * Check if custom template is configured
   * @returns {boolean} True if custom template path is set
   */
  hasCustomTemplate() {
    return this.templatePath !== null;
  }

  /**
   * Get default configuration
   * @returns {Configuration} Configuration with default values
   */
  static getDefault() {
    return new Configuration();
  }

  /**
   * Create configuration from JSON object
   * @param {Object} jsonData - JSON configuration data
   * @returns {Configuration} New Configuration instance
   */
  static fromJSON(jsonData) {
    return new Configuration(jsonData);
  }

  /**
   * Create configuration from environment variables
   * @returns {Configuration} Configuration with values from environment
   */
  static fromEnvironment() {
    const configData = {};

    // Check for environment variables
    if (process.env.FEEDTOHTML_TIMEOUT) {
      const timeout = parseFloat(process.env.FEEDTOHTML_TIMEOUT);
      if (!isNaN(timeout)) {
        configData.timeout = timeout;
      }
    }

    if (process.env.FEEDTOHTML_CONFIG) {
      configData.templatePath = process.env.FEEDTOHTML_CONFIG;
    }

    return new Configuration(configData);
  }

  /**
   * Merge this configuration with another configuration
   * @param {Configuration} otherConfig - Configuration to merge
   * @returns {Configuration} New merged configuration
   */
  merge(otherConfig) {
    const mergedData = {
      ...this.toJSON(),
      ...otherConfig.toJSON()
    };

    // Remove null values from the other config to keep this config's values
    Object.keys(mergedData).forEach(key => {
      if (otherConfig[key] === null) {
        mergedData[key] = this[key];
      }
    });

    return new Configuration(mergedData);
  }

  /**
   * Create configuration with priority: config file > environment > defaults
   * @param {Object} [configFileData] - Data from configuration file
   * @returns {Configuration} Merged configuration
   */
  static createWithPriority(configFileData) {
    const envConfig = Configuration.fromEnvironment();
    const defaultConfig = Configuration.getDefault();

    let finalConfig = defaultConfig;

    // Merge environment config
    finalConfig = finalConfig.merge(envConfig);

    // Merge config file data if provided
    if (configFileData) {
      const fileConfig = Configuration.fromJSON(configFileData);
      finalConfig = finalConfig.merge(fileConfig);
    }

    return finalConfig;
  }
}
