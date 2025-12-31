/**
 * URL Validator utility for RSS feed URLs
 */
export class URLValidator {
  constructor() {
    this.allowedProtocols = ['http:', 'https:'];
    this.blockedDomains = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      'example.com',
      'example.org',
      'example.net'
    ];
  }

  /**
   * Validate RSS feed URL
   * @param {string} urlString - URL to validate
   * @param {Object} [options] - Validation options
   * @param {boolean} [options.allowLocal=false] - Allow local/localhost URLs
   * @param {boolean} [options.allowInsecure=true] - Allow HTTP URLs
   * @param {Array<string>} [options.allowedDomains] - Whitelist of allowed domains
   * @param {Array<string>} [options.blockedDomains] - Additional blocked domains
   * @returns {Object} Validation result
   */
  validate(urlString, options = {}) {
    const result = {
      isValid: false,
      url: null,
      errors: [],
      warnings: []
    };

    try {
      // Basic URL parsing
      const url = new URL(urlString);
      result.url = url;

      // Check protocol
      if (!this.allowedProtocols.includes(url.protocol)) {
        result.errors.push(`Unsupported protocol: ${url.protocol}. Only HTTP and HTTPS are allowed.`);
        return result;
      }

      // Check for HTTP if not allowed
      if (!options.allowInsecure && url.protocol === 'http:') {
        result.warnings.push('HTTP URL detected. HTTPS is recommended for security.');
      }

      // Check hostname
      if (!this.isValidHostname(url.hostname)) {
        result.errors.push(`Invalid hostname: ${url.hostname}`);
        return result;
      }

      // Check for local/private URLs
      if (!options.allowLocal && this.isLocalUrl(url)) {
        result.errors.push(`Local/private URLs are not allowed: ${url.hostname}`);
        return result;
      }

      // Check blocked domains
      const blockedDomains = [...this.blockedDomains, ...(options.blockedDomains || [])];
      if (this.isBlockedDomain(url.hostname, blockedDomains)) {
        result.errors.push(`Domain is blocked: ${url.hostname}`);
        return result;
      }

      // Check allowed domains (if specified)
      if (options.allowedDomains && options.allowedDomains.length > 0) {
        if (!this.isAllowedDomain(url.hostname, options.allowedDomains)) {
          result.errors.push(`Domain is not in allowed list: ${url.hostname}`);
          return result;
        }
      }

      // Check for suspicious patterns
      const suspiciousPatterns = this.checkSuspiciousPatterns(url);
      if (suspiciousPatterns.length > 0) {
        result.warnings.push(...suspiciousPatterns);
      }

      // URL appears valid
      result.isValid = true;

    } catch (error) {
      result.errors.push(`Invalid URL format: ${error.message}`);
    }

    return result;
  }

  /**
   * Check if hostname is valid
   * @param {string} hostname - Hostname to check
   * @returns {boolean} True if valid
   */
  isValidHostname(hostname) {
    if (!hostname || hostname.length === 0) {
      return false;
    }

    // Check for valid domain format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;

    // Check for valid IP address format
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

    return domainRegex.test(hostname) || ipv4Regex.test(hostname) || ipv6Regex.test(hostname);
  }

  /**
   * Check if URL is local/private
   * @param {URL} url - URL object
   * @returns {boolean} True if local/private
   */
  isLocalUrl(url) {
    const hostname = url.hostname.toLowerCase();

    // Check for localhost variants
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)) {
      return true;
    }

    // Check for private IP ranges
    if (this.isPrivateIP(hostname)) {
      return true;
    }

    // Check for .local domains
    if (hostname.endsWith('.local')) {
      return true;
    }

    return false;
  }

  /**
   * Check if IP address is in private range
   * @param {string} ip - IP address
   * @returns {boolean} True if private
   */
  isPrivateIP(ip) {
    // IPv4 private ranges
    const privateRanges = [
      /^10\./,                    // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
      /^192\.168\./,              // 192.168.0.0/16
      /^169\.254\./               // 169.254.0.0/16 (link-local)
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Check if domain is blocked
   * @param {string} hostname - Hostname to check
   * @param {Array<string>} blockedDomains - List of blocked domains
   * @returns {boolean} True if blocked
   */
  isBlockedDomain(hostname, blockedDomains) {
    const normalizedHostname = hostname.toLowerCase();

    return blockedDomains.some(blocked => {
      const normalizedBlocked = blocked.toLowerCase();

      // Exact match
      if (normalizedHostname === normalizedBlocked) {
        return true;
      }

      // Subdomain match
      if (normalizedHostname.endsWith(`.${normalizedBlocked}`)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Check if domain is in allowed list
   * @param {string} hostname - Hostname to check
   * @param {Array<string>} allowedDomains - List of allowed domains
   * @returns {boolean} True if allowed
   */
  isAllowedDomain(hostname, allowedDomains) {
    const normalizedHostname = hostname.toLowerCase();

    return allowedDomains.some(allowed => {
      const normalizedAllowed = allowed.toLowerCase();

      // Exact match
      if (normalizedHostname === normalizedAllowed) {
        return true;
      }

      // Subdomain match
      if (normalizedHostname.endsWith(`.${normalizedAllowed}`)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Check for suspicious URL patterns
   * @param {URL} url - URL object
   * @returns {Array<string>} Array of warning messages
   */
  checkSuspiciousPatterns(url) {
    const warnings = [];

    // Check for suspicious path patterns
    const suspiciousPaths = [
      /\/wp-content\/uploads\//,  // WordPress uploads (might not be RSS)
      /\/images?\//,              // Image directories
      /\/assets?\//,              // Asset directories
      /\/static\//,               // Static file directories
      /\.(jpg|jpeg|png|gif|css|js)$/i // File extensions that aren't RSS
    ];

    if (suspiciousPaths.some(pattern => pattern.test(url.pathname))) {
      warnings.push('URL path looks like it might not be an RSS feed');
    }

    // Check for non-standard ports
    if (url.port && !['80', '443', '8080', '8443'].includes(url.port)) {
      warnings.push(`Non-standard port detected: ${url.port}`);
    }

    // Check for very long URLs
    if (url.href.length > 2000) {
      warnings.push('URL is very long, which might indicate a problem');
    }

    // Check for suspicious query parameters
    const suspiciousParams = ['redirect', 'url', 'goto', 'link'];
    if (suspiciousParams.some(param => url.searchParams.has(param))) {
      warnings.push('URL contains parameters that might indicate redirection');
    }

    return warnings;
  }

  /**
   * Normalize URL for consistent processing
   * @param {string} urlString - URL to normalize
   * @returns {string} Normalized URL
   */
  normalize(urlString) {
    try {
      const url = new URL(urlString);

      // Remove fragment
      url.hash = '';

      // Sort query parameters for consistency
      const params = Array.from(url.searchParams.entries()).sort();
      url.search = '';
      params.forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      // Remove trailing slash from pathname unless it's the root
      if (url.pathname !== '/' && url.pathname.endsWith('/')) {
        url.pathname = url.pathname.slice(0, -1);
      }

      return url.href;
    } catch (error) {
      return urlString;
    }
  }

  /**
   * Extract domain from URL
   * @param {string} urlString - URL string
   * @returns {string|null} Domain or null if invalid
   */
  extractDomain(urlString) {
    try {
      const url = new URL(urlString);
      return url.hostname;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if URL looks like an RSS feed
   * @param {string} urlString - URL to check
   * @returns {Object} Analysis result
   */
  analyzeRSSLikelihood(urlString) {
    const result = {
      likelihood: 0,
      indicators: [],
      score: 'unknown'
    };

    try {
      const url = new URL(urlString);

      // Positive indicators
      const positivePatterns = [
        { pattern: /\/rss/i, weight: 40, description: 'Contains "rss" in path' },
        { pattern: /\/feed/i, weight: 40, description: 'Contains "feed" in path' },
        { pattern: /\/atom/i, weight: 35, description: 'Contains "atom" in path' },
        { pattern: /\.xml$/i, weight: 30, description: 'Ends with .xml' },
        { pattern: /\/index\.xml$/i, weight: 35, description: 'Ends with index.xml' },
        { pattern: /\/rss\.xml$/i, weight: 45, description: 'Ends with rss.xml' },
        { pattern: /\/feed\.xml$/i, weight: 45, description: 'Ends with feed.xml' },
        { pattern: /\/atom\.xml$/i, weight: 45, description: 'Ends with atom.xml' }
      ];

      // Negative indicators
      const negativePatterns = [
        { pattern: /\.(jpg|jpeg|png|gif|css|js|pdf)$/i, weight: -50, description: 'Ends with non-RSS file extension' },
        { pattern: /\/wp-content\/uploads\//i, weight: -30, description: 'WordPress uploads directory' },
        { pattern: /\/images?\//i, weight: -25, description: 'Image directory' },
        { pattern: /\/assets?\//i, weight: -25, description: 'Assets directory' }
      ];

      // Check patterns
      [...positivePatterns, ...negativePatterns].forEach(({ pattern, weight, description }) => {
        if (pattern.test(url.href)) {
          result.likelihood += weight;
          result.indicators.push({ description, weight });
        }
      });

      // Determine score
      if (result.likelihood >= 40) {
        result.score = 'high';
      } else if (result.likelihood >= 20) {
        result.score = 'medium';
      } else if (result.likelihood >= 0) {
        result.score = 'low';
      } else {
        result.score = 'very-low';
      }

    } catch (error) {
      result.indicators.push({ description: 'Invalid URL format', weight: -100 });
      result.score = 'invalid';
    }

    return result;
  }
}