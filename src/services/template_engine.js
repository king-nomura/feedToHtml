import { HTMLTemplate } from '../models/html_template.js';

/**
 * Template Engine Service for HTML template processing and placeholder substitution
 */
export class TemplateEngine {
  constructor(dateFormat = null) {
    this.dateFormat = dateFormat;
    this.itemTemplate = `<article>
    <h2><a href="{{ITEM_LINK}}">{{ITEM_TITLE}}</a></h2>
    <div class="meta">
        <time>{{ITEM_DATE}}</time>
        {{#ITEM_AUTHOR}}<span class="author">by {{ITEM_AUTHOR}}</span>{{/ITEM_AUTHOR}}
    </div>
    <div class="content">{{ITEM_DESCRIPTION}}</div>
    {{#ITEM_CATEGORIES}}
    <div class="categories">
        Tags: {{ITEM_CATEGORIES}}
    </div>
    {{/ITEM_CATEGORIES}}
</article>`;
  }

  /**
   * Extract item template from {{#ITEMS}}...{{/ITEMS}} block in the template
   * @param {string} templateContent - The template content
   * @returns {{ itemTemplate: string|null, processedContent: string }}
   */
  extractItemTemplate(templateContent) {
    const itemBlockRegex = /\{\{#ITEMS\}\}([\s\S]*?)\{\{\/ITEMS\}\}/;
    const match = templateContent.match(itemBlockRegex);
    
    if (match) {
      const extractedTemplate = match[1].trim();
      const processedContent = templateContent.replace(itemBlockRegex, '{{ITEMS}}');
      return {
        itemTemplate: extractedTemplate,
        processedContent
      };
    }
    
    return {
      itemTemplate: null,
      processedContent: templateContent
    };
  }

  /**
   * Generate HTML from RSS feed using template
   * @param {RSSFeed} feed - RSS feed data
   * @param {HTMLTemplate} template - HTML template
   * @param {Object} options - Generation options
   * @param {string} [options.yearMonth] - Year-month string (YYYY-MM) for monthly output
   * @param {Array} [options.pageItems] - Items for current page (subset of feed items)
   * @returns {string} Generated HTML content
   */
  generateHTML(feed, template, options = {}) {
    try {
      // Extract item template from {{#ITEMS}}...{{/ITEMS}} block if present
      const { itemTemplate, processedContent } = this.extractItemTemplate(template.content);
      if (itemTemplate) {
        this.itemTemplate = itemTemplate;
      }

      // Prepare base substitution values
      const values = this.prepareFeedValues(feed);

      // Add monthly values if provided
      if (options.yearMonth) {
        Object.assign(values, this.prepareMonthlyValues(options));
      }

      // Generate items HTML
      const itemsToRender = options.pageItems || feed.items;
      values.ITEMS = this.generateItemsHTML(itemsToRender);

      // Add generation date
      values.GENERATION_DATE = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // Create a temporary template with processed content for substitution
      const processedTemplate = {
        substitute: (vals) => {
          let result = processedContent;
          Object.entries(vals).forEach(([key, value]) => {
            const placeholder = `{{${key}}}`;
            result = result.replace(new RegExp(this.escapeRegExp(placeholder), 'g'), value);
          });
          return result;
        }
      };

      // Perform substitution
      return processedTemplate.substitute(values);
    } catch (error) {
      throw new Error(`Template processing failed: ${error.message}`);
    }
  }

  /**
   * Prepare feed-level template values
   * @param {RSSFeed} feed - RSS feed
   * @returns {Object} Template values
   */
  prepareFeedValues(feed) {
    return {
      FEED_TITLE: feed.title || '',
      FEED_DESCRIPTION: feed.description || '',
      FEED_LINK: feed.link || '',
      FEED_LANGUAGE: feed.language || 'en',
      TOTAL_ITEMS: feed.getItemCount().toString()
    };
  }

  /**
   * Prepare monthly output template values
   * @param {Object} options - Monthly options
   * @returns {Object} Monthly template values
   */
  prepareMonthlyValues(options) {
    const yearMonth = options.yearMonth || '';
    const metaDate = new Date().toISOString();

    const values = {
      YEAR_MONTH: yearMonth,
      META_DATE: metaDate
    };

    // Add monthly navigation if adjacent months info is provided
    if (options.adjacentMonths) {
      values.MONTHLY_NAV = this.createMonthlyNavigation(
        yearMonth,
        options.adjacentMonths,
        options.generateRelativePath
      );
    } else {
      values.MONTHLY_NAV = '';
    }

    return values;
  }

  /**
   * Generate HTML for feed items
   * @param {Array<RSSItem>} items - Feed items
   * @returns {string} Generated items HTML
   */
  generateItemsHTML(items) {
    if (!items || items.length === 0) {
      return '<p>No items available.</p>';
    }

    return items.map(item => this.generateItemHTML(item)).join('\n\n');
  }

  /**
   * Generate HTML for single feed item
   * @param {RSSItem} item - RSS item
   * @returns {string} Generated item HTML
   */
  generateItemHTML(item) {
    const itemValues = {
      ITEM_TITLE: this.escapeHTML(item.title || 'Untitled'),
      ITEM_LINK: item.link || '#',
      ITEM_DESCRIPTION: this.processItemDescription(item.description || ''),
      ITEM_DATE: this.formatItemDate(item),
      ITEM_AUTHOR: item.hasAuthor() ? this.escapeHTML(item.author) : '',
      ITEM_CATEGORIES: item.hasCategories() ? this.escapeHTML(item.getCategoriesString()) : ''
    };

    // Use conditional templating for optional fields
    let html = this.itemTemplate;

    // Handle conditional author section
    if (item.hasAuthor()) {
      html = html.replace(/\{\{#ITEM_AUTHOR\}\}/g, '').replace(/\{\{\/ITEM_AUTHOR\}\}/g, '');
    } else {
      html = html.replace(/\{\{#ITEM_AUTHOR\}\}.*?\{\{\/ITEM_AUTHOR\}\}/gs, '');
    }

    // Handle conditional categories section
    if (item.hasCategories()) {
      html = html.replace(/\{\{#ITEM_CATEGORIES\}\}/g, '').replace(/\{\{\/ITEM_CATEGORIES\}\}/g, '');
    } else {
      html = html.replace(/\{\{#ITEM_CATEGORIES\}\}.*?\{\{\/ITEM_CATEGORIES\}\}/gs, '');
    }

    // Substitute remaining placeholders
    Object.entries(itemValues).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      html = html.replace(new RegExp(this.escapeRegExp(placeholder), 'g'), value);
    });

    return html;
  }

  /**
   * Process item description (clean HTML, truncate if needed)
   * @param {string} description - Raw description
   * @returns {string} Processed description
   */
  processItemDescription(description) {
    if (!description) return '';

    // Remove or escape potentially dangerous HTML
    let processed = description
      .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
      .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '') // Remove iframe tags
      .replace(/on\w+="[^"]*"/gi, ''); // Remove event handlers

    // Convert relative URLs to absolute (basic implementation)
    // This is a simplified version - a full implementation would need the base URL
    processed = processed.replace(/src="\/([^"]+)"/g, 'src="/$1"');

    return processed;
  }

  /**
   * Format item publication date
   * @param {RSSItem} item - RSS item
   * @returns {string} Formatted date
   */
  formatItemDate(item) {
    if (!item.pubDate) return '';

    try {
      // Use custom dateFormat if provided, otherwise use default
      const locale = this.dateFormat?.locale || 'en-US';
      const options = this.dateFormat?.options || {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return item.pubDate.toLocaleDateString(locale, options);
    } catch (error) {
      return item.getFormattedPubDate();
    }
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHTML(text) {
    if (!text) return '';

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escape special regex characters
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Validate template has required elements
   * @param {HTMLTemplate} template - Template to validate
   * @throws {Error} If template is invalid
   */
  validateTemplate(template) {
    if (!template || !(template instanceof HTMLTemplate)) {
      throw new Error('Invalid template: must be HTMLTemplate instance');
    }

    // Check for required placeholders
    // {{ITEMS}} can be either a simple placeholder or a block {{#ITEMS}}...{{/ITEMS}}
    const hasItemsPlaceholder = template.content.includes('{{ITEMS}}');
    const hasItemsBlock = /\{\{#ITEMS\}\}[\s\S]*?\{\{\/ITEMS\}\}/.test(template.content);
    const hasItems = hasItemsPlaceholder || hasItemsBlock;

    const missing = [];
    if (!template.hasPlaceholder('{{FEED_TITLE}}')) {
      missing.push('{{FEED_TITLE}}');
    }
    if (!hasItems) {
      missing.push('{{ITEMS}} or {{#ITEMS}}...{{/ITEMS}}');
    }

    if (missing.length > 0) {
      console.warn(`Template missing recommended placeholders: ${missing.join(', ')}`);
    }

    // Validate ITEMS appears exactly once (either as placeholder or block)
    const itemsPlaceholderCount = (template.content.match(/\{\{ITEMS\}\}/g) || []).length;
    const itemsBlockCount = (template.content.match(/\{\{#ITEMS\}\}/g) || []).length;
    const totalItemsCount = itemsPlaceholderCount + itemsBlockCount;

    if (totalItemsCount !== 1) {
      throw new Error('{{ITEMS}} or {{#ITEMS}}...{{/ITEMS}} must appear exactly once in template');
    }
  }

  /**
   * Create pagination navigation HTML
   * @param {number} currentPage - Current page number
   * @param {number} totalPages - Total number of pages
   * @param {string} baseFilename - Base filename for links
   * @returns {string} Navigation HTML
   */
  createPaginationNav(currentPage, totalPages, baseFilename) {
    if (totalPages <= 1) return '';

    let nav = '<nav class="pagination">\n';

    // Previous page link
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      const prevFile = prevPage === 1 ? baseFilename : `${baseFilename.replace('.html', '')}-${prevPage}.html`;
      nav += `  <a href="${prevFile}">&laquo; Previous</a>\n`;
    }

    // Page numbers
    nav += '  <span class="page-numbers">\n';
    for (let i = 1; i <= totalPages; i++) {
      const pageFile = i === 1 ? baseFilename : `${baseFilename.replace('.html', '')}-${i}.html`;

      if (i === currentPage) {
        nav += `    <span class="current-page">${i}</span>\n`;
      } else {
        nav += `    <a href="${pageFile}">${i}</a>\n`;
      }
    }
    nav += '  </span>\n';

    // Next page link
    if (currentPage < totalPages) {
      const nextPage = currentPage + 1;
      const nextFile = `${baseFilename.replace('.html', '')}-${nextPage}.html`;
      nav += `  <a href="${nextFile}">Next &raquo;</a>\n`;
    }

    nav += '</nav>';

    return nav;
  }

  /**
   * Process conditional template sections
   * @param {string} template - Template content
   * @param {Object} conditions - Condition values
   * @returns {string} Processed template
   */
  processConditionals(template, conditions) {
    let processed = template;

    // Handle {{#CONDITION}}...{{/CONDITION}} blocks
    const conditionalRegex = /\{\{#(\w+)\}\}(.*?)\{\{\/\1\}\}/gs;

    processed = processed.replace(conditionalRegex, (match, conditionName, content) => {
      const conditionValue = conditions[conditionName];

      // Include content if condition is truthy
      if (conditionValue && conditionValue !== '' && conditionValue !== '0' && conditionValue !== 'false') {
        return content;
      }

      return '';
    });

    return processed;
  }

  /**
   * Add CSS for pagination styling
   * @param {string} html - HTML content
   * @returns {string} HTML with pagination CSS added
   */
  addPaginationCSS(html) {
    const paginationCSS = `
    <style>
      .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 2em 0;
        gap: 0.5em;
      }
      .pagination a,
      .pagination .current-page {
        padding: 0.5em 1em;
        text-decoration: none;
        border: 1px solid #ddd;
        color: #0066cc;
      }
      .pagination a:hover {
        background-color: #f5f5f5;
      }
      .pagination .current-page {
        background-color: #0066cc;
        color: white;
        border-color: #0066cc;
      }
      .pagination .page-numbers {
        display: flex;
        gap: 0.25em;
      }
    </style>`;

    // Insert CSS before closing head tag
    return html.replace('</head>', `${paginationCSS}\n</head>`);
  }


  /**
   * Create monthly navigation HTML with links to previous and next months
   * @param {string} currentYearMonth - Current YYYY-MM
   * @param {{prev: string|null, next: string|null}} adjacentMonths - Adjacent months info
   * @param {Function} generateRelativePath - Function to generate relative paths
   * @returns {string} Navigation HTML
   */
  createMonthlyNavigation(currentYearMonth, adjacentMonths, generateRelativePath) {
    const { prev, next } = adjacentMonths;

    // Return empty string if no adjacent months exist
    if (!prev && !next) {
      return '';
    }

    let nav = '<nav class="monthly-nav">\n';

    // Next month link (left side)
    if (next) {
      const nextPath = generateRelativePath(currentYearMonth, next);
      nav += `  <a href="${nextPath}" class="next-month">&laquo; ${next}</a>\n`;
    } else {
      nav += `  <span class="next-month disabled"></span>\n`;
    }

    // Current month indicator
    nav += `  <span class="current-month">${currentYearMonth}</span>\n`;

    // Previous month link (right side)
    if (prev) {
      const prevPath = generateRelativePath(currentYearMonth, prev);
      nav += `  <a href="${prevPath}" class="prev-month">${prev} &raquo;</a>\n`;
    } else {
      nav += `  <span class="prev-month disabled"></span>\n`;
    }

    nav += '</nav>';

    return nav;
  }


  /**
   * Update the "next" link in an existing HTML file's monthly navigation
   * @param {string} html - Existing HTML content
   * @param {string} nextYearMonth - The next month to link to (YYYY-MM format)
   * @param {Function} generateRelativePath - Function to generate relative paths
   * @param {string} currentYearMonth - Current page's year-month
   * @returns {string} Updated HTML content
   */
  updateNextLink(html, nextYearMonth, generateRelativePath, currentYearMonth) {
    // Check if there's already a next link (not just a disabled placeholder)
    const hasNextLink = /<a[^>]+class="[^"]*next-month[^"]*"[^>]*>/.test(html);
    
    if (hasNextLink) {
      // Already has a next link, no update needed
      return html;
    }

    // Find the disabled next-month placeholder and replace with actual link
    const disabledNextPattern = /<span class="next-month disabled"><\/span>/;
    
    if (disabledNextPattern.test(html)) {
      const nextPath = generateRelativePath(currentYearMonth, nextYearMonth);
      const nextLink = `<a href="${nextPath}" class="next-month">&laquo; ${nextYearMonth}</a>`;
      return html.replace(disabledNextPattern, nextLink);
    }

    // No monthly-nav found or unexpected format
    return html;
  }
}