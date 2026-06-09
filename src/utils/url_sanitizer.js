/**
 * URL sanitization utility for safe HTML attribute output.
 */

const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto']);

/**
 * Sanitize a URL for safe use in an HTML href/src attribute.
 *
 * Allows http/https/mailto and scheme-less URLs (relative paths,
 * protocol-relative `//host`, `/path`, `#fragment`). URLs with any other
 * scheme (javascript:, data:, vbscript:, etc.) are replaced with '#'.
 *
 * HTML-escaping of the returned value is the caller's responsibility.
 *
 * @param {string} rawUrl - Raw URL from untrusted feed content
 * @returns {string} A safe URL string, or '#' if disallowed
 */
export function sanitizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string') {
    return '#';
  }

  // Strip control characters (incl. tab/newline that browsers ignore when
  // parsing a scheme, e.g. "java\tscript:") and surrounding whitespace.
  const cleaned = rawUrl.replace(/[\x00-\x1F\x7F]/g, '').trim();

  if (cleaned === '') {
    return '#';
  }

  // A scheme is: a letter, then letters/digits/+/-/. , then ':'.
  // Protocol-relative ("//host") and relative ("/path", "#frag") URLs do not
  // match because they start with '/' or '#'.
  const schemeMatch = cleaned.match(/^([a-z][a-z0-9+.\-]*):/i);

  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    return ALLOWED_SCHEMES.has(scheme) ? cleaned : '#';
  }

  // No scheme: relative / protocol-relative / fragment — allowed as-is.
  return cleaned;
}
