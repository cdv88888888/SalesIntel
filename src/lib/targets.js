// The one place that decides what an account's monthly target is, and how far
// along it is. Pure functions over the rows getDealerAggregates() returns, so
// every page shows the same target for the same account.
//
// Before this module the Hub measured against last year's month, Predictive AI
// against the three-month average, and the ledger against whichever of the two
// existed - so one dealer could be "at risk" on one page and "on track" on the
// next. The rule now:
//
//   1. A target saved in Settings always wins.
//   2. Otherwise the average of the last three complete months, plus 15%.
//   3. With fewer than three months of history, the all-time monthly average,
//      plus 15%.
//
// The current month is never in the baseline: the data for it is still being
// written, and getDealerAggregates() already stops the history at the last
// complete month.

export const TARGET_GROWTH = 1.15;
export const BASELINE_MONTHS = 3;

// What the UI calls the fallback, so the label and the formula cannot drift.
export const TARGET_BASIS_LABEL = '3-mo avg + 15%';

// Pacing thresholds, as a share of target. Below DANGER is "at risk", below
// 100% is "behind", above AHEAD is comfortably over.
export const PACE_DANGER = 0.85;
export const PACE_AHEAD = 1.2;

// How a forecast blends the current run-rate with history: a strong first
// week should not read as a record month, nor a quiet one as a collapse.
export const RUN_RATE_WEIGHT = 0.7;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// monthlyHistory arrives from BigQuery as a JSON string of
// [{ year, month, monthlyKgs }], newest first. Return it as an array, or [].
export function parseHistory(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// The newest `count` complete months, newest first, excluding `exclude`
// ({ year, month }) when given - the month being reported on must not sit in
// its own baseline.
export function recentMonths(dealer, count = BASELINE_MONTHS, exclude = null) {
  return parseHistory(dealer?.monthlyHistory)
    .filter(h => !exclude || h.year !== exclude.year || h.month !== exclude.month)
    .slice(0, count);
}

// The kilograms a month this account normally does, and how that was decided.
// `months` is how many months the figure averages (0 when nothing was known).
export function baselineFor(dealer, exclude = null) {
  const recent = recentMonths(dealer, BASELINE_MONTHS, exclude);
  if (recent.length >= BASELINE_MONTHS) {
    const total = recent.reduce((sum, m) => sum + num(m.monthlyKgs), 0);
    return { kgs: total / recent.length, months: recent.length, basis: 'recent' };
  }
  const allTime = num(dealer?.avgMonthKgs);
  if (allTime > 0) {
    return { kgs: allTime, months: recent.length, basis: 'all-time' };
  }
  return { kgs: 0, months: 0, basis: 'none' };
}

// The target for one account. `savedTargets` is the dealerTargets map from
// Settings for the current segment and month.
export function targetFor(dealer, savedTargets = {}, exclude = null) {
  const saved = num(savedTargets?.[dealer?.id]);
  if (saved > 0) {
    return { kgs: saved, basis: 'saved', baselineKgs: baselineFor(dealer, exclude).kgs };
  }
  const baseline = baselineFor(dealer, exclude);
  return { kgs: baseline.kgs * TARGET_GROWTH, basis: baseline.basis, baselineKgs: baseline.kgs };
}

// Where the month is expected to land. For the month in progress, the
// run-rate (so far, scaled to the whole month) blended with the baseline; for
// a finished month, what it actually did.
export function projectEndOfMonth({ kgsSoFar, baselineKgs, dayOfMonth, daysInMonth, inProgress }) {
  const current = num(kgsSoFar);
  if (!inProgress) return current;
  const elapsed = Math.min(1, Math.max(num(dayOfMonth), 1) / Math.max(num(daysInMonth), 1));
  const runRate = current / elapsed;
  return runRate * RUN_RATE_WEIGHT + num(baselineKgs) * (1 - RUN_RATE_WEIGHT);
}

// One of ACHIEVED, DANGER, WARNING, SAFE - the labels the pages already use.
export function paceStatus({ kgsSoFar, projectedKgs, targetKgs }) {
  const target = num(targetKgs);
  if (target <= 0) return 'SAFE';
  if (num(kgsSoFar) >= target) return 'ACHIEVED';
  const pace = num(projectedKgs) / target;
  if (pace < PACE_DANGER) return 'DANGER';
  if (pace < 1) return 'WARNING';
  return 'SAFE';
}

// The calendar facts a forecast needs, for the month the data is in.
export function monthProgress(latest, today = new Date()) {
  const year = Number(latest?.year);
  const month = Number(latest?.month);
  const inProgress = year === today.getFullYear() && month === today.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    inProgress,
    dayOfMonth: inProgress ? today.getDate() : daysInMonth,
    daysInMonth,
  };
}
