import styles from "./alerts.module.css";
export const dynamic = 'force-dynamic';

import { getVolumeWatch, WATCH_BATCH_SIZE } from "../../lib/bigquery";
import { ALL_SEGMENT, normalizeSegment, segmentLabel } from "../../lib/segments";
import {
  buildAgents,
  daysStale,
  asIsoDate,
  periodLabels,
  DECLINE_THRESHOLD,
  MTD_START_DAY,
  STALE_AFTER_DAYS,
} from "../../lib/declineAlerts";
import { getAssignments, getLastRun, getAlertState } from "../../lib/alertAgents";
import { getStoredBriefings } from "../../lib/agentBriefing";
import ExplainButton from "./ExplainButton";
import AgentBriefing from "./AgentBriefing";

const formatDate = (iso) => {
  if (!iso) return '—';
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
};

const formatKgs = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return Math.round(v).toLocaleString('en-US');
};

const REASON_LABELS = {
  stopped: { label: 'Stopped ordering', tone: 'danger' },
  mtd: { label: 'This month behind', tone: 'warn' },
  mom: { label: 'Last month down', tone: 'warn' },
  overdue: { label: 'Order overdue', tone: 'danger' },
};

// A percentage against the average, red once it crosses the threshold. Shows
// nothing when the comparison was not made (too early in the month, or too
// little history).
function ChangeTag({ change }) {
  if (change === null || change === undefined) return <div className={styles.sub}>not judged</div>;
  return (
    <div className={change <= DECLINE_THRESHOLD ? styles.danger : styles.muted}>
      {change > 0 ? '+' : ''}{Math.round(change * 100)}%
    </div>
  );
}

export default async function VolumeAlerts({ searchParams }) {
  const params = await searchParams;
  const segment = normalizeSegment(params?.segment);

  let rows = [];
  let assignments = { batches: {}, owners: {} };
  let lastRun = null;
  let alertState = {};
  let briefings = {};
  let loadError = null;
  try {
    [rows, assignments, lastRun, alertState, briefings] = await Promise.all([
      getVolumeWatch(),
      getAssignments(),
      getLastRun(),
      getAlertState(),
      getStoredBriefings(),
    ]);
  } catch (err) {
    console.error('Failed to load volume watch:', err);
    loadError = err?.message || String(err);
  }

  const dataThrough = rows.length > 0 ? asIsoDate(rows[0].dataThrough) : null;
  const stale = daysStale(dataThrough);
  const isStale = stale !== null && stale > STALE_AFTER_DAYS;
  const labels = periodLabels(dataThrough);
  const dayOfMonth = dataThrough ? Number(dataThrough.split('-')[2]) : null;
  const mtdActive = dayOfMonth !== null && dayOfMonth >= MTD_START_DAY;
  const threshold = Math.round(Math.abs(DECLINE_THRESHOLD) * 100);

  const agents = buildAgents(rows)
    .filter(a => segment === ALL_SEGMENT || a.segment === segment);

  const watched = agents.reduce((sum, a) => sum + a.accounts, 0);
  const alertCount = agents.reduce((sum, a) => sum + a.alerts.length, 0);
  const kgsAtStake = agents.reduce(
    (sum, a) => sum + a.alerts.reduce((s, acc) => s + acc.alert.kgsBelow, 0), 0);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className="gradient-text">Volume Alerts</h1>
        <p>
          Measured by calendar month. An account is flagged when this month to date is{' '}
          {threshold}% below its 6-month average for the same days, when last month was{' '}
          {threshold}% below the average of the three months before, or when it is clearly
          overdue to order. Each agent watches {WATCH_BATCH_SIZE} accounts, ranked by
          volume — Agent 1 holds the largest.
        </p>
        {dataThrough && !mtdActive && (
          <p className={styles.runLine}>
            The this-month check starts on the {MTD_START_DAY}th; until then only last
            month is judged.
          </p>
        )}
        {lastRun && (
          <p className={styles.runLine}>
            Agents last ran {formatDateTime(lastRun.checkedAt || lastRun.ranAt)}: {lastRun.newCount} new,{' '}
            {lastRun.resolvedCount} recovered.
          </p>
        )}
      </header>

      {loadError && (
        <div className={styles.error}>
          <strong>Could not load the volume watch.</strong> The query failed: {loadError}
        </div>
      )}

      {isStale && (
        <div className={styles.stale}>
          <strong>Sales data is {stale} days old.</strong> The newest sale on record is{' '}
          {formatDate(dataThrough)}, so some of these drops may only be data that has not
          arrived yet.
        </div>
      )}

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Accounts watched</span>
          <span className={styles.tileValue}>{watched.toLocaleString('en-US')}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Agents</span>
          <span className={styles.tileValue}>{agents.length.toLocaleString('en-US')}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Accounts flagged</span>
          <span className={`${styles.tileValue} ${styles.danger}`}>{alertCount.toLocaleString('en-US')}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Below average, per month</span>
          <span className={`${styles.tileValue} ${styles.warn}`}>{formatKgs(kgsAtStake)} kg</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Sales data through</span>
          <span className={styles.tileValue}>{formatDate(dataThrough)}</span>
        </div>
      </div>

      {agents.length === 0 && !loadError && (
        <p className={styles.empty}>No accounts to watch in this channel.</p>
      )}

      {agents.map(agent => (
        <section key={agent.key} className={styles.agent}>
          <div className={styles.agentHead}>
            <h2>{segmentLabel(agent.segment)} · Agent {agent.batch}</h2>
            <span className={styles.agentMeta}>
              Accounts ranked {agent.firstRank}–{agent.lastRank} by volume
              {' · '}
              {assignments.batches[agent.key] || 'Unassigned'}
            </span>
            <span className={agent.alerts.length > 0 ? styles.badgeAlert : styles.badgeClear}>
              {agent.alerts.length > 0
                ? `${agent.alerts.length} flagged`
                : 'All on pace'}
            </span>
          </div>

          <AgentBriefing
            agentKey={agent.key}
            initial={briefings[agent.key] || null}
            dataThrough={dataThrough}
          />

          {agent.alerts.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Warning</th>
                    <th className={styles.num}>{labels.toDate}</th>
                    <th className={styles.num}>{labels.lastMonth}</th>
                    <th>Last order</th>
                    <th className={styles.num}>Orders every</th>
                  </tr>
                </thead>
                <tbody>
                  {agent.alerts.map(acc => (
                    <tr key={acc.id}>
                      <td>
                        <div className={styles.name}>
                          {acc.name}
                          {lastRun && alertState[acc.id]?.firstFlaggedAt === lastRun.ranAt && (
                            <span className={styles.newTag}>New</span>
                          )}
                        </div>
                        <div className={styles.sub}>{acc.id} · {acc.channel}</div>
                      </td>
                      <td className={styles.why}>
                        <div className={styles.reasons}>
                          {acc.alert.reasons.map(r => (
                            <span key={r} className={`${styles.reason} ${styles[REASON_LABELS[r].tone]}`}>
                              {REASON_LABELS[r].label}
                            </span>
                          ))}
                        </div>
                        <div className={styles.sub}>{acc.alert.summary}</div>
                        <ExplainButton accountId={acc.id} />
                      </td>
                      <td className={styles.num}>
                        {formatKgs(acc.mtdKgs)} kg
                        <div className={styles.sub}>usual {formatKgs(acc.mtdUsual)}</div>
                        <ChangeTag change={acc.mtdChange} />
                      </td>
                      <td className={styles.num}>
                        {formatKgs(acc.lastMonthKgs)} kg
                        <div className={styles.sub}>3-mo avg {formatKgs(acc.prev3Avg)}</div>
                        <ChangeTag change={acc.momChange} />
                      </td>
                      <td>
                        {formatDate(acc.lastOrderDate)}
                        <div className={styles.sub}>{acc.daysSinceLast} days ago</div>
                      </td>
                      <td className={styles.num}>
                        {acc.cycleDays ? `${acc.cycleDays} days` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
