export const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
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
