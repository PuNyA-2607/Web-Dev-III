import { ApiError } from '../utils/ApiError.js';

/**
 * Role-Based Access Control (RBAC) Middleware.
 * Ensures the authenticated user possesses one of the required roles.
 *
 * @param {...string} allowedRoles - Allowed role strings ('customer', 'seller', 'admin')
 * @returns {Function} Express middleware
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required before checking permissions.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Forbidden: You do not have permission to access this resource. Required role(s): [${allowedRoles.join(
            ', '
          )}]`
        )
      );
    }

    next();
  };
};
