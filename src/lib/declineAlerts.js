// The volume-decline rule. Pure functions over the rows from getVolumeWatch(),
// so the thresholds live in one place and can be tuned without touching SQL.

// Warn when an account runs this far below its own normal pace.
export const DECLINE_THRESHOLD = -0.2;

// Accounts averaging less than this per 30 days are skipped: one order more or
// less swings them by half, so a percentage rule only produces noise.
export const MIN_BASE_KGS_30D = 100;

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

// Turn one measured row into an account with its verdict. `alert` is null when
// the account is behaving normally.
export function assessAccount(row) {
  const windowDays = num(row.windowDays) || 30;
  const recent30 = (num(row.recentKgs) / windowDays) * 30;
  const base30 = (num(row.baseKgs) / 90) * 30;
  const cycleDays = row.cycleDays == null ? null : num(row.cycleDays);
  const daysSinceLast = num(row.daysSinceLast);
  const deliveryDays = num(row.deliveryDays);

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
    windowDays,
    recent30,
    base30,
    change: null,
    alert: null,
  };

  // Too small to judge on percentages.
  if (base30 < MIN_BASE_KGS_30D) return account;

  const change = recent30 / base30 - 1;
  account.change = change;

  const reasons = [];
  if (change <= DECLINE_THRESHOLD) {
    reasons.push(recent30 === 0 ? 'stopped' : 'volume');
  }

  const hasCycle = cycleDays > 0 && deliveryDays >= MIN_DELIVERIES_FOR_CYCLE;
  const overdueAfter = hasCycle
    ? Math.max(cycleDays * OVERDUE_CYCLE_FACTOR, cycleDays + OVERDUE_MIN_GRACE_DAYS)
    : null;
  if (hasCycle && daysSinceLast > overdueAfter) {
    reasons.push('overdue');
  }

  if (reasons.length === 0) return account;

  account.alert = {
    reasons,
    // What the drop is worth: kilograms per 30 days below normal. Overdue-only
    // accounts can still be on pace, so this never goes negative.
    kgsBelow30: Math.max(0, base30 - recent30),
    daysOverdue: reasons.includes('overdue') ? Math.round(daysSinceLast - cycleDays) : null,
    summary: describe({ reasons, change, recent30, base30, windowDays, cycleDays, daysSinceLast }),
  };
  return account;
}

const kg = (n) => `${Math.round(n).toLocaleString('en-US')} kg`;

// One plain sentence per alert, built from the numbers only. The AI
// explanation (order mix, CRM notes) is layered on top of this later.
function describe({ reasons, change, recent30, base30, windowDays, cycleDays, daysSinceLast }) {
  const parts = [];
  if (reasons.includes('stopped')) {
    parts.push(`No volume in the last ${windowDays} days; normally about ${kg(base30)} per 30 days.`);
  } else if (reasons.includes('volume')) {
    parts.push(
      `Running ${Math.round(Math.abs(change) * 100)}% below its normal pace: ` +
      `${kg(recent30)} per 30 days against a usual ${kg(base30)}.`
    );
  }
  if (reasons.includes('overdue')) {
    parts.push(`Last ordered ${daysSinceLast} days ago; it normally orders every ${cycleDays} days.`);
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
    agent.alerts.sort((a, b) => b.alert.kgsBelow30 - a.alert.kgsBelow30);
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
