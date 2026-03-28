import logger from '../lib/logger.js';
import { getScheduler } from './smart-scheduler.service.js';

export class PublisherWorker {
  constructor() {
    logger.warn(
      'PublisherWorker is deprecated and inert. SmartScheduler is the only supported scheduling executor.'
    );
  }

  start() {
    logger.warn(
      'PublisherWorker.start() is deprecated and does nothing. SmartScheduler already owns scheduled execution.'
    );
    return getScheduler();
  }

  stop() {
    logger.warn('PublisherWorker.stop() is deprecated and does nothing.');
  }

  async tick() {
    logger.warn('PublisherWorker.tick() is deprecated and does nothing.');
  }
}

let warned = false;

export function startPublisherWorker() {
  if (!warned) {
    logger.warn(
      'startPublisherWorker() is deprecated and now returns the SmartScheduler singleton instead of starting a second executor.'
    );
    warned = true;
  }
  return getScheduler();
}
