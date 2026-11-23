import { userService } from '../services/user.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user._id);
  return ApiResponse.ok(res, 'User profile retrieved successfully', user);
});

export const updateMe = asyncHandler(async (req, res) => {
  const updatedUser = await userService.updateProfile(req.user._id, req.body);
  return ApiResponse.ok(res, 'Profile updated successfully', updatedUser);
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const result = await userService.getAllUsers(req.query);
  return ApiResponse.ok(res, 'Users retrieved successfully', result);
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const updatedUser = await userService.updateUserStatus(
    req.params.id,
    req.body.isActive,
    req.user._id
  );
  return ApiResponse.ok(res, 'User status updated successfully', updatedUser);
});
