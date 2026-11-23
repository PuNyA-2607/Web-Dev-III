/**
 * Convert a text string to a URL-friendly slug.
 * Example: "Smart Watches & Fitness Bands" -> "smart-watches-fitness-bands"
 *
 * @param {string} text
 * @returns {string} URL slug
 */
export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
};
