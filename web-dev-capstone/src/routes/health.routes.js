import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const router = Router();

/**
 * @route   GET /api/v1/health
 * @desc    Check system health and database connection
 *          Returns HTTP 200 when database is connected, HTTP 503 Service Unavailable when disconnected.
 * @access  Public
 */
router.get('/', (req, res) => {
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbState = mongoose.connection.readyState;
  const isConnected = dbState === 1;

  const healthData = {
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatusMap[dbState] || 'unknown',
      connected: isConnected,
    },
    environment: env.NODE_ENV,
  };

  if (!isConnected) {
    return res.status(503).json({
      success: false,
      message: 'Database service is disconnected or unavailable',
      data: healthData,
    });
  }

  return ApiResponse.ok(res, 'Backend service is healthy', healthData);
});

export default router;
