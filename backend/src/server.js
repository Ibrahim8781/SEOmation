// backend/src/server.js - UPDATED

import './config/index.js';
import { app } from './app.js';
import logger from './lib/logger.js';
import { startSmartScheduler, getScheduler } from './services/smart-scheduler.service.js';
import { backfillIntegrationTokenEncryption } from './services/integration-token.service.js';

const port = process.env.PORT || 3000;

backfillIntegrationTokenEncryption().catch((err) => {
  logger.error({ err }, 'Failed to backfill encrypted OAuth tokens');
});

// Start smart scheduler
startSmartScheduler()
  .then(() => {
    logger.info('Smart scheduler initialized');
  })
  .catch((err) => {
    logger.error({ err }, 'Failed to start smart scheduler');
  });

// Start server
const server = app.listen(port, () => {
  logger.info({ port }, 'SEOmation API listening');
});

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  logger.info({ signal }, 'Received shutdown signal');

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    // Shutdown scheduler (cancel future jobs, finish running ones)
    const scheduler = getScheduler();
    await scheduler.shutdown();
    logger.info('Smart scheduler shutdown complete');

    // Exit cleanly
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught Exception');
  gracefulShutdown('uncaughtException');
});
