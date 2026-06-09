/**
 * Rich-text sanitizer for feed description fields.
 *
 * Allows only <br> and <a href> (with auto-added rel/target). All other tags
 * are stripped (their text content is kept). Everything is HTML-escaped first,
 * so any restore/strip gap fails safe to inert text rather than live markup.
 *
 * Known limitation: a literal '>' inside an attribute value (e.g.
 * <a title="a>b" href="...">) ends the tag match early, so the link may lose
 * its href and the attribute remainder leaks as visible (escaped) text. This is
 * a rare cosmetic/content issue, never a security one — the leaked remainder
 * stays HTML-escaped and inert.
 *
 * Performance: the tag-matching regexes are bounded (they never scan across a
 * '&gt;' and give up after MAX_TAG_BODY chars). This keeps them linear in input
 * size — an unbounded ".*?&gt;" would be O(n^2) on input with many unterminated
 * "<a" starts (a DoS vector, since feed bodies are untrusted). A tag longer than
 * the bound is simply not recognized and stays safely escaped (fail-safe).
 */

import { sanitizeUrl } from './url_sanitizer.js';
import { escapeHTML } from './html_escape.js';

// Upper bound on the escaped length of a single tag body. Real <br>/<a> tags
// are far shorter; anything longer stays escaped rather than being parsed.
const MAX_TAG_BODY = 2048;

// One escaped character that is not the start of '&gt;'. Repeated up to
// MAX_TAG_BODY times, this matches a tag body without crossing the terminator
// and without unbounded backtracking.
const TAG_BODY = `(?:(?!&gt;)[^]){0,${MAX_TAG_BODY}}`;

const ANCHOR_OPEN_RE = new RegExp(`&lt;a\\b${TAG_BODY}&gt;`, 'gi');
const STRIP_TAG_RE = new RegExp(`&lt;\\/?[a-z][a-z0-9]*\\b${TAG_BODY}&gt;`, 'gi');

/**
 * Reverse the escaping done by escapeHTML, for extracting a raw attribute value.
 * @param {string} text
 * @returns {string}
 */
function unescapeHTML(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Build a safe <a> opening tag from an already-escaped tag string.
 * @param {string} escapedTag - e.g. '&lt;a href=&quot;...&quot;&gt;'
 * @returns {string} '<a href="..." rel="nofollow noopener" target="_blank">'
 */
function buildAnchor(escapedTag) {
  // href value may be wrapped in escaped double-quote, escaped single-quote,
  // or be unquoted. Try quoted forms first, then unquoted.
  const hrefMatch =
    escapedTag.match(/href=&quot;([^]*?)&quot;/i) ||
    escapedTag.match(/href=&#39;([^]*?)&#39;/i) ||
    escapedTag.match(/href=([^\s&]+)/i);

  let safeHref = '#';
  if (hrefMatch) {
    const rawHref = unescapeHTML(hrefMatch[1]);
    safeHref = escapeHTML(sanitizeUrl(rawHref));
  }

  return `<a href="${safeHref}" rel="nofollow noopener" target="_blank">`;
}

/**
 * Sanitize feed description rich text, allowing only <br> and <a href>.
 * @param {string} text - Untrusted feed body
 * @returns {string} Safe-to-embed HTML string
 */
export function sanitizeRichText(text) {
  if (!text) return '';

  // 1. Fully escape — neutralizes everything.
  let result = escapeHTML(text);

  // 2. Restore <br> variants (<br>, <br/>, <br />), normalized to <br>.
  result = result.replace(/&lt;br\s*\/?&gt;/gi, '<br>');

  // 3. Restore <a ...> opening tags with a sanitized href, then </a>.
  result = result.replace(ANCHOR_OPEN_RE, (tag) => buildAnchor(tag));
  result = result.replace(/&lt;\/a&gt;/gi, '</a>');

  // 4. Strip remaining tag-like patterns (disallowed tags), keeping content.
  //    Requires a letter right after '&lt;' so bare "&lt; 10" is preserved.
  result = result.replace(STRIP_TAG_RE, '');

  return result;
}
