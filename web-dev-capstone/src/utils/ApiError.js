/**
 * Custom ApiError class for operational errors.
 * Encapsulates HTTP status codes, error messages, and optional error details.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (e.g. 400, 401, 403, 404, 500)
   * @param {string} message - Descriptive error message
   * @param {Array|Object} [errors=[]] - Array or object containing detailed validation errors
   * @param {string} [stack=''] - Optional custom stack trace
   */
  constructor(statusCode, message = 'Something went wrong', errors = [], stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;
    this.isOperational = true;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Pre-configured static factory methods for common HTTP errors
  static badRequest(msg = 'Bad Request', errors = []) {
    return new ApiError(400, msg, errors);
  }

  static unauthorized(msg = 'Unauthorized access') {
    return new ApiError(401, msg);
  }

  static forbidden(msg = 'Forbidden: Access denied') {
    return new ApiError(403, msg);
  }

  static notFound(msg = 'Resource not found') {
    return new ApiError(404, msg);
  }

  static conflict(msg = 'Resource conflict', errors = []) {
    return new ApiError(409, msg, errors);
  }

  static internal(msg = 'Internal Server Error') {
    return new ApiError(500, msg);
  }
}
