import morgan from 'morgan';
import { logger } from '../config/logger.js';

const stream = {
  write: (message) => logger.http ? logger.http(message.trim()) : logger.info(message.trim()),
};

export const requestLogger = morgan('short', { stream });

export default requestLogger;
