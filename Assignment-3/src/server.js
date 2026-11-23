import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { initSocket } from './socket/socketServer.js';
import { registerOrderEvents } from './events/orderEvents.js';

// Create HTTP server wrapping the Express app
const server = http.createServer(app);

// Initialize Socket.IO server on top of HTTP server
initSocket(server);

// Register domain event listeners for asynchronous side-effects
registerOrderEvents();

// Handle uncaught synchronous exceptions
process.on('uncaughtException', (err) => {
  logger.error(`UNCAUGHT EXCEPTION! Shutting down... ${err.name}: ${err.message}`, err.stack);
  process.exit(1);
});

// Start Server after connecting to MongoDB
const startServer = async () => {
  try {
    // 1. Establish database connection
    await connectDB();

    // 2. Listen on configured port
    server.listen(env.PORT, () => {
      logger.info(`Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
      logger.info(`Health check available at http://localhost:${env.PORT}/api/v1/health`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

// Handle unhandled asynchronous promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`UNHANDLED REJECTION! Shutting down gracefully... ${err.name}: ${err.message}`);
  server.close(async () => {
    await disconnectDB();
    process.exit(1);
  });
});

// Handle termination signals (SIGINT, SIGTERM)
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Closing HTTP server and database connections...`);
  server.close(async () => {
    await disconnectDB();
    logger.info('Process terminated gracefully.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { server };
