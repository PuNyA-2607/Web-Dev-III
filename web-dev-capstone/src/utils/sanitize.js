/**
 * Sanitize user input to prevent MongoDB query and operator injection ($gt, $ne, etc.)
 * Recursively removes any object keys that start with '$' or contain '.'
 *
 * @param {*} input
 * @returns {*} Sanitized input
 */
export const sanitizeMongoInput = (input) => {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeMongoInput(item));
  }

  if (input !== null && typeof input === 'object') {
    const cleanObj = {};
    for (const key of Object.keys(input)) {
      // Reject or strip operator keys starting with $ or containing .
      if (!key.startsWith('$') && !key.includes('.')) {
        cleanObj[key] = sanitizeMongoInput(input[key]);
      }
    }
    return cleanObj;
  }

  return input;
};

/**
 * Sanitize search term string for text/regex usage
 * Strips MongoDB operator tokens and escapes regex special characters.
 *
 * @param {string} term
 * @returns {string} Safe search string
 */
export const sanitizeSearchTerm = (term) => {
  if (typeof term !== 'string') return '';
  return term
    .trim()
    .replace(/^\$+/, '') // Remove leading dollar signs
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex characters
};
