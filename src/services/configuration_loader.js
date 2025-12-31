import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Configuration } from '../models/configuration.js';

/**
 * Configuration Loader Service for managing application configuration
 */
export class ConfigurationLoader {
  constructor() {
    this.defaultConfigPaths = [
      './feedtohtml.config.json',
      './config/feedtohtml.json',
      '~/.feedtohtml/config.json'
    ];
  }

  /**
   * Load configuration from various sources
   * @param {string} [configPath] - Specific config file path
   * @param {Object} [overrides] - Configuration overrides
   * @returns {Configuration} Loaded configuration
   */
  load(configPath = null, overrides = {}) {
    // Start with default configuration
    let config = this.getDefaultConfig();

    // Load from file if available
    const fileConfig = this.loadFromFile(configPath);
    if (fileConfig) {
      config = this.mergeConfigs(config, fileConfig);
    }

    // Apply environment variables
    const envConfig = this.loadFromEnvironment();
    config = this.mergeConfigs(config, envConfig);

    // Apply overrides
    config = this.mergeConfigs(config, overrides);

    return new Configuration(config);
  }

  /**
   * Load configuration from file
   * @param {string} [configPath] - Specific config file path
   * @returns {Object|null} Configuration object or null if no file found
   */
  loadFromFile(configPath = null) {
    const paths = configPath ? [configPath] : this.defaultConfigPaths;

    for (const path of paths) {
      const resolvedPath = this.resolvePath(path);

      if (existsSync(resolvedPath)) {
        try {
          const content = readFileSync(resolvedPath, 'utf8');
          const config = JSON.parse(content);
          console.log(`Loaded configuration from: ${resolvedPath}`);
          return config;
        } catch (error) {
          if (configPath) {
            // If specific path was provided, throw error
            throw new Error(`CONFIG Failed to parse configuration file ${resolvedPath}: ${error.message}`);
          } else {
            // If checking default paths, warn and continue
            console.warn(`Warning: Failed to parse configuration file ${resolvedPath}: ${error.message}`);
            continue;
          }
        }
      }
    }

    return null;
  }

  /**
   * Load configuration from environment variables
   * @returns {Object} Configuration from environment
   */
  loadFromEnvironment() {
    const config = {};

    // Map environment variables to config properties
    const envMappings = {
      'FEEDTOHTML_TIMEOUT': 'timeout',
      'FEEDTOHTML_OUTPUT_DIR': 'outputDir',
      'FEEDTOHTML_TEMPLATE': 'template',
      'FEEDTOHTML_USER_AGENT': 'userAgent'
    };

    for (const [envVar, configKey] of Object.entries(envMappings)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        // Parse numeric values
        if (configKey === 'timeout') {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue)) {
            config[configKey] = numValue;
          }
        } else {
          config[configKey] = value;
        }
      }
    }

    // Handle boolean environment variables
    if (process.env.FEEDTOHTML_VERBOSE === 'true') {
      config.verbose = true;
    }

    return config;
  }

  /**
   * Get default configuration
   * @returns {Object} Default configuration object
   */
  getDefaultConfig() {
    return {
      timeout: 60,
      outputDir: process.cwd(),
      template: null,
      userAgent: 'feedToHtml/1.0.0 (RSS to HTML converter)',
      verbose: false
    };
  }

  /**
   * Merge two configuration objects
   * @param {Object} base - Base configuration
   * @param {Object} override - Override configuration
   * @returns {Object} Merged configuration
   */
  mergeConfigs(base, override) {
    const merged = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined && value !== null) {
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Resolve configuration file path
   * @param {string} path - Path to resolve
   * @returns {string} Resolved path
   */
  resolvePath(path) {
    if (path.startsWith('~/')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      return resolve(homeDir, path.substring(2));
    }

    return resolve(path);
  }

  /**
   * Validate configuration completeness
   * @param {Configuration} config - Configuration to validate
   * @returns {Array<string>} Array of validation warnings
   */
  validateConfig(config) {
    const warnings = [];

    if (!config.template) {
      warnings.push('No template specified - will use default template');
    }

    if (config.timeout < 5) {
      warnings.push('Timeout is very low (< 5 seconds) - network requests may fail');
    }

    return warnings;
  }

  /**
   * Save configuration to file
   * @param {Configuration} config - Configuration to save
   * @param {string} filePath - Path to save configuration
   */
  saveConfig(config, filePath) {
    try {
      const configObj = config.toJSON();
      const content = JSON.stringify(configObj, null, 2);

      const { writeFileSync, mkdirSync } = require('node:fs');
      const { dirname } = require('node:path');

      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(filePath, content, 'utf8');
      console.log(`Configuration saved to: ${filePath}`);
    } catch (error) {
      throw new Error(`CONFIG Failed to save configuration to ${filePath}: ${error.message}`);
    }
  }

  /**
   * Create sample configuration file
   * @param {string} filePath - Path to create sample config
   */
  createSampleConfig(filePath) {
    const sampleConfig = {
      "$schema": "https://feedtohtml.example.com/schema.json",
      "timeout": 60,
      "outputDir": "./output",
      "template": "./templates/default.html",
      "userAgent": "feedToHtml/1.0.0 (RSS to HTML converter)",
      "verbose": false,
      "_comments": {
        "timeout": "Network timeout in seconds",
        "outputDir": "Directory for output files (monthly files will be created as YYYY/YYYY-MM.html)",
        "template": "Path to HTML template file",
        "userAgent": "User-Agent header for HTTP requests",
        "verbose": "Enable verbose logging"
      }
    };

    this.saveConfig(new Configuration(sampleConfig), filePath);
  }

  /**
   * List available configuration files
   * @returns {Array<string>} Array of found configuration file paths
   */
  findConfigFiles() {
    const found = [];

    for (const path of this.defaultConfigPaths) {
      const resolvedPath = this.resolvePath(path);
      if (existsSync(resolvedPath)) {
        found.push(resolvedPath);
      }
    }

    return found;
  }

  /**
   * Get configuration summary for logging
   * @param {Configuration} config - Configuration to summarize
   * @returns {string} Configuration summary
   */
  getConfigSummary(config) {
    const summary = [
      `Timeout: ${config.timeout}s`,
      `Output: ${config.outputDir}`,
      `Template: ${config.template || 'default'}`,
      `Mode: monthly grouping`
    ];

    return summary.join(' | ');
  }
}