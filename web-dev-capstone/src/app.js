import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';
import { ApiResponse } from './utils/ApiResponse.js';

const app = express();

// Security HTTP headers with CSP configured for static frontend, external images, and WebSockets
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin: env.CLIENT_URL === '*' ? '*' : env.CLIENT_URL,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// Serve static demo assets (Socket.IO client demo)
app.use(express.static('public'));

// Request logging middleware
app.use(requestLogger);

// Base route for quick server alive check
app.get('/', (req, res) => {
  ApiResponse.ok(res, 'E-Commerce & Inventory Management API is running', {
    version: '1.0.0',
    documentation: '/api/v1/health',
  });
});

// Mount API v1 routes
app.use('/api/v1', apiRoutes);

// Catch 404 for undefined routes
app.use(notFound);

// Centralized error handling middleware
app.use(errorHandler);

export default app;
