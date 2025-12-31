/**
 * Monthly Grouping Service for organizing feed items by publication month
 * Items are grouped by YYYY-MM and output to YYYY/YYYY-MM.html structure
 */
export class MonthlyGroupingService {
  /**
   * Group items by year-month based on pubDate
   * Items without pubDate are skipped
   * @param {Array<RSSItem>} items - RSS items to group
   * @returns {Map<string, Array<RSSItem>>} Map of yearMonth key to items array
   */
  groupItemsByMonth(items) {
    const groups = new Map();

    for (const item of items) {
      // Skip items without pubDate
      if (!item.pubDate) {
        continue;
      }

      const yearMonth = this.getYearMonthKey(item.pubDate);

      if (!groups.has(yearMonth)) {
        groups.set(yearMonth, []);
      }
      groups.get(yearMonth).push(item);
    }

    // Sort items within each group by date descending (newest first)
    for (const [key, groupItems] of groups) {
      groupItems.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
    }

    // Sort groups by yearMonth descending (newest month first)
    const sortedGroups = new Map(
      [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    );

    return sortedGroups;
  }

  /**
   * Extract YYYY-MM key from Date object
   * @param {Date} date - Date object
   * @returns {string} YYYY-MM formatted string
   */
  getYearMonthKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Generate file path for monthly output
   * @param {string} yearMonth - YYYY-MM formatted string
   * @param {string} outputDir - Output directory path
   * @returns {string} Full file path (outputDir/YYYY/YYYY-MM.html)
   */
  generateFilePath(yearMonth, outputDir) {
    const [year] = yearMonth.split('-');
    const normalizedDir = outputDir.replace(/\/+$/, ''); // Remove trailing slashes
    return `${normalizedDir}/${year}/${yearMonth}.html`;
  }

  /**
   * Extract year directory path for creation
   * @param {string} yearMonth - YYYY-MM formatted string
   * @param {string} outputDir - Output directory path
   * @returns {string} Year directory path (outputDir/YYYY)
   */
  getYearDirPath(yearMonth, outputDir) {
    const [year] = yearMonth.split('-');
    const normalizedDir = outputDir.replace(/\/+$/, '');
    return `${normalizedDir}/${year}`;
  }

  /**
   * Filter new items for incremental update
   * @param {Array<RSSItem>} newItems - Newly fetched RSS items
   * @param {Date|null} lastDate - Date from existing HTML meta tag
   * @param {Set<string>} existingLinks - Set of links already in HTML
   * @returns {Array<RSSItem>} Items to be added (new items only)
   */
  filterNewItems(newItems, lastDate, existingLinks) {
    return newItems.filter(item => {
      // Skip items without pubDate
      if (!item.pubDate) {
        return false;
      }

      // Skip items with duplicate links (primary check for incremental updates)
      if (existingLinks.has(item.link)) {
        return false;
      }

      // Include all items with pubDate that don't have duplicate links
      return true;
    });
  }

  /**
   * Merge new items with existing items (new items at the beginning)
   * @param {Array<RSSItem>} newItems - New items to add
   * @param {Array<RSSItem>} existingItems - Existing items
   * @returns {Array<RSSItem>} Merged array with new items first
   */
  mergeItems(newItems, existingItems) {
    // Sort new items by date descending
    const sortedNewItems = [...newItems].sort(
      (a, b) => b.pubDate.getTime() - a.pubDate.getTime()
    );

    // New items go first
    return [...sortedNewItems, ...existingItems];
  }

  /**
   * Get all unique year-months from items
   * @param {Array<RSSItem>} items - RSS items
   * @returns {Array<string>} Array of YYYY-MM strings, sorted descending
   */
  getUniqueYearMonths(items) {
    const yearMonths = new Set();

    for (const item of items) {
      if (item.pubDate) {
        yearMonths.add(this.getYearMonthKey(item.pubDate));
      }
    }

    return [...yearMonths].sort((a, b) => b.localeCompare(a));
  }

  /**
   * Count items that will be processed (have valid pubDate)
   * @param {Array<RSSItem>} items - RSS items
   * @returns {number} Count of items with pubDate
   */
  countProcessableItems(items) {
    return items.filter(item => item.pubDate !== null).length;
  }

  /**
   * Count items that will be skipped (no pubDate)
   * @param {Array<RSSItem>} items - RSS items
   * @returns {number} Count of items without pubDate
   */
  countSkippedItems(items) {
    return items.filter(item => item.pubDate === null).length;
  }


  /**
   * Find adjacent (previous and next) months that exist in the available months list
   * @param {string} currentYearMonth - Current YYYY-MM
   * @param {Array<string>} availableMonths - Array of available YYYY-MM strings (sorted ascending)
   * @returns {{prev: string|null, next: string|null}} Previous and next months, null if not found
   */
  findAdjacentMonths(currentYearMonth, availableMonths) {
    // Sort available months ascending for consistent searching
    const sorted = [...availableMonths].sort((a, b) => a.localeCompare(b));
    const currentIndex = sorted.indexOf(currentYearMonth);

    if (currentIndex === -1) {
      return { prev: null, next: null };
    }

    return {
      prev: currentIndex > 0 ? sorted[currentIndex - 1] : null,
      next: currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null
    };
  }

  /**
   * Generate relative path from one monthly file to another
   * @param {string} fromYearMonth - Source YYYY-MM
   * @param {string} toYearMonth - Target YYYY-MM
   * @returns {string} Relative path (e.g., "../2024/2024-12.html" or "2025-02.html")
   */
  generateRelativePath(fromYearMonth, toYearMonth) {
    const [fromYear] = fromYearMonth.split('-');
    const [toYear] = toYearMonth.split('-');

    if (fromYear === toYear) {
      // Same year: just the filename
      return `${toYearMonth}.html`;
    } else {
      // Different year: go up one level and into the target year directory
      return `../${toYear}/${toYearMonth}.html`;
    }
  }
}
