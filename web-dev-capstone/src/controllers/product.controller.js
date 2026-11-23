import { productService } from '../services/product.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body, req.user);
  return ApiResponse.created(res, 'Product created successfully', product);
});

export const getAllProducts = asyncHandler(async (req, res) => {
  const result = await productService.getAllProducts(req.query);
  return ApiResponse.ok(res, 'Products retrieved successfully', result);
});

export const getSellerProducts = asyncHandler(async (req, res) => {
  const result = await productService.getSellerProducts(req.user._id, req.query);
  return ApiResponse.ok(res, 'Seller products retrieved successfully', result);
});

export const getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  return ApiResponse.ok(res, 'Product retrieved successfully', product);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const updatedProduct = await productService.updateProduct(req.params.id, req.body, req.user);
  return ApiResponse.ok(res, 'Product updated successfully', updatedProduct);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const result = await productService.deleteProduct(req.params.id, req.user);
  return ApiResponse.ok(res, result.message, { id: result.id });
});
