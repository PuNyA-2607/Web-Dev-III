import { ApiError } from './ApiError.js';

/**
 * Order State Machine Transitions
 *
 * Allowed Transitions:
 *   pending   -> confirmed, cancelled
 *   confirmed -> shipped, cancelled
 *   shipped   -> delivered
 *   delivered -> (terminal)
 *   cancelled -> (terminal)
 */
export const ORDER_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

const ALLOWED_TRANSITIONS = {
  [ORDER_STATUSES.PENDING]: [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.CONFIRMED]: [ORDER_STATUSES.SHIPPED, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.SHIPPED]: [ORDER_STATUSES.DELIVERED],
  [ORDER_STATUSES.DELIVERED]: [],
  [ORDER_STATUSES.CANCELLED]: [],
};

/**
 * Check if a state transition is permitted.
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {boolean}
 */
export const canTransition = (currentStatus, targetStatus) => {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
};

/**
 * Validate a state transition and throw ApiError.badRequest if disallowed.
 * @param {string} currentStatus
 * @param {string} targetStatus
 */
export const validateTransition = (currentStatus, targetStatus) => {
  if (currentStatus === targetStatus) {
    throw ApiError.badRequest(`Order is already in '${currentStatus}' status.`);
  }

  if (!canTransition(currentStatus, targetStatus)) {
    const validTargets = ALLOWED_TRANSITIONS[currentStatus] || [];
    const validMessage =
      validTargets.length > 0
        ? `Valid next status(es): [${validTargets.join(', ')}]`
        : `Status '${currentStatus}' is a terminal state and cannot be changed.`;

    throw ApiError.badRequest(
      `Invalid order status transition from '${currentStatus}' to '${targetStatus}'. ${validMessage}`
    );
  }
};
