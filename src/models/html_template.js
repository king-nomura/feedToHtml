/**
 * HTMLTemplate model for HTML template with placeholder substitution
 */
export class HTMLTemplate {
  /**
   * Create an HTMLTemplate instance
   * @param {Object} templateData - Template data
   * @param {string} templateData.content - Template content with placeholders
   * @param {Array} [templateData.placeholders] - Available placeholder names
   */
  constructor(templateData) {
    this.content = templateData.content;
    this.placeholders = templateData.placeholders || this.extractPlaceholders();

    this.validate();
  }

  /**
   * Validate the template data
   * @throws {Error} If validation fails
   */
  validate() {
    if (!this.content || typeof this.content !== 'string') {
      throw new Error('Template content is required and must be a string');
    }

    if (this.content.trim().length === 0) {
      throw new Error('Template content cannot be empty');
    }

    // Check for required placeholders
    // {{ITEMS}} can be either a simple placeholder or a block {{#ITEMS}}...{{/ITEMS}}
    const hasItemsPlaceholder = this.content.includes('{{ITEMS}}');
    const hasItemsBlock = /\{\{#ITEMS\}\}[\s\S]*?\{\{\/ITEMS\}\}/.test(this.content);
    const hasItems = hasItemsPlaceholder || hasItemsBlock;

    const missingRequired = [];
    if (!this.content.includes('{{FEED_TITLE}}')) {
      missingRequired.push('{{FEED_TITLE}}');
    }
    if (!hasItems) {
      missingRequired.push('{{ITEMS}} or {{#ITEMS}}...{{/ITEMS}}');
    }

    if (missingRequired.length > 0) {
      console.warn(`Warning: Template missing required placeholders: ${missingRequired.join(', ')}`);
    }

    // Validate that ITEMS appears exactly once (either as placeholder or block)
    const itemsPlaceholderMatches = this.content.match(/\{\{ITEMS\}\}/g) || [];
    const itemsBlockMatches = this.content.match(/\{\{#ITEMS\}\}/g) || [];
    const totalItemsCount = itemsPlaceholderMatches.length + itemsBlockMatches.length;
    
    if (totalItemsCount > 1) {
      throw new Error('{{ITEMS}} or {{#ITEMS}}...{{/ITEMS}} must appear exactly once in template');
    }

    if (!Array.isArray(this.placeholders)) {
      throw new Error('Placeholders must be an array');
    }
  }

  /**
   * Extract all placeholders from template content
   * @returns {Array<string>} Array of placeholder names found in content
   */
  extractPlaceholders() {
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders = [];
    let match;

    while ((match = placeholderRegex.exec(this.content)) !== null) {
      const placeholder = `{{${match[1]}}}`;
      if (!placeholders.includes(placeholder)) {
        placeholders.push(placeholder);
      }
    }

    return placeholders;
  }

  /**
   * Get all supported placeholder names
   * @returns {Array<string>} Array of all supported placeholder names
   */
  static getSupportedPlaceholders() {
    return [
      '{{FEED_TITLE}}',
      '{{FEED_DESCRIPTION}}',
      '{{FEED_LINK}}',
      '{{FEED_LANGUAGE}}',
      '{{GENERATION_DATE}}',
      '{{ITEMS}}',
      '{{YEAR_MONTH}}',
      '{{META_DATE}}',
      '{{TOTAL_ITEMS}}',
      '{{MONTHLY_NAV}}'
    ];
  }

  /**
   * Get feed-level placeholder names
   * @returns {Array<string>} Array of feed-level placeholders
   */
  static getFeedPlaceholders() {
    return [
      '{{FEED_TITLE}}',
      '{{FEED_DESCRIPTION}}',
      '{{FEED_LINK}}',
      '{{FEED_LANGUAGE}}',
      '{{GENERATION_DATE}}'
    ];
  }

  /**
   * Get pagination placeholder names
   * @returns {Array<string>} Array of pagination placeholders
   */
  static getMonthlyPlaceholders() {
    return [
      '{{YEAR_MONTH}}',
      '{{META_DATE}}',
      '{{TOTAL_ITEMS}}'
    ];
  }

  /**
   * Substitute placeholders in template content
   * @param {Object} values - Object with placeholder values
   * @returns {string} Template content with placeholders replaced
   */
  substitute(values) {
    let result = this.content;

    // Replace each placeholder with corresponding value
    Object.entries(values).forEach(([key, value]) => {
      const placeholder = key.startsWith('{{') ? key : `{{${key}}}`;
      const stringValue = value !== null && value !== undefined ? String(value) : '';

      // Use global replacement to handle multiple occurrences
      result = result.replace(new RegExp(this.escapeRegExp(placeholder), 'g'), stringValue);
    });

    return result;
  }

  /**
   * Escape special regex characters in string
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check if template contains a specific placeholder
   * @param {string} placeholder - Placeholder to check (with or without braces)
   * @returns {boolean} True if placeholder exists in template
   */
  hasPlaceholder(placeholder) {
    const normalizedPlaceholder = placeholder.startsWith('{{') ? placeholder : `{{${placeholder}}}`;
    return this.content.includes(normalizedPlaceholder);
  }

  /**
   * Get unused placeholders in the template
   * @returns {Array<string>} Array of placeholders not used in template
   */
  getUnusedPlaceholders() {
    const supported = HTMLTemplate.getSupportedPlaceholders();
    return supported.filter(placeholder => !this.hasPlaceholder(placeholder));
  }

  /**
   * Get unknown placeholders in the template
   * @returns {Array<string>} Array of placeholders not in supported list
   */
  getUnknownPlaceholders() {
    const supported = HTMLTemplate.getSupportedPlaceholders();
    return this.placeholders.filter(placeholder => !supported.includes(placeholder));
  }

  /**
   * Validate template content as HTML
   * @returns {boolean} True if content appears to be valid HTML
   */
  isValidHTML() {
    // Basic HTML validation
    const hasDoctype = /<!DOCTYPE\s+html>/i.test(this.content);
    const hasHtmlTag = /<html[^>]*>/i.test(this.content);
    const hasHeadTag = /<head[^>]*>/i.test(this.content);
    const hasBodyTag = /<body[^>]*>/i.test(this.content);

    return hasDoctype && hasHtmlTag && hasHeadTag && hasBodyTag;
  }

  /**
   * Get a plain object representation of the template
   * @returns {Object} Plain object with template data
   */
  toJSON() {
    return {
      content: this.content,
      placeholders: [...this.placeholders]
    };
  }

  /**
   * Get default HTML template content
   * @returns {string} Default template content
   */
  static getDefaultTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="date" content="{{META_DATE}}">
    <title>{{FEED_TITLE}} - {{YEAR_MONTH}}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        header { border-bottom: 2px solid #333; margin-bottom: 20px; }
        article { margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        .meta { color: #666; margin-bottom: 10px; }
        .categories { margin-top: 10px; font-size: 0.9em; color: #666; }
        h1 { color: #333; }
        h2 { color: #555; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .monthly-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1em 0;
            margin: 1em 0;
            border-top: 1px solid #eee;
            border-bottom: 1px solid #eee;
        }
        .monthly-nav a {
            padding: 0.5em 1em;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .monthly-nav a:hover {
            background-color: #f5f5f5;
        }
        .monthly-nav .current-month {
            font-weight: bold;
        }
        .monthly-nav .disabled {
            visibility: hidden;
            padding: 0.5em 1em;
        }
    </style>
</head>
<body>
    <header>
        <h1>{{FEED_TITLE}}</h1>
        <p>{{FEED_DESCRIPTION}}</p>
        <p><a href="{{FEED_LINK}}">Visit Original Site</a></p>
        <p>{{YEAR_MONTH}}</p>
    </header>

    {{MONTHLY_NAV}}

    <main>
        {{ITEMS}}
    </main>

    <footer>
        <p>Generated on {{GENERATION_DATE}}</p>
    </footer>
</body>
</html>`;
  }

  /**
   * Create HTMLTemplate from file content
   * @param {string} content - Template file content
   * @returns {HTMLTemplate} New HTMLTemplate instance
   */
  static fromContent(content) {
    return new HTMLTemplate({ content });
  }

  /**
   * Create default HTMLTemplate
   * @returns {HTMLTemplate} Template with default content
   */
  /**
   * Create HTMLTemplate from file
   * @param {string} filePath - Path to template file
   * @returns {Promise<HTMLTemplate>} New HTMLTemplate instance
   */
  static async loadFromFile(filePath) {
    const { readFile } = await import('node:fs/promises');
    
    try {
      const content = await readFile(filePath, 'utf-8');
      return new HTMLTemplate({ content });
    } catch (error) {
      throw new Error(`Failed to load template file: ${error.message}`);
    }
  }

  static createDefault() {
    return new HTMLTemplate({ content: HTMLTemplate.getDefaultTemplate() });
  }
}