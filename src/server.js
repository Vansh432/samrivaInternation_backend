import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/database.js';
import { logger } from './config/logger.js';
import { startCronJobs } from './scheduler/index.js';

const start = async () => {
  await connectDB();
  startCronJobs();

  app.listen(env.port, () => {
    logger.info(`Server is running on port ${env.port}`);
  });
};

start();
