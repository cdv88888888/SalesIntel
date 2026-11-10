import styles from "../proactive/page.module.css";
export const dynamic = 'force-dynamic';

import { getAccountCadence, getProactiveCallingData } from "../../lib/bigquery";
import { LOST_FACTOR, STATUS } from "../../lib/cadence";
import { normalizeSegment } from "../../lib/segments";
import { cookies } from "next/headers";
import ExpandableKanban from "../../components/ExpandableKanban";
import RiskTableModal from "../../components/RiskTableModal";
import RiskChart from "../../components/RiskChart";
import { getSettings } from "../../lib/settings";
import ClientClickWrapper from "../../components/ClientClickWrapper";

const DAY_MS = 86400000;

// Dates arrive as 'YYYY-MM-DD'; shown the same way the rest of the app does.
const formatDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// The engine reports when an account turns At Risk but not when it turns Lost,
// so apply its own LOST_FACTOR to the engine's x and last order date.
const lostDate = (c) => {
  const [y, m, d] = c.lastOrderDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + LOST_FACTOR * c.x * DAY_MS).toISOString().slice(0, 10);
};

const kgFormat = (n) => Math.round(n || 0).toLocaleString();

export default async function RiskAndChurn({ searchParams }) {
  await cookies();
  const params = await searchParams;
  const segment = normalizeSegment(params?.segment);

  let atRisk = [];
  let lost = [];
  let loadError = null;

  try {
    const accounts = await getAccountCadence(segment);
    // Already sorted biggest account first by the engine; filtering keeps that order.
    const card = (a) => ({
      id: a.id,
      name: a.name,
      ...a.cadence,
      lostOn: lostDate(a.cadence),
    });
    atRisk = accounts.filter(a => a.cadence.status === STATUS.AT_RISK).map(card);
    lost = accounts.filter(a => a.cadence.status === STATUS.LOST).map(card);
  } catch (error) {
    console.error("Failed to load Risk data:", error);
    loadError = error?.message || String(error);
  }

  // Volume vs target chart: monthly totals, unrelated to the cadence rule.
  let currentVolume = 0;
  let lastMonthVolume = 0;
  let target = 0;
  try {
    const rawData = await getProactiveCallingData(segment);
    const settings = await getSettings(null, segment);
    target = settings?.globalTarget || 0;
    for (const dealer of rawData) {
      currentVolume += Math.round(dealer.current_month_vol || 0);
      lastMonthVolume += Math.round(dealer.prev_month_vol || 0);
    }
  } catch (error) {
    console.error("Failed to load Risk volume chart:", error);
  }

  const renderRiskCard = (a, type) => (
    <ClientClickWrapper
      key={a.id}
      dealerId={a.id}
      className={styles.card}
    >
      <div className={styles.dealerName}>{a.name}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Last Order:</span>
          <span className={styles.statValue}>{formatDate(a.lastOrderDate)} ({a.d} days ago)</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Usual gap:</span>
          <span className={styles.statValue}>Every {a.x} days</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Avg per order:</span>
          <span className={styles.statValue}>{kgFormat(a.avgKgPerOrder)} kg</span>
        </div>
        {type === 'at_risk' && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Lost on:</span>
            <span className={styles.statValue}>{formatDate(a.lostOn)}</span>
          </div>
        )}

        <div className={styles.pitchBox}>
          <div className={styles.pitchLabel}>{type === 'lost' ? 'Lost Account' : 'At Risk'}</div>
          <div className={styles.pitchValue}>
            {type === 'lost'
              ? `${a.d - LOST_FACTOR * a.x} days past the lost line (${formatDate(a.lostOn)}).`
              : `${a.d} days since last order, usual gap ${a.x}.`}
            {a.declining && <> <strong style={{ color: 'var(--orange)' }}>Declining</strong></>}
          </div>
        </div>
      </div>
    </ClientClickWrapper>
  );

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1>Risk & Churn Analysis</h1>
        <p>Accounts that are overdue to order or have stopped ordering, by their own ordering rhythm.</p>
      </header>

      {loadError && (
        <p style={{ color: 'var(--red)' }}>
          <strong>Could not load account data.</strong> The query failed: {loadError}
        </p>
      )}

      <RiskChart
        currentVolume={currentVolume}
        lastMonthVolume={lastMonthVolume}
        target={target}
      />

      <ExpandableKanban className={styles.kanbanBoard} isGrid={true}>
        <div className={`${styles.column}`}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitle} style={{ color: 'var(--orange)' }}>At Risk</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RiskTableModal title="At Risk" dealers={atRisk} segment={segment} />
              <div className={styles.countBadge}>{atRisk.length}</div>
            </div>
          </div>
          <div className={styles.cardList}>
            {atRisk.map(a => renderRiskCard(a, 'at_risk'))}
            {atRisk.length === 0 && !loadError && <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '20px' }}>No accounts at risk.</div>}
          </div>
        </div>

        <div className={`${styles.column}`}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitle} style={{ color: 'var(--red)' }}>Lost Accounts</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RiskTableModal title="Lost Accounts" dealers={lost} segment={segment} />
              <div className={styles.countBadge}>{lost.length}</div>
            </div>
          </div>
          <div className={styles.cardList}>
            {lost.map(a => renderRiskCard(a, 'lost'))}
            {lost.length === 0 && !loadError && <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '20px' }}>No lost accounts.</div>}
          </div>
        </div>
      </ExpandableKanban>
    </div>
  );
}
