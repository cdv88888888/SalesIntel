import styles from "./account-sync.module.css";
export const dynamic = 'force-dynamic';

import { getAccountSignals } from "../../lib/bigquery";

// BigQuery hands DATE columns back as { value: 'YYYY-MM-DD' }.
const asDate = (d) => (typeof d === 'string' ? d : d?.value) || null;

const formatDate = (d) => {
  const iso = asDate(d);
  if (!iso) return '—';
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const formatKgs = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return Math.round(v).toLocaleString();
};

const DECLINE_THRESHOLD = -0.2;

function statusOf(row) {
  const overdue = Number(row.daysOverdue);
  if (!row.cycleDays) return { label: 'No pattern yet', tone: 'muted' };
  if (Number.isFinite(overdue) && overdue > 0) {
    return { label: `${overdue} days overdue`, tone: 'danger' };
  }
  const dueIn = -overdue;
  if (Number.isFinite(dueIn) && dueIn <= 3) {
    return { label: `Due in ${dueIn} days`, tone: 'warn' };
  }
  return { label: 'On schedule', tone: 'ok' };
}

export default async function AccountSync() {
  let signals = [];
  let loadError = null;

  try {
    signals = await getAccountSignals();
  } catch (err) {
    console.error('Failed to load account signals:', err);
    loadError = err?.message || String(err);
  }

  const dataThrough = signals.length > 0 ? formatDate(signals[0].dataThrough) : '—';
  const overdue = signals.filter(r => r.cycleDays && Number(r.daysOverdue) > 0);
  const declining = signals.filter(r => Number(r.volumeTrend) < DECLINE_THRESHOLD && Number(r.kgsPrior90) > 0);

  // The board only needs the accounts that changed state. Everything else is
  // already right on Monday and writing it again is noise.
  const actionable = signals
    .filter(r => overdue.includes(r) || declining.includes(r))
    .slice(0, 150);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className="gradient-text">Account Sync Preview</h1>
        <p>
          What would be written to Monday.com. Nothing is sent yet — this page is
          read-only while the account matching is set up.
        </p>
      </header>

      {loadError && (
        <div className={styles.error}>
          <strong>Could not load account signals.</strong> The query failed: {loadError}
        </div>
      )}

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Accounts with a pattern</span>
          <span className={styles.tileValue}>{signals.length.toLocaleString()}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Overdue to order</span>
          <span className={`${styles.tileValue} ${styles.danger}`}>{overdue.length.toLocaleString()}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Volume declining &gt;20%</span>
          <span className={`${styles.tileValue} ${styles.warn}`}>{declining.length.toLocaleString()}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Sales data through</span>
          <span className={styles.tileValue}>{dataThrough}</span>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Account</th>
              <th>Last delivery</th>
              <th className={styles.num}>Order cycle</th>
              <th>Next expected</th>
              <th>Status</th>
              <th className={styles.num}>Typical drop</th>
              <th className={styles.num}>90d vs prior</th>
              <th>Usual SKU</th>
            </tr>
          </thead>
          <tbody>
            {actionable.map(row => {
              const status = statusOf(row);
              const trend = Number(row.volumeTrend);
              const hasTrend = Number.isFinite(trend) && Number(row.kgsPrior90) > 0;
              const cylinders = Number(row.typicalCylinders) || 0;
              return (
                <tr key={row.id}>
                  <td>
                    <div className={styles.name}>{row.name}</div>
                    <div className={styles.sub}>{row.id} · {row.channel}</div>
                  </td>
                  <td>{formatDate(row.lastOrderDate)}</td>
                  <td className={styles.num}>{row.cycleDays ? `${row.cycleDays} days` : '—'}</td>
                  <td>{row.cycleDays ? formatDate(row.nextExpectedDate) : '—'}</td>
                  <td><span className={styles[status.tone]}>{status.label}</span></td>
                  <td className={styles.num}>
                    {formatKgs(row.typicalDropKgs)} kg
                    {cylinders > 0 && (
                      <div className={styles.sub}>
                        {cylinders} × {Math.round(Number(row.mainKgEach))} kg
                      </div>
                    )}
                  </td>
                  <td className={styles.num}>
                    {hasTrend ? (
                      <span className={trend < DECLINE_THRESHOLD ? styles.danger : styles.ok}>
                        {trend > 0 ? '+' : ''}{Math.round(trend * 100)}%
                      </span>
                    ) : '—'}
                    <div className={styles.sub}>
                      {formatKgs(row.kgsLast90)} vs {formatKgs(row.kgsPrior90)}
                    </div>
                  </td>
                  <td className={styles.sku}>{row.mainItem || '—'}</td>
                </tr>
              );
            })}
            {actionable.length === 0 && !loadError && (
              <tr><td colSpan={8} className={styles.empty}>Nothing needs attention.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {actionable.length === 150 && (
        <p className={styles.note}>Showing the 150 most overdue accounts.</p>
      )}
    </div>
  );
}
