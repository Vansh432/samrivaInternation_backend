import Investment from './investments.model.js';

export const createInvestment = (payload) => Investment.create(payload);

export const findInvestmentByCertificateNumber = (certificateNumber) =>
  Investment.findOne({ certificateNumber });

export const findInvestmentById = (id) => Investment.findById(id);

export const listInvestmentsByUser = (userId) =>
  Investment.find({ user: userId }).sort({ createdAt: -1 });

export const listActiveInvestmentsByUser = (userId) =>
  Investment.find({ user: userId, status: 'active' }).sort({ maturityDate: 1 });
