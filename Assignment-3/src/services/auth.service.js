import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Hash a plain token string with SHA-256 before database storage.
 * @param {string} token
 * @returns {string} Hex-encoded SHA-256 hash
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate Access and Refresh JWTs with separate secret keys.
 * @param {Object} user - User document
 * @returns {{ accessToken: string, refreshToken: string, expiresIn: string }}
 */
export const generateTokens = (user) => {
  const payload = {
    id: user._id.toString(),
    role: user.role,
  };

  // Sign Access Token (15m default)
  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });

  // Sign Refresh Token (7d default) - minimal payload with unique jti to prevent sub-second rotation collisions
  const refreshToken = jwt.sign(
    { id: user._id.toString(), jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  };
};

/**
 * Calculate the expiration Date object for a refresh token.
 */
const getRefreshTokenExpiry = () => {
  // Default 7 days from now
  const days = 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

export const authService = {
  /**
   * Register a new customer or seller.
   */
  register: async ({ name, email, password, role = 'customer' }) => {
    // 1. Enforce RBAC registration rule: admin cannot self-register
    if (role === 'admin') {
      throw ApiError.forbidden(
        'Admin self-registration is forbidden. Admins are created exclusively via system seed.'
      );
    }

    if (!['customer', 'seller'].includes(role)) {
      throw ApiError.badRequest('Invalid role. Only customer and seller roles can register.');
    }

    // 2. Check for duplicate email
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw ApiError.conflict('An account with this email address already exists.');
    }

    // 3. Hash password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(password, 12);

    // 4. Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      isActive: true,
    });

    // 5. Generate authentication tokens
    const tokens = generateTokens(user);

    // 6. Store hashed refresh token in database
    await RefreshToken.create({
      user: user._id,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: getRefreshTokenExpiry(),
    });

    return { user, tokens };
  },

  /**
   * Authenticate user with email and password.
   */
  login: async ({ email, password }) => {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Fetch user including select:false passwordHash
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    // 2. Generic error for non-existent user or invalid password (prevents account enumeration)
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    // 3. Verify password hash
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    // 4. Check account status
    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated. Please contact support.');
    }

    // 5. Generate tokens
    const tokens = generateTokens(user);

    // 6. Save hashed refresh token
    await RefreshToken.create({
      user: user._id,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: getRefreshTokenExpiry(),
    });

    return { user, tokens };
  },

  /**
   * Rotate refresh token and issue new access & refresh tokens.
   * Implements reuse detection: if a revoked token is presented, all user tokens are invalidated.
   */
  refresh: async (rawRefreshToken) => {
    // 1. Verify token signature
    let decoded;
    try {
      decoded = jwt.verify(rawRefreshToken, env.JWT_REFRESH_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Refresh token has expired. Please log in again.');
      }
      throw ApiError.unauthorized('Invalid refresh token.');
    }

    const currentTokenHash = hashToken(rawRefreshToken);
    const storedToken = await RefreshToken.findOne({ tokenHash: currentTokenHash });

    // 2. Token reuse detection: if token exists but was already revoked, someone is replaying a stolen token!
    if (storedToken && storedToken.revokedAt) {
      // Security measure: Revoke ALL tokens belonging to this user to stop active breach
      await RefreshToken.updateMany({ user: storedToken.user }, { revokedAt: new Date() });
      throw ApiError.unauthorized(
        'Revoked refresh token reuse detected! All active sessions have been terminated for security.'
      );
    }

    // 3. Check if token exists in DB
    if (!storedToken) {
      throw ApiError.unauthorized('Refresh token not found or already purged.');
    }

    // 4. Verify user exists and is active
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or account is deactivated.');
    }

    // 5. Issue new token pair
    const tokens = generateTokens(user);
    const newRefreshTokenHash = hashToken(tokens.refreshToken);

    // 6. Rotate: Revoke the old token and mark the replacement
    storedToken.revokedAt = new Date();
    storedToken.replacedBy = newRefreshTokenHash;
    await storedToken.save();

    // 7. Store the new refresh token
    await RefreshToken.create({
      user: user._id,
      tokenHash: newRefreshTokenHash,
      expiresAt: getRefreshTokenExpiry(),
    });

    return tokens;
  },

  /**
   * Log out: Revoke the active refresh token.
   */
  logout: async (rawRefreshToken) => {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = await RefreshToken.findOne({ tokenHash });

    if (storedToken && !storedToken.revokedAt) {
      storedToken.revokedAt = new Date();
      await storedToken.save();
    }
  },
};
