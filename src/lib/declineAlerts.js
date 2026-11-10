// The volume-decline rule. Pure functions over the rows from getVolumeWatch(),
// so the thresholds live in one place and can be tuned without touching SQL.
//
// Sales are measured in calendar months, so the rule is too:
//   1. This month to date, against the average of the same days in the six
//      months before (e.g. Nov 1-7 against the average of the 1st-7th of May
//      to October). Only from the 7th, when the month has enough in it.
//   2. The last full month, against the average of the three months before it.
// Either one flags the account.

// Warn when an account runs this far below its average.
export const DECLINE_THRESHOLD = -0.2;

// The month-to-date check starts on this day of the month. Before it, one
// order more or less decides the whole comparison.
export const MTD_START_DAY = 7;

export const MTD_BASELINE_MONTHS = 6;
export const MOM_BASELINE_MONTHS = 3;

// An average over fewer months than this is not an average yet.
export const MIN_BASELINE_MONTHS = 2;

// Accounts averaging less than this per month are skipped: one order more or
// less swings them by half, so a percentage rule only produces noise.
export const MIN_BASE_KGS_MONTH = 100;

// An order is "clearly overdue" once the wait passes one and a half normal
// cycles, and at least a week past the expected date.
export const OVERDUE_CYCLE_FACTOR = 1.5;
export const OVERDUE_MIN_GRACE_DAYS = 7;

// A cycle read off fewer deliveries than this is not a pattern yet.
export const MIN_DELIVERIES_FOR_CYCLE = 3;

// Sales data older than this many days is too stale to judge anyone on.
export const STALE_AFTER_DAYS = 3;

// BigQuery hands DATE columns back as { value: 'YYYY-MM-DD' }.
export const asIsoDate = (d) => (typeof d === 'string' ? d : d?.value) || null;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

// Names for the periods the rule talks about, from the data's last date.
export function periodLabels(dataThroughIso) {
  if (!dataThroughIso) return { thisMonth: 'This month', lastMonth: 'Last month', toDate: 'to date' };
  const [, m, d] = dataThroughIso.split('-').map(Number);
  const short = MONTHS[m - 1].slice(0, 3);
  return {
    thisMonth: MONTHS[m - 1],
    lastMonth: MONTHS[(m + 10) % 12],
    // "Nov 1-7"
    toDate: `${short} 1–${d}`,
  };
}

// Turn one measured row into an account with its verdict. `alert` is null when
// the account is behaving normally.
export function assessAccount(row) {
  const dataThrough = asIsoDate(row.dataThrough);
  const labels = periodLabels(dataThrough);
  const dayOfMonth = num(row.dayOfMonth);
  const firstMonthsAgo = num(row.firstMonthsAgo);
  const cycleDays = row.cycleDays == null ? null : num(row.cycleDays);
  const daysSinceLast = num(row.daysSinceLast);
  const deliveryDays = num(row.deliveryDays);

  // A newer account is averaged over the months it has actually existed.
  const mtdMonths = Math.min(MTD_BASELINE_MONTHS, firstMonthsAgo);
  const momMonths = Math.max(0, Math.min(MOM_BASELINE_MONTHS, firstMonthsAgo - 1));

  const mtdKgs = num(row.mtdKgs);
  const lastMonthKgs = num(row.lastMonthKgs);
  // What the account has usually bought by this day of the month.
  const mtdUsual = mtdMonths > 0 ? num(row.prior6SameDaysKgs) / mtdMonths : 0;
  // What it usually buys in a whole month.
  const monthUsual = mtdMonths > 0 ? num(row.prior6FullKgs) / mtdMonths : 0;
  const prev3Avg = momMonths > 0 ? num(row.prev3Kgs) / momMonths : 0;

  const account = {
    id: row.id,
    name: row.name,
    channel: row.channel,
    segment: row.segment,
    batch: num(row.batch),
    segmentRank: num(row.segmentRank),
    lastOrderDate: asIsoDate(row.lastOrderDate),
    daysSinceLast,
    cycleDays,
    dayOfMonth,
    mtdKgs,
    mtdUsual,
    mtdChange: null,
    lastMonthKgs,
    prev3Avg,
    momChange: null,
    monthUsual,
    alert: null,
  };

  const reasons = [];

  // 1. This month to date against the six-month average for the same days.
  const mtdJudged = dayOfMonth >= MTD_START_DAY
    && mtdMonths >= MIN_BASELINE_MONTHS
    && monthUsual >= MIN_BASE_KGS_MONTH
    && mtdUsual > 0;
  if (mtdJudged) {
    account.mtdChange = mtdKgs / mtdUsual - 1;
    if (account.mtdChange <= DECLINE_THRESHOLD) reasons.push('mtd');
  }

  // 2. Last full month against the average of the three months before it.
  const momJudged = momMonths >= MIN_BASELINE_MONTHS && prev3Avg >= MIN_BASE_KGS_MONTH;
  if (momJudged) {
    account.momChange = lastMonthKgs / prev3Avg - 1;
    if (account.momChange <= DECLINE_THRESHOLD) reasons.push('mom');
  }

  // Nothing last month and nothing this month: say so plainly.
  const stopped = momJudged && lastMonthKgs === 0 && mtdKgs === 0;
  if (stopped) {
    reasons.length = 0;
    reasons.push('stopped');
  }

  const hasCycle = cycleDays > 0 && deliveryDays >= MIN_DELIVERIES_FOR_CYCLE;
  const overdueAfter = hasCycle
    ? Math.max(cycleDays * OVERDUE_CYCLE_FACTOR, cycleDays + OVERDUE_MIN_GRACE_DAYS)
    : null;
  if (hasCycle && daysSinceLast > overdueAfter) {
    reasons.push('overdue');
  }

  if (reasons.length === 0) return account;

  // What the decline is worth, in kilograms a month: the larger of last
  // month's shortfall and this month's shortfall so far.
  const momShort = momJudged ? prev3Avg - lastMonthKgs : 0;
  const mtdShort = mtdJudged ? mtdUsual - mtdKgs : 0;

  account.alert = {
    reasons,
    kgsBelow: Math.max(0, momShort, mtdShort),
    daysOverdue: reasons.includes('overdue') ? Math.round(daysSinceLast - cycleDays) : null,
    summary: describe(account, reasons, labels),
  };
  return account;
}

const kg = (n) => `${Math.round(n).toLocaleString('en-US')} kg`;
const pct = (change) => `${Math.round(Math.abs(change) * 100)}%`;

// One plain sentence per reason, built from the numbers only.
function describe(account, reasons, labels) {
  const parts = [];
  if (reasons.includes('stopped')) {
    parts.push(`No orders in ${labels.lastMonth} or so far in ${labels.thisMonth}; it usually buys about ${kg(account.prev3Avg)} a month.`);
  }
  if (reasons.includes('mtd')) {
    parts.push(
      `${labels.toDate}: ${kg(account.mtdKgs)}, ${pct(account.mtdChange)} below the ` +
      `${kg(account.mtdUsual)} it usually has by this day (6-month average).`
    );
  }
  if (reasons.includes('mom')) {
    parts.push(
      `${labels.lastMonth}: ${kg(account.lastMonthKgs)}, ${pct(account.momChange)} below the ` +
      `${kg(account.prev3Avg)} average of the three months before.`
    );
  }
  if (reasons.includes('overdue')) {
    parts.push(`Last ordered ${account.daysSinceLast} days ago; it normally orders every ${account.cycleDays} days.`);
  }
  return parts.join(' ');
}

// Group assessed accounts into their agents. Each agent is one batch of one
// segment; alerts inside it are ordered by how much volume is at stake.
export function buildAgents(rows) {
  const agents = new Map();
  for (const row of rows) {
    const account = assessAccount(row);
    const key = `${account.segment}-${account.batch}`;
    if (!agents.has(key)) {
      agents.set(key, {
        key,
        segment: account.segment,
        batch: account.batch,
        accounts: 0,
        firstRank: account.segmentRank,
        lastRank: account.segmentRank,
        alerts: [],
      });
    }
    const agent = agents.get(key);
    agent.accounts += 1;
    agent.firstRank = Math.min(agent.firstRank, account.segmentRank);
    agent.lastRank = Math.max(agent.lastRank, account.segmentRank);
    if (account.alert) agent.alerts.push(account);
  }
  for (const agent of agents.values()) {
    agent.alerts.sort((a, b) => b.alert.kgsBelow - a.alert.kgsBelow);
  }
  return [...agents.values()];
}

// Whole days between the newest sales row and today (UTC dates).
export function daysStale(dataThroughIso, now = new Date()) {
  if (!dataThroughIso) return null;
  const [y, m, d] = dataThroughIso.split('-').map(Number);
  const through = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((today - through) / 86400000);
}
