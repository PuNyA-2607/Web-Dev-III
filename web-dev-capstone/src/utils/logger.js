import { env } from '../config/env.js';

/**
 * Centralized Application Logger
 * Provides consistent console log formatting with ISO timestamps and levels.
 */

const formatMessage = (level, message) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
};

export const logger = {
  info: (message, ...args) => {
    console.log(formatMessage('info', message), ...args);
  },
  warn: (message, ...args) => {
    console.warn(formatMessage('warn', message), ...args);
  },
  error: (message, ...args) => {
    console.error(formatMessage('error', message), ...args);
  },
  debug: (message, ...args) => {
    if (env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', message), ...args);
    }
  },
};
