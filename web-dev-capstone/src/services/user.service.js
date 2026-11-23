import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { ApiError } from '../utils/ApiError.js';

export const userService = {
  /**
   * Retrieve the current user's profile.
   */
  getProfile: async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }
    return user;
  },

  /**
   * Update the current user's profile.
   * STRICT: Name and password only. Never role or email.
   * Changing password requires currentPassword and revokes all active refresh tokens.
   */
  updateProfile: async (userId, { name, password, currentPassword }) => {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    // 1. Name update
    if (name) {
      user.name = name.trim();
    }

    let passwordChanged = false;

    // 2. Password update
    if (password) {
      if (!currentPassword) {
        throw ApiError.badRequest('Current password is required to change password.');
      }

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        throw ApiError.badRequest('Current password does not match.');
      }

      // Hash new password with 12 rounds
      user.passwordHash = await bcrypt.hash(password, 12);
      passwordChanged = true;
    }

    await user.save();

    // Revoke all existing refresh tokens if password was modified (forces re-login across devices)
    if (passwordChanged) {
      await RefreshToken.updateMany({ user: userId }, { revokedAt: new Date() });
    }

    // Re-fetch clean user without passwordHash
    const updatedUser = await User.findById(userId);
    return updatedUser;
  },

  /**
   * Admin-only: list all users with pagination and filtering.
   */
  getAllUsers: async ({ page = 1, limit = 10, role, isActive }) => {
    const query = {};
    if (role) {
      query.role = role;
    }
    if (typeof isActive === 'boolean') {
      query.isActive = isActive;
    }

    const numericPage = Math.max(1, parseInt(page, 10));
    const numericLimit = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (numericPage - 1) * numericLimit;

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(numericLimit),
      User.countDocuments(query),
    ]);

    return {
      users,
      pagination: {
        total,
        page: numericPage,
        limit: numericLimit,
        pages: Math.ceil(total / numericLimit),
      },
    };
  },

  /**
   * Admin-only: activate or deactivate a user account.
   * Admins cannot deactivate themselves.
   * Deactivating an account revokes all active refresh tokens immediately.
   */
  updateUserStatus: async (targetUserId, isActive, adminId) => {
    if (targetUserId.toString() === adminId.toString()) {
      throw ApiError.badRequest('Admins cannot deactivate their own account.');
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      throw ApiError.notFound('Target user not found.');
    }

    user.isActive = isActive;
    await user.save();

    // If account was deactivated, revoke all refresh tokens immediately
    if (!isActive) {
      await RefreshToken.updateMany(
        { user: targetUserId, revokedAt: null },
        { revokedAt: new Date() }
      );
    }

    return user;
  },
};
