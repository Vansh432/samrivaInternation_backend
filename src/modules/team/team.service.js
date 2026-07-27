import { AppError } from '../../shared/errors/AppError.js';
import { MAX_TEAM_LEVEL, USER_STATUS } from '../../shared/constants/index.js';
import { findDownline } from './team.repository.js';
import { findUserById } from '../users/users.repository.js';
import { listActiveInvestmentsForUsers, listActiveInvestmentsByUser } from '../investments/investments.repository.js';

const sumUnitsByUser = (investments) => {
  const map = new Map();
  for (const inv of investments) {
    const key = String(inv.user);
    map.set(key, (map.get(key) || 0) + inv.units);
  }
  return map;
};

// The single shared computation every Team/Genealogy view is derived from: the whole
// downline (any depth), each member's level relative to rootUserId, and each member's
// active investment units. Mobile (root = the logged-in user) and admin (root = any
// user, via :userId) both call this exact function — only the root id differs.
export const getEnrichedDownline = async (rootUserId) => {
  const members = await findDownline(rootUserId);
  const rootIdStr = String(rootUserId);

  const withLevel = members
    .map((m) => {
      const ancestorIds = (m.ancestors || []).map(String);
      const level = ancestorIds.indexOf(rootIdStr) + 1; // 0 if somehow not found
      return { ...m, level };
    })
    .filter((m) => m.level >= 1 && m.level <= MAX_TEAM_LEVEL);

  const activeInvestments = await listActiveInvestmentsForUsers(withLevel.map((m) => m._id));
  const unitsByUser = sumUnitsByUser(activeInvestments);

  return withLevel.map((m) => ({
    id: String(m._id),
    mobile: m.mobile,
    fullName: m.fullName || null,
    role: m.role,
    status: m.status,
    kycStatus: m.kyc?.status || 'pending',
    sponsor: m.sponsor ? String(m.sponsor) : null,
    level: m.level,
    createdAt: m.createdAt,
    activeUnits: unitsByUser.get(String(m._id)) || 0,
  }));
};

export const getTeamSummary = async (rootUserId) => {
  const downline = await getEnrichedDownline(rootUserId);

  const levels = Array.from({ length: MAX_TEAM_LEVEL }, (_, i) => {
    const level = i + 1;
    const membersAtLevel = downline.filter((m) => m.level === level);
    return {
      level,
      memberCount: membersAtLevel.length,
      activeInvestorCount: membersAtLevel.filter((m) => m.activeUnits > 0).length,
      activeUnits: membersAtLevel.reduce((sum, m) => sum + m.activeUnits, 0),
    };
  });

  return {
    totalDownline: downline.length,
    totalActiveUnits: downline.reduce((sum, m) => sum + m.activeUnits, 0),
    directCount: downline.filter((m) => m.level === 1).length,
    levels,
  };
};

export const getTeamLevelMembers = async (rootUserId, level, { page = 1, limit = 20 } = {}) => {
  const downline = await getEnrichedDownline(rootUserId);
  const membersAtLevel = downline.filter((m) => m.level === level);

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;
  const start = (pageNum - 1) * limitNum;
  const items = membersAtLevel.slice(start, start + limitNum).map((m) => ({
    id: m.id,
    mobile: m.mobile,
    fullName: m.fullName,
    role: m.role,
    status: m.status,
    kycStatus: m.kycStatus,
    joinedAt: m.createdAt,
    activeUnits: m.activeUnits,
  }));

  return {
    items,
    total: membersAtLevel.length,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(membersAtLevel.length / limitNum) || 1,
  };
};

export const getTeamTree = async (rootUserId) => {
  const [rootUser, downline, rootInvestments] = await Promise.all([
    findUserById(rootUserId),
    getEnrichedDownline(rootUserId),
    listActiveInvestmentsByUser(rootUserId),
  ]);
  if (!rootUser) throw new AppError('User not found', 404);

  const rootIdStr = String(rootUserId);
  const nodeMap = new Map();
  const rootNode = {
    id: rootIdStr,
    name: rootUser.fullName || rootUser.mobile,
    mobile: rootUser.mobile,
    role: rootUser.role,
    isActive: rootUser.status === USER_STATUS.ACTIVE,
    activeUnits: rootInvestments.reduce((sum, inv) => sum + inv.units, 0),
    level: 0,
    children: [],
  };
  nodeMap.set(rootIdStr, rootNode);

  for (const m of downline) {
    nodeMap.set(m.id, {
      id: m.id,
      name: m.fullName || m.mobile,
      mobile: m.mobile,
      role: m.role,
      isActive: m.status === USER_STATUS.ACTIVE,
      activeUnits: m.activeUnits,
      level: m.level,
      children: [],
    });
  }

  for (const m of downline) {
    const parent = nodeMap.get(m.sponsor);
    if (parent) parent.children.push(nodeMap.get(m.id));
  }

  return rootNode;
};
