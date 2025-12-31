/**
 * HTML Parser Service for analyzing existing HTML files
 * Used for incremental updates: extracting meta date and existing item links
 */
export class HtmlParserService {
  /**
   * Extract date from <meta name="date" content="..."> tag
   * @param {string} htmlContent - HTML content string
   * @returns {Date|null} Parsed date or null if not found/invalid
   */
  extractMetaDate(htmlContent) {
    // Match both attribute orders: name then content, or content then name
    const patterns = [
      /<meta\s+name=["']date["']\s+content=["']([^"']+)["']\s*\/?>/i,
      /<meta\s+content=["']([^"']+)["']\s+name=["']date["']\s*\/?>/i
    ];

    for (const pattern of patterns) {
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        try {
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            return date;
          }
        } catch (error) {
          // Invalid date format, continue to next pattern
        }
      }
    }

    return null;
  }

  /**
   * Extract existing item links from HTML
   * Looks for links within <article> elements
   * @param {string} htmlContent - HTML content string
   * @returns {Set<string>} Set of link URLs
   */
  extractExistingLinks(htmlContent) {
    const links = new Set();

    // Find all article blocks
    const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    let articleMatch;

    while ((articleMatch = articleRegex.exec(htmlContent)) !== null) {
      const articleContent = articleMatch[1];

      // Extract href from anchor tags within article
      // Primary pattern: <h2><a href="...">
      const h2LinkRegex = /<h2[^>]*>\s*<a\s+[^>]*href=["']([^"']+)["']/i;
      const h2Match = articleContent.match(h2LinkRegex);

      if (h2Match && h2Match[1]) {
        links.add(h2Match[1]);
        continue;
      }

      // Fallback: any anchor with href in article
      const anyLinkRegex = /<a\s+[^>]*href=["']([^"']+)["']/gi;
      let linkMatch;

      while ((linkMatch = anyLinkRegex.exec(articleContent)) !== null) {
        if (linkMatch[1] && !linkMatch[1].startsWith('#')) {
          links.add(linkMatch[1]);
          break; // Take only first non-anchor link
        }
      }
    }

    return links;
  }

  /**
   * Update meta date tag in HTML content
   * @param {string} htmlContent - HTML content string
   * @param {Date} newDate - New date to set
   * @returns {string} Updated HTML content
   */
  updateMetaDate(htmlContent, newDate) {
    const isoDate = newDate.toISOString();

    // Pattern to match existing meta date tag
    const existingMetaRegex = /<meta\s+(name=["']date["']\s+content=["'])[^"']*["']/i;
    const existingMetaRegex2 = /<meta\s+(content=["'])[^"']*["']\s+(name=["']date["'])/i;

    if (existingMetaRegex.test(htmlContent)) {
      return htmlContent.replace(existingMetaRegex, `<meta $1${isoDate}"`);
    }

    if (existingMetaRegex2.test(htmlContent)) {
      return htmlContent.replace(existingMetaRegex2, `<meta $1${isoDate}" $2`);
    }

    // If meta tag doesn't exist, add it after <head>
    const headRegex = /(<head[^>]*>)/i;
    if (headRegex.test(htmlContent)) {
      return htmlContent.replace(
        headRegex,
        `$1\n    <meta name="date" content="${isoDate}">`
      );
    }

    // Fallback: return unchanged if no suitable location found
    return htmlContent;
  }

  /**
   * Check if HTML content has meta date tag
   * @param {string} htmlContent - HTML content string
   * @returns {boolean} True if meta date tag exists
   */
  hasMetaDate(htmlContent) {
    return this.extractMetaDate(htmlContent) !== null;
  }

  /**
   * Extract the main content section where items are rendered
   * @param {string} htmlContent - HTML content string
   * @returns {string|null} Content within main tag or null
   */
  extractMainContent(htmlContent) {
    const mainRegex = /<main[^>]*>([\s\S]*?)<\/main>/i;
    const match = htmlContent.match(mainRegex);
    return match ? match[1].trim() : null;
  }

  /**
   * Count the number of articles in HTML
   * @param {string} htmlContent - HTML content string
   * @returns {number} Count of article elements
   */
  countArticles(htmlContent) {
    const articleRegex = /<article[^>]*>/gi;
    const matches = htmlContent.match(articleRegex);
    return matches ? matches.length : 0;
  }

  /**
   * Extract all article HTML blocks
   * @param {string} htmlContent - HTML content string
   * @returns {Array<string>} Array of article HTML strings
   */
  extractArticleBlocks(htmlContent) {
    const articles = [];
    const articleRegex = /<article[^>]*>[\s\S]*?<\/article>/gi;
    let match;

    while ((match = articleRegex.exec(htmlContent)) !== null) {
      articles.push(match[0]);
    }

    return articles;
  }
}
