import { logger } from '../config/logger.js';
import { consumeEvent } from './consumer.js';

export const publishEvent = async ({ type, payload = {}, meta = {} }) => {
  if (!type) {
    throw new Error('Event type is required');
  }

  const event = { type, payload, meta, publishedAt: new Date().toISOString() };
  logger.info('event.producer.published', { type, payload: meta || payload });

  return consumeEvent(event);
};
