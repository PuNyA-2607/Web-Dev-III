import morgan from 'morgan';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Stream morgan logs to our application logger
const stream = {
  write: (message) => logger.info(message.trim()),
};

// Use concise format in development, combined in production
const format = env.NODE_ENV === 'production' ? 'combined' : ':method :url :status :response-time ms';

export const requestLogger = morgan(format, { stream });
