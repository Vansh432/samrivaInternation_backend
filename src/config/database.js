import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export const connectDB = async () => {
  try {
    await mongoose.connect(env.mongodbUrl);
    logger.info('MongoDB connected', { host: mongoose.connection.host });
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message });
    process.exit(1);
  }
};
