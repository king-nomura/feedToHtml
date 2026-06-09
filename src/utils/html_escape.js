/**
 * Shared HTML escaping primitive.
 *
 * Used by both TemplateEngine and the rich-text sanitizer so the escaping
 * rules cannot silently drift between them (a drift would weaken the XSS
 * guarantee in one place but not the other).
 */

/**
 * Escape HTML special characters for safe text/attribute output.
 * @param {string} text - Text to escape
 * @returns {string} Escaped text ('' for falsy input)
 */
export function escapeHTML(text) {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
