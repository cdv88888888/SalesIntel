import styles from "./page.module.css";
export const dynamic = 'force-dynamic';

import { getDealerAggregates, getAvailableMonths, getAccountCadence } from "../lib/bigquery";
import { normalizeSegment } from "../lib/segments";
import { getSettings } from "../lib/settings";
import { STATUS } from "../lib/cadence";
import ClientClickWrapper from "../components/ClientClickWrapper";
import CrmUpdatesStream from "./intelligence/CrmUpdatesStreamWrapper";
import { cookies } from "next/headers";

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '-';
const fmtKg = (n) => `${Math.round(n || 0).toLocaleString()} kg`;
const fmtDays = (n) => `${n % 1 ? n : Math.round(n)} days`;

const DecliningBadge = () => (
  <span style={{ color: 'var(--red)', fontSize: '13px', fontWeight: 600 }}>Declining</span>
);

const Facts = ({ a, due }) => {
  const c = a.cadence;
  return (
    <div className={styles.alertBody}>
      <p>{c.d} days since last order (usually every {fmtDays(c.x)}). Last order {fmtDate(c.lastOrderDate)}. Averages {fmtKg(c.avgKgPerOrder)} per order.</p>
      {due && <p>Due {fmtDate(c.dueDate)}. Becomes At Risk {fmtDate(c.atRiskDate)}.</p>}
    </div>
  );
};

const ActivityRing = ({ radius, stroke, progress, color, bg }) => {
  const circumference = 2 * Math.PI * radius;
  const cappedProgress = Math.min(progress, 100);
  const offset = circumference - (cappedProgress / 100) * circumference;
  
  return (
    <g transform="rotate(-90 50 50)">
      <circle cx="50" cy="50" r={radius} stroke={bg} strokeWidth={stroke} fill="none" />
      <circle 
        cx="50" cy="50" r={radius} 
        stroke={color} 
        strokeWidth={stroke} 
        strokeDasharray={circumference} 
        strokeDashoffset={offset} 
        strokeLinecap="round" 
        fill="none" 
        style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
      />
    </g>
  );
};

export default async function Dashboard({ searchParams }) {
  const params = await searchParams;
  const segment = normalizeSegment(params.segment);

  const settings = await getSettings(null, segment);
  const MONTHLY_SALES_TARGET = settings.globalTarget || 150000;
  let atRisk = [];
  let callToday = [];
  let totalKgsMonth = 0;
  let loadError = null;

  // Calculate remaining days in current month
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const remainingDays = lastDayOfMonth.getDate() - today.getDate();

  try {
    const availableMonths = await getAvailableMonths();
    if (availableMonths.length > 0) {
      const latest = availableMonths[0];
      const currentPeriod = `${latest.year}-${String(latest.month).padStart(2, '0')}`;
      const dealers = await getDealerAggregates(currentPeriod, currentPeriod, [], segment);

      for (const d of dealers) totalKgsMonth += (d.kgsSold || 0);
    }
  } catch (error) {
    console.error("Failed to load BigQuery data for dashboard:", error);
    loadError = error?.message || String(error);
  }

  try {
    const accounts = await getAccountCadence(segment);
    atRisk = accounts.filter(a => a.cadence.status === STATUS.AT_RISK);
    callToday = accounts.filter(a => a.cadence.status === STATUS.PROACTIVE);
  } catch (error) {
    console.error("Failed to load account cadence for dashboard:", error);
    loadError = loadError || error?.message || String(error);
  }

  // Calculate Monthly Target Progress
  const kgsRemaining = Math.max(0, MONTHLY_SALES_TARGET - totalKgsMonth);
  const targetProgressPct = Math.min(100, Math.round((totalKgsMonth / MONTHLY_SALES_TARGET) * 100));

  return (
    <div className={styles.dashboard}>
      <main className={styles.mainColumn}>
        <header className={styles.header}>
          <h1>MGC Sales Intelligence</h1>
          <p>Smart Relationship Management & Operational Automation</p>
        </header>

        {/* New Feature: Monthly Target Tracker */}
        <section className={`${styles.section} ${styles.monthlyGoalCard}`}>
          
          <div style={{ width: '140px', height: '140px', flexShrink: 0, position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100">
              <ActivityRing radius={42} stroke={10} progress={targetProgressPct} color="var(--blue)" bg="var(--trk)" />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '22px', lineHeight: '28px', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{targetProgressPct}%</span>
            </div>
          </div>

          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
              🎯 Monthly Goal Progress
            </h2>
            
            <div className={styles.trackerStats} style={{ display: 'flex', gap: '48px', marginBottom: 0 }}>
              <div>
                <div className={styles.statLabel}>Total Volume Sold</div>
                <div className={styles.statValue} style={{ color: 'var(--text)' }}>{totalKgsMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</div>
              </div>
              <div>
                <div className={styles.statLabel}>Monthly Target</div>
                <div className={styles.statValue}>{MONTHLY_SALES_TARGET.toLocaleString()} kg</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', paddingTop: '16px', borderTop: '1px solid var(--line)', fontVariantNumeric: 'tabular-nums' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Remaining KGs to Close:</span>
                <strong style={{ color: kgsRemaining > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {kgsRemaining > 0 ? `${kgsRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg` : 'Goal Reached!'}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Days Left in Month:</span>
                <strong style={{ color: remainingDays < 7 ? 'var(--red)' : 'var(--text)' }}>
                  {remainingDays} Days
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* Accounts overdue by order timing */}
        <section className={`${styles.section}`}>
          <h2 className={styles.sectionTitle}>
            ⚠️ At Risk ({atRisk.length})
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {loadError && (
              <p style={{ color: 'var(--danger-color, #ef4444)', fontSize: '15px', lineHeight: '22px' }}>
                Could not load sales data, so no accounts are shown. The query failed: {loadError}
              </p>
            )}
            {!loadError && atRisk.length === 0 && (
              <p style={{ color: 'var(--muted, var(--text-secondary))', fontSize: '15px', lineHeight: '22px' }}>
                No account is overdue.
              </p>
            )}
            {atRisk.map(a => (
              <ClientClickWrapper key={a.id} dealerId={a.id} className={styles.alertCard}>
                <div className={styles.alertHeader}>
                  <span>{a.name || "Unknown Dealer"}</span>
                  {a.cadence.declining && <DecliningBadge />}
                </div>
                <Facts a={a} />
              </ClientClickWrapper>
            ))}
          </div>
        </section>

        {/* Accounts due for a call */}
        <section className={`${styles.section}`}>
          <h2 className={styles.sectionTitle}>
            📞 Call Today ({callToday.length})
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {loadError && (
              <p style={{ color: 'var(--danger-color, #ef4444)', fontSize: '15px', lineHeight: '22px' }}>
                Could not load sales data, so no accounts are shown. The query failed: {loadError}
              </p>
            )}
            {!loadError && callToday.length === 0 && (
              <p style={{ color: 'var(--muted, var(--text-secondary))', fontSize: '15px', lineHeight: '22px' }}>
                No account is due for a call today.
              </p>
            )}
            {callToday.map(a => (
              <ClientClickWrapper key={a.id} dealerId={a.id} className={styles.alertCard}>
                <div className={styles.alertHeader} style={{ color: 'var(--text)' }}>
                  <span>{a.name || "Unknown Dealer"}</span>
                  {a.cadence.declining && <DecliningBadge />}
                </div>
                <Facts a={a} due />
              </ClientClickWrapper>
            ))}
          </div>
        </section>

        {/* One action card per overdue account, built from its real numbers */}
        <section className={`${styles.section}`}>
          <h2 className={styles.sectionTitle}>
            🧠 Strategic Action Cards
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!loadError && atRisk.length === 0 && (
              <p style={{ color: 'var(--muted, var(--text-secondary))', fontSize: '15px', lineHeight: '22px' }}>
                No account is overdue.
              </p>
            )}
            {atRisk.map(a => {
              const c = a.cadence;
              const lostDay = 4 * c.x;
              return (
                <ClientClickWrapper key={`ai-${a.id}`} dealerId={a.id} className={styles.actionCard}>
                  <div className={styles.actionHeader}>
                    ✨ {a.name || "Unknown Dealer"}
                  </div>
                  <p>
                    Usually orders every {fmtDays(c.x)}, last order {c.d} days ago.
                    Call before day {lostDay % 1 ? lostDay : Math.round(lostDay)}, when the account counts as lost.
                    {c.declining ? ` Recent orders are smaller: ${fmtKg(c.recentAvgKgPerOrder)} per order against ${fmtKg(c.avgKgPerOrder)} usually.` : ''}
                  </p>
                </ClientClickWrapper>
              );
            })}
          </div>
        </section>

      </main>

      <aside className={styles.sideColumn}>
        {/* Feature 4: Field Intelligence Logger */}
        <section className={`${styles.section}`}>
          <h2 className={styles.sectionTitle}>
            🛡️ Field Intelligence Logger
          </h2>
          <p style={{ color: "var(--muted)", marginBottom: "16px", fontSize: "13px", lineHeight: "18px" }}>
            Log localized competitive actions to unlock contextual discounting structures.
          </p>
          <textarea 
            className={styles.inputField} 
            placeholder="Enter rival local price slashes, tank degradation observations, etc..."
            rows={4}
          ></textarea>
          <button className={styles.button}>Submit Log & Unlock Playbook</button>
        </section>

        {/* Feature 5 & 6: Live CRM Updates Stream (Monday.com Integration) */}
        <div style={{ background: "var(--surface)", borderRadius: "var(--r-group)", padding: "16px" }}>
          <CrmUpdatesStream />
        </div>
      </aside>
    </div>
  );
}
