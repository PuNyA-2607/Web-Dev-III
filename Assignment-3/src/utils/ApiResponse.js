/**
 * Standardized API Response structure.
 * Ensures consistent response format: { success, message, data }
 */
export class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Response message
   * @param {*} [data=null] - Response payload
   */
  constructor(statusCode, message = 'Success', data = null) {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }

  /**
   * Send the standardized JSON response via Express res object.
   * @param {import('express').Response} res
   */
  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
    });
  }

  // Pre-configured static helper methods
  static ok(res, message = 'Operation successful', data = null) {
    return new ApiResponse(200, message, data).send(res);
  }

  static created(res, message = 'Resource created successfully', data = null) {
    return new ApiResponse(201, message, data).send(res);
  }

  static noContent(res) {
    return res.status(204).send();
  }
}
