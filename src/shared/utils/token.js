import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export const generateAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiry,
  });

export const generateRefreshToken = (user) =>
  jwt.sign({ sub: user._id.toString(), tokenVersion: user.tokenVersion }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiry,
  });

export const verifyAccessToken = (token) => jwt.verify(token, env.jwt.accessSecret);

export const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);
