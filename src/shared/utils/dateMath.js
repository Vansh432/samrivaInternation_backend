export const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// Rolling 30.44-day-per-month window from startDate, capped at tenureMonths — the single
// definition of "how many months have elapsed" shared by both what's displayed (current
// value / ROI) and what's actually paid out (the returns cron), so they never disagree.
export const monthsElapsedBetween = (startDate, tenureMonths) => {
  const now = new Date();
  const msElapsed = now.getTime() - new Date(startDate).getTime();
  const monthsFloat = msElapsed / (1000 * 60 * 60 * 24 * 30.44);
  return Math.max(0, Math.min(tenureMonths, Math.floor(monthsFloat)));
};

// Calendar-month boundaries relative to today — monthsAgo=0 is the current (in-progress)
// month, 1 is the month that just closed. Used by the rank-benefit monthly evaluation to
// pin down exactly which month's business is being measured.
export const getMonthRange = (monthsAgo = 0) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59, 999);
  const yearMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  return { start, end, yearMonth };
};
