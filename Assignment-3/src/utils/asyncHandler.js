/**
 * Async handler utility to wrap asynchronous Express route controllers.
 * Eliminates repetitive try-catch blocks and forwards errors to the global error middleware.
 *
 * @param {Function} fn - Async controller function (req, res, next)
 * @returns {Function} Express middleware handler
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
