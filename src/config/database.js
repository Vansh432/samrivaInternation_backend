import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

// Known Windows/Node quirk: some VPN/security software registers a loopback DNS entry that
// Node's resolver picks up but nothing actually listens on, while the OS resolver works fine.
// This breaks mongodb+srv:// SRV/TXT lookups specifically. Fall back to public DNS in that case.
const ensureUsableDnsServers = () => {
  const servers = dns.getServers();
  if (servers.length === 1 && servers[0] === '127.0.0.1') {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    logger.warn('Node DNS resolver was pointed at unreachable 127.0.0.1; switched to public DNS for SRV lookups');
  }
};

export const connectDB = async () => {
  try {
    ensureUsableDnsServers();
    await mongoose.connect(env.mongodbUrl);
    logger.info('MongoDB connected', { host: mongoose.connection.host });
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message });
    process.exit(1);
  }
};
