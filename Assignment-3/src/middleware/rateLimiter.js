import rateLimit from 'express-rate-limit';

/**
 * Login Rate Limiting Middleware
 * Protects against brute-force and credential-stuffing attacks.
 * Restricts an IP address to 10 login attempts per 15-minute window.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10, // Max 10 attempts
  standardHeaders: true, // Draft-6 RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts from this IP address. Please try again after 15 minutes.',
    });
  },
});
