import WalletTransferRequest from './walletTransferRequest.model.js';

export const createWalletTransferRequest = (payload, session) =>
  WalletTransferRequest.create([payload], { session }).then(([doc]) => doc);

export const findWalletTransferRequestById = (id) => WalletTransferRequest.findById(id);

export const listWalletTransferRequestsByUser = (userId) =>
  WalletTransferRequest.find({ user: userId }).sort({ createdAt: -1 });

// Cross-user queue listing for admin review — mirrors walletTransactions.repository.js's
// listWalletTransactionsAdmin filter/paginate/populate shape.
export const listWalletTransferRequestsAdmin = ({ filter = {}, skip = 0, limit = 20 }) =>
  WalletTransferRequest.find(filter).populate('user', 'mobile fullName').sort({ createdAt: -1 }).skip(skip).limit(limit);

export const countWalletTransferRequests = (filter = {}) => WalletTransferRequest.countDocuments(filter);

export const updateWalletTransferRequestStatus = (id, update, session) =>
  WalletTransferRequest.findByIdAndUpdate(id, update, { new: true, session });
