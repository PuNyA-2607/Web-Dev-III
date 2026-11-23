import { orderService } from '../services/order.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const checkout = asyncHandler(async (req, res) => {
  const order = await orderService.checkout(req.user._id, req.body.deliveryAddress);
  return ApiResponse.created(res, 'Order placed successfully', order);
});

export const getOrders = asyncHandler(async (req, res) => {
  const result = await orderService.getOrders(req.user, req.query);
  return ApiResponse.ok(res, 'Orders retrieved successfully', result);
});

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id, req.user);
  return ApiResponse.ok(res, 'Order details retrieved successfully', order);
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const order = await orderService.updateOrderStatus(req.params.id, status, req.user, note);
  return ApiResponse.ok(res, `Order status updated to '${status}' successfully`, order);
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body || {};
  const order = await orderService.cancelOrder(req.params.id, req.user, reason);
  return ApiResponse.ok(res, 'Order cancelled and stock restored successfully', order);
});
