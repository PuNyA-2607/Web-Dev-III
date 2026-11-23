import { cartService } from '../services/cart.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user._id);
  return ApiResponse.ok(res, 'Cart retrieved successfully', cart);
});

export const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const cart = await cartService.addItem(req.user._id, productId, quantity);
  return ApiResponse.ok(res, 'Item added to cart successfully', cart);
});

export const updateItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  const cart = await cartService.updateItem(req.user._id, productId, quantity);
  return ApiResponse.ok(res, 'Cart item updated successfully', cart);
});

export const removeItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const cart = await cartService.removeItem(req.user._id, productId);
  return ApiResponse.ok(res, 'Item removed from cart successfully', cart);
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await cartService.clearCart(req.user._id);
  return ApiResponse.ok(res, 'Cart cleared successfully', cart);
});
