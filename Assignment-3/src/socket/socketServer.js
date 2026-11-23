import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let io = null;

/**
 * Initialize Socket.IO with HTTP server and JWT handshake authentication.
 *
 * @param {import('http').Server} httpServer
 * @returns {SocketIOServer}
 */
export const initSocket = (httpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL === '*' ? '*' : env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT Handshake Authentication Middleware
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      socket.user = { id: decoded.id, role: decoded.role };
      next();
    } catch (err) {
      logger.warn(`Socket.IO handshake authentication failed: ${err.message}`);
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    logger.info(`Socket connected: ${socket.id} (User: ${id}, Role: ${role})`);

    // 1. Join user-specific private room
    socket.join(`user:${id}`);

    // 2. Join role-specific admin room if applicable
    if (role === 'admin') {
      socket.join('role:admin');
      logger.info(`Socket ${socket.id} joined room 'role:admin'`);
    }

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
};

/**
 * Get active Socket.IO server instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocket(httpServer) first.');
  }
  return io;
};

// ==========================================
// SOCKET EMISSION HELPERS (Called by EventEmitter)
// ==========================================

/**
 * Emit order:new notification to the seller
 */
export const emitOrderNew = (sellerId, payload) => {
  if (!io) return;
  io.to(`user:${sellerId}`).emit('order:new', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit order:status notification to the customer
 */
export const emitOrderStatus = (customerId, payload) => {
  if (!io) return;
  io.to(`user:${customerId}`).emit('order:status', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit stock:low warning to the seller and all admins
 */
export const emitStockLow = (sellerId, payload) => {
  if (!io) return;
  io.to(`user:${sellerId}`).to('role:admin').emit('stock:low', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
};
