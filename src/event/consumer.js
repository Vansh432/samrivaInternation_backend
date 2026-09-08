import { logger } from '../config/logger.js';
import { handlers } from './handlers/email.handler.js';

export const consumeEvent = async (event) => {
  const handler = handlers[event?.type];

  if (!handler) {
    logger.warn('event.consumer.noHandler', { type: event?.type });
    return { handled: false, type: event?.type };
  }

  try {
    await handler(event?.payload || {});
    return { handled: true, type: event?.type };
  } catch (error) {
    logger.error('event.consumer.failed', {
      type: event?.type,
      error: error?.message,
    });
    return { handled: false, type: event?.type, error: error?.message };
  }
};
