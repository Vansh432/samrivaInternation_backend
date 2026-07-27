import User from '../users/users.model.js';

// One query for the entire downline at any depth — Mongo's array-contains-value match
// (`{ ancestors: rootUserId }`) returns every descendant whose upline chain includes
// rootUserId anywhere, so no recursive per-level querying is needed. team.service.js
// derives each member's relative level from their position in `ancestors`.
export const findDownline = (rootUserId) =>
  User.find(
    { ancestors: rootUserId },
    'mobile fullName role status kyc.status sponsor ancestors createdAt'
  ).lean();
