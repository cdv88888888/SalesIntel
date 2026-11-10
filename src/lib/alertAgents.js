// The volume-watch agents: who each batch reports to, which alerts are open,
// and the scheduled run that keeps both up to date. Server-only.
import { getAdminDb, withTimeout } from './firebase-admin';
import { getVolumeWatch, getAccountOrderDetail } from './bigquery';
import { buildAgents, asIsoDate, daysStale } from './declineAlerts';
import { explainAccount, getStoredExplanations } from './alertExplanations';

const CONFIG = 'alert_config';
const STATE = 'alert_state';

// Cost and time guards for one scheduled run.
const MAX_EXPLANATIONS_PER_RUN = 150;
const EXPLAIN_CONCURRENCY = 4;
const EXPLAIN_TIME_BUDGET_MS = 200000;

const AGENT_KEY = /^(dealer|commercial|bulk)-\d+$/;
export const isAgentKey = (key) => typeof key === 'string' && AGENT_KEY.test(key);

const docId = (accountId) => encodeURIComponent(String(accountId));
const configDoc = (name) => getAdminDb().collection(CONFIG).doc(name);

// { batches: { 'dealer-1': email }, owners: { accountId: email } }
// `owners` is where a per-account owner goes once accounts have one; when
// set, it takes precedence over the batch's person.
export async function getAssignments() {
  try {
    const snap = await withTimeout(configDoc('assignments').get());
    const data = snap.exists ? snap.data() : {};
    return { batches: data.batches || {}, owners: data.owners || {} };
  } catch (err) {
    console.error('[alerts] Could not read assignments:', err.message);
    return { batches: {}, owners: {} };
  }
}

export async function setBatchAssignment(agentKey, email) {
  const current = await getAssignments();
  const batches = { ...current.batches };
  if (email) batches[agentKey] = email;
  else delete batches[agentKey];
  await withTimeout(configDoc('assignments').set({ ...current, batches }));
  return { ...current, batches };
}

// Who a flagged account's warning goes to.
export function ownerOf(account, assignments) {
  return assignments.owners[account.id]
    || assignments.batches[`${account.segment}-${account.batch}`]
    || null;
}

export async function getLastRun() {
  try {
    const snap = await withTimeout(configDoc('lastRun').get());
    return snap.exists ? snap.data() : null;
  } catch (err) {
    console.error('[alerts] Could not read the last run:', err.message);
    return null;
  }
}

// Open/resolved state per account, keyed by account id.
export async function getAlertState() {
  try {
    const snap = await withTimeout(getAdminDb().collection(STATE).get());
    const out = {};
    snap.forEach(doc => {
      const data = doc.data();
      if (data?.accountId) out[data.accountId] = data;
    });
    return out;
  } catch (err) {
    console.error('[alerts] Could not read alert state:', err.message);
    return {};
  }
}

async function writeState(records) {
  const db = getAdminDb();
  for (let i = 0; i < records.length; i += 400) {
    const batch = db.batch();
    for (const record of records.slice(i, i + 400)) {
      batch.set(db.collection(STATE).doc(docId(record.accountId)), record);
    }
    await withTimeout(batch.commit(), 20000);
  }
}

// Run `worker` over `items`, a few at a time, stopping once `deadline` passes.
async function runPool(items, worker, concurrency, deadline) {
  let next = 0;
  const lanes = Array.from({ length: concurrency }, async () => {
    while (next < items.length && Date.now() < deadline) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
  return next;
}

// One scheduled pass of every agent: work out which accounts are flagged, mark
// new and recovered ones, and write an explanation for each flagged account
// that does not have one on the current data.
export async function runAgents({ force = false } = {}) {
  const startedAt = Date.now();
  const ranAt = new Date(startedAt).toISOString();

  const rows = await getVolumeWatch();
  const dataThrough = rows.length > 0 ? asIsoDate(rows[0].dataThrough) : null;
  const lastRun = await getLastRun();

  // Nothing new has been sold since the last pass: judging the same data
  // again would only repeat the same warnings.
  if (!force && dataThrough && lastRun?.dataThrough === dataThrough && !lastRun?.incomplete) {
    const summary = { ...lastRun, checkedAt: ranAt, skipped: 'Sales data has not changed since the last run.' };
    await withTimeout(configDoc('lastRun').set(summary));
    return summary;
  }

  const agents = buildAgents(rows);
  const flagged = agents
    .flatMap(a => a.alerts)
    .map(account => ({ ...account, dataThrough }))
    .sort((a, b) => b.alert.kgsBelow30 - a.alert.kgsBelow30);
  const flaggedIds = new Set(flagged.map(a => a.id));

  // Open / still open / recovered.
  const previous = await getAlertState();
  const records = [];
  let newCount = 0;
  for (const account of flagged) {
    const prior = previous[account.id];
    const isNew = !prior || prior.status !== 'open';
    if (isNew) newCount += 1;
    records.push({
      accountId: account.id,
      name: account.name,
      segment: account.segment,
      batch: account.batch,
      status: 'open',
      reasons: account.alert.reasons,
      firstFlaggedAt: isNew ? ranAt : prior.firstFlaggedAt,
      lastSeenAt: ranAt,
    });
  }
  let resolvedCount = 0;
  for (const prior of Object.values(previous)) {
    if (prior.status === 'open' && !flaggedIds.has(prior.accountId)) {
      resolvedCount += 1;
      records.push({ ...prior, status: 'resolved', resolvedAt: ranAt });
    }
  }
  await writeState(records);

  // Explanations, biggest loss first, for accounts not yet explained on this data.
  const stored = await getStoredExplanations();
  const toExplain = process.env.ANTHROPIC_API_KEY
    ? flagged
        .filter(a => stored[a.id]?.dataThrough !== dataThrough)
        .slice(0, MAX_EXPLANATIONS_PER_RUN)
    : [];
  let explained = 0;
  let explainErrors = 0;
  const started = await runPool(toExplain, async (account) => {
    try {
      const detail = await getAccountOrderDetail(account.id);
      await explainAccount(account, detail);
      explained += 1;
    } catch (err) {
      explainErrors += 1;
      console.error(`[alerts] Could not explain ${account.id}:`, err.message);
    }
  }, EXPLAIN_CONCURRENCY, startedAt + EXPLAIN_TIME_BUDGET_MS);

  const summary = {
    ranAt,
    dataThrough,
    dataAgeDays: daysStale(dataThrough),
    watched: rows.length,
    agents: agents.length,
    flagged: flagged.length,
    newCount,
    resolvedCount,
    explained,
    explainErrors,
    // True when the time budget ran out before every account was explained;
    // the next run picks up the rest even if the data has not moved.
    incomplete: started < toExplain.length,
    seconds: Math.round((Date.now() - startedAt) / 1000),
  };
  await withTimeout(configDoc('lastRun').set(summary));
  return summary;
}
