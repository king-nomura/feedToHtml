import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Service for updating sitemap.xml with newly generated monthly HTML pages
 */
export class SitemapService {
  /**
   * Update sitemap.xml when a new monthly HTML file is created
   * - Adds a new <url> entry with changefreq "daily" for the new page
   * - Changes existing entries with changefreq "daily" to "never"
   * @param {Object} config - Configuration with baseUrl and sitemap
   * @param {string} outputDir - Output directory path
   * @param {string} newFilePath - Path to newly created HTML file
   * @param {Object} [options] - Options
   * @param {boolean} [options.verbose] - Enable verbose logging
   */
  updateSitemap(config, outputDir, newFilePath, options = {}) {
    if (!config.baseUrl || !config.sitemap) {
      return;
    }

    const sitemapPath = join(outputDir, config.sitemap);
    const relativeFilePath = relative(outputDir, newFilePath);

    // Build the URL for the new page
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    const newUrl = `${baseUrl}/${relativeFilePath}`;

    if (existsSync(sitemapPath)) {
      // Read existing sitemap
      let content = readFileSync(sitemapPath, 'utf-8');

      // Change existing "daily" entries to "never"
      content = content.replace(
        /<changefreq>daily<\/changefreq>/g,
        '<changefreq>never</changefreq>'
      );

      // Insert new entry after <urlset...> opening tag
      const newEntry = this.createUrlEntry(newUrl, 'daily');
      content = content.replace(
        /(<urlset[^>]*>)\s*/,
        `$1\n${newEntry}\n`
      );

      writeFileSync(sitemapPath, content, 'utf-8');
    } else {
      // Create new sitemap.xml
      const newEntry = this.createUrlEntry(newUrl, 'daily');
      const content = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${newEntry}\n</urlset>\n`;

      writeFileSync(sitemapPath, content, 'utf-8');
    }

    if (options.verbose) {
      console.log(`Updated sitemap: ${config.sitemap} (added ${newUrl})`);
    }
  }

  /**
   * Create a single <url> entry for sitemap.xml
   * @param {string} loc - URL location
   * @param {string} changefreq - Change frequency
   * @returns {string} XML <url> element
   */
  createUrlEntry(loc, changefreq) {
    return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n  </url>`;
  }
}
