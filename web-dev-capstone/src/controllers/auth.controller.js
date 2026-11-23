import { authService } from '../services/auth.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return ApiResponse.created(res, 'User registered successfully', result);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return ApiResponse.ok(res, 'Login successful', result);
});

export const refresh = asyncHandler(async (req, res) => {
  const tokens = await authService.refresh(req.body.refreshToken);
  return ApiResponse.ok(res, 'Tokens refreshed successfully', tokens);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  return ApiResponse.ok(res, 'Logged out successfully');
});
