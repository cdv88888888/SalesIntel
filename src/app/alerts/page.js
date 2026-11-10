import styles from "./alerts.module.css";
export const dynamic = 'force-dynamic';

import { getVolumeWatch, WATCH_BATCH_SIZE } from "../../lib/bigquery";
import { ALL_SEGMENT, normalizeSegment, segmentLabel } from "../../lib/segments";
import {
  buildAgents,
  daysStale,
  asIsoDate,
  DECLINE_THRESHOLD,
  STALE_AFTER_DAYS,
} from "../../lib/declineAlerts";
import { getStoredExplanations } from "../../lib/alertExplanations";
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
  volume: { label: 'Volume down', tone: 'warn' },
  overdue: { label: 'Order overdue', tone: 'danger' },
};

export default async function VolumeAlerts({ searchParams }) {
  const params = await searchParams;
  const segment = normalizeSegment(params?.segment);

  let rows = [];
  let explanations = {};
  let assignments = { batches: {}, owners: {} };
  let lastRun = null;
  let alertState = {};
  let briefings = {};
  let loadError = null;
  try {
    [rows, explanations, assignments, lastRun, alertState, briefings] = await Promise.all([
      getVolumeWatch(),
      getStoredExplanations(),
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

  const agents = buildAgents(rows)
    .filter(a => segment === ALL_SEGMENT || a.segment === segment);

  const watched = agents.reduce((sum, a) => sum + a.accounts, 0);
  const alertCount = agents.reduce((sum, a) => sum + a.alerts.length, 0);
  const kgsAtStake = agents.reduce(
    (sum, a) => sum + a.alerts.reduce((s, acc) => s + acc.alert.kgsBelow30, 0), 0);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Volume Alerts</h1>
        <p>
          Accounts running at least {Math.round(Math.abs(DECLINE_THRESHOLD) * 100)}% below
          their own normal pace, or clearly overdue to order. Each agent watches{' '}
          {WATCH_BATCH_SIZE} accounts, ranked by volume — Agent 1 holds the largest.
        </p>
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
          <span className={styles.tileLabel}>Below normal, per 30 days</span>
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
                    <th className={styles.num}>Normal / 30d</th>
                    <th className={styles.num}>Now / 30d</th>
                    <th className={styles.num}>Change</th>
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
                        <ExplainButton
                          accountId={acc.id}
                          initial={explanations[acc.id] || null}
                          dataThrough={dataThrough}
                        />
                      </td>
                      <td className={styles.num}>{formatKgs(acc.base30)} kg</td>
                      <td className={styles.num}>{formatKgs(acc.recent30)} kg</td>
                      <td className={styles.num}>
                        <span className={acc.change <= DECLINE_THRESHOLD ? styles.danger : styles.muted}>
                          {acc.change > 0 ? '+' : ''}{Math.round(acc.change * 100)}%
                        </span>
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
