import { EventEmitter } from 'events';

/**
 * Global Node.js EventEmitter Singleton
 * Decouples asynchronous side-effects (Socket.IO broadcasts, low-stock warnings, notifications)
 * from the synchronous business logic transactions in services.
 */
class AppEventEmitter extends EventEmitter {}

export const eventEmitter = new AppEventEmitter();

// Increase max listeners to prevent false-positive memory leak warnings in dev
eventEmitter.setMaxListeners(30);
