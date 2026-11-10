// Account order cadence - one rule for "when should this account have ordered".
//
// In plain words:
//   1. Look at an account's orders in the last 24 months. Several deliveries
//      on the same day count as ONE order.
//   2. x = the typical gap between orders: the MEDIAN number of days between
//      one order date and the next. (Median, so one long pause does not skew it.)
//   3. d = days since the account's most recent order, as of today.
//   4. An account needs at least 3 orders (2 gaps) to have an x. Fewer = NEW.
//   5. Status, by comparing d to x:
//        HEALTHY    d is under 0.8x                  (not due yet)
//        PROACTIVE  d is from 0.8x up to 1.2x        (due soon: call them;
//                                                     clears itself when they order)
//        AT_RISK    d is from 1.2x up to 4x          (overdue)
//        LOST       d is 4x or more                  (gone)
//   6. DECLINING is a separate yes/no flag, independent of status: the average
//      kg per order over the last 3 months is under 80% of the average kg per
//      order over the 24 months. No orders in the last 3 months = not declining
//      (that is a timing problem, and the status already shows it).
//   7. Lists are sorted by average kg per order over 24 months, biggest first.
//
// Example: x = 10 days -> Proactive from day 8, At Risk from day 12, Lost from day 40.
//
// Everything here is pure (no database, no clock): "today" is passed in.

export const WINDOW_MONTHS = 24; // look-back window for an account's orders
export const MIN_ORDERS = 3; // fewer orders than this in the window = NEW (no x)
export const PROACTIVE_FACTOR = 0.8; // PROACTIVE starts at ceil(0.8 * x) days since last order
export const AT_RISK_FACTOR = 1.2; // AT_RISK starts at 1.2 * x days since last order
export const LOST_FACTOR = 4; // LOST starts at 4 * x days since last order
export const DECLINING_THRESHOLD = 0.8; // declining = recent avg kg per order below 80% of window avg
export const DECLINING_LOOKBACK_MONTHS = 3; // "recent" = the last 3 months

export const STATUS = Object.freeze({
  NEW: 'NEW',
  HEALTHY: 'HEALTHY',
  PROACTIVE: 'PROACTIVE',
  AT_RISK: 'AT_RISK',
  LOST: 'LOST',
});

const DAY_MS = 86400000;

// Accepts 'YYYY-MM-DD', a Date, or a BigQuery date ({ value: 'YYYY-MM-DD' }).
export function toIsoDate(input) {
  if (input == null) return null;
  if (typeof input === 'object' && !(input instanceof Date) && 'value' in input) {
    return toIsoDate(input.value);
  }
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  return String(input).slice(0, 10);
}

function dayNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function fromDayNumber(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

function addDays(iso, days) {
  return fromDayNumber(dayNumber(iso) + days);
}

// Calendar-month subtraction; a day that does not exist (Feb 30) clamps to month end.
export function subtractMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function uniqueSorted(orderDates) {
  return [...new Set((orderDates || []).map(toIsoDate).filter(Boolean))].sort();
}

// Median of the day gaps between consecutive distinct order dates.
// Returns null when there are fewer than 2 distinct dates (no gap exists).
export function medianGapDays(orderDates) {
  const dates = uniqueSorted(orderDates);
  if (dates.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push(dayNumber(dates[i]) - dayNumber(dates[i - 1]));
  }
  gaps.sort((a, b) => a - b);
  const mid = gaps.length >> 1;
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}

function average(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * @param {object} p
 * @param {Array<string|Date>} p.orderDates  order dates (duplicates, unsorted and out-of-window dates are fine)
 * @param {Object<string, number>} p.kgByDate total kg per order date, keyed 'YYYY-MM-DD'
 * @param {string|Date} p.today              "today", passed in so results are deterministic
 */
export function assessCadence({ orderDates, kgByDate = {}, today }) {
  const todayIso = toIsoDate(today);
  const windowStart = subtractMonths(todayIso, WINDOW_MONTHS);
  const recentStart = subtractMonths(todayIso, DECLINING_LOOKBACK_MONTHS);

  const dates = uniqueSorted(orderDates).filter(d => d >= windowStart && d <= todayIso);
  const orderCount = dates.length;
  const lastOrderDate = orderCount ? dates[orderCount - 1] : null;
  const d = lastOrderDate ? dayNumber(todayIso) - dayNumber(lastOrderDate) : null;

  const kgs = dates.map(date => Number(kgByDate[date]) || 0);
  const avgKgPerOrder = average(kgs);
  const recentKgs = dates.filter(date => date >= recentStart).map(date => Number(kgByDate[date]) || 0);
  const recentAvgKgPerOrder = average(recentKgs);
  const declining =
    recentAvgKgPerOrder !== null &&
    avgKgPerOrder > 0 &&
    recentAvgKgPerOrder < DECLINING_THRESHOLD * avgKgPerOrder;

  const base = {
    status: STATUS.NEW,
    x: null,
    d,
    lastOrderDate,
    orderCount,
    avgKgPerOrder,
    recentAvgKgPerOrder,
    declining,
    dueDate: null,
    atRiskDate: null,
  };
  if (orderCount < MIN_ORDERS) return base;

  const x = medianGapDays(dates);
  // x is a whole or half number of days, so 2x is an integer and every
  // threshold below is computed exactly (no 0.8 * x float rounding).
  const x2 = x * 2;
  const dueDays = Math.ceil((2 * x2) / 5); // ceil(0.8 * x)
  const atRiskDays = Math.ceil((3 * x2) / 5); // first whole day with d >= 1.2 * x
  const lostDays = LOST_FACTOR * x;

  let status;
  if (d < dueDays) status = STATUS.HEALTHY;
  else if (d < atRiskDays) status = STATUS.PROACTIVE;
  else if (d < lostDays) status = STATUS.AT_RISK;
  else status = STATUS.LOST;

  return {
    ...base,
    status,
    x,
    dueDate: addDays(lastOrderDate, dueDays),
    atRiskDate: addDays(lastOrderDate, atRiskDays),
  };
}

// Biggest accounts first. Accepts rows with avgKgPerOrder at the top level or
// inside a `cadence` result. Returns a new array; ties keep their input order.
export function sortByVolume(accounts) {
  const volume = a => a?.avgKgPerOrder ?? a?.cadence?.avgKgPerOrder ?? 0;
  return [...accounts].sort((a, b) => volume(b) - volume(a));
}

// Turns flat SQL rows (one per account per order date) into one assessed
// account each, biggest first. Rows: { id, name, classification, date, kg }.
export function assessAccounts(rows, today) {
  const byId = new Map();
  for (const r of rows) {
    const date = toIsoDate(r.date);
    let acc = byId.get(r.id);
    if (!acc) {
      acc = { id: r.id, name: r.name, classification: r.classification ?? null, orders: [] };
      byId.set(r.id, acc);
    }
    acc.orders.push({ date, kg: Number(r.kg) || 0 });
  }
  const accounts = [...byId.values()].map(acc => {
    acc.orders.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const kgByDate = {};
    for (const o of acc.orders) kgByDate[o.date] = (kgByDate[o.date] || 0) + o.kg;
    return { ...acc, cadence: assessCadence({ orderDates: acc.orders.map(o => o.date), kgByDate, today }) };
  });
  return sortByVolume(accounts);
}
