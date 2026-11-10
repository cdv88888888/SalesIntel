import styles from "./page.module.css";
export const dynamic = 'force-dynamic';

import { getDealerAggregates, getAvailableMonths } from "../lib/bigquery";
import { normalizeSegment } from "../lib/segments";
import { getSettings } from "../lib/settings";
import { targetFor, TARGET_BASIS_LABEL } from "../lib/targets";

// An account averaging less than this a month is skipped by the escalation
// list: one order more or less swings it by half, so "% of target" is noise.
const MIN_ESCALATION_BASELINE_KGS = 1000;
import ClientClickWrapper from "../components/ClientClickWrapper";
import CrmUpdatesStream from "./intelligence/CrmUpdatesStreamWrapper";
import { cookies } from "next/headers";

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
  const dealerTargets = settings.dealerTargets || {};
  let atRiskDealers = [];
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

      for (const d of dealers) {
        totalKgsMonth += (d.kgsSold || 0);

        // Same target rule as every other page: saved, else 3-month average
        // plus 15%. Accounts too small for a percentage to mean anything are
        // left out of the escalation list.
        const target = targetFor(d, dealerTargets, latest);
        if (target.baselineKgs > MIN_ESCALATION_BASELINE_KGS && target.kgs > 0) {
          const progress = ((d.kgsSold || 0) / target.kgs) * 100;

          // Define "Needs Attention" as less than 90% of target
          if (progress < 90) {
            atRiskDealers.push({
              ...d,
              id: d.id,
              name: d.name || "Unknown Dealer",
              kgsSold: d.kgsSold || 0,
              target: Math.round(target.kgs),
              progress: Math.min(100, Math.max(0, Math.round(progress))),
              pctDiff: progress - 100
            });
          }
        }
      }

      // Sort so the worst performers are at the top
      atRiskDealers.sort((a, b) => a.progress - b.progress);
    }
  } catch (error) {
    console.error("Failed to load BigQuery data for dashboard:", error);
    loadError = error?.message || String(error);
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

        {/* Feature 3: Predictive Order Forecasting & Anomaly Alerts */}
        <section className={`${styles.section}`}>
          <h2 className={styles.sectionTitle}>
            ⚠️ Active Escalations ({atRiskDealers.length})
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {loadError && (
              <p style={{ color: 'var(--danger-color, #ef4444)', fontSize: '15px', lineHeight: '22px' }}>
                Could not load sales data, so no escalations are shown. The query failed: {loadError}
              </p>
            )}
            {!loadError && atRiskDealers.length === 0 && (
              <p style={{ color: 'var(--muted, var(--text-secondary))', fontSize: '15px', lineHeight: '22px' }}>
                No account is below 90% of its target this month.
              </p>
            )}
            {atRiskDealers.map(dealer => (
              <ClientClickWrapper key={dealer.id} dealerId={dealer.id} className={styles.alertCard}>
                <div className={styles.alertHeader}>
                  <span>REVENUE AT RISK ALERT: {dealer.name}</span>
                  <span>Needs Attention</span>
                </div>
                <div className={styles.alertBody}>
                  <p>Volume collapsed below minimum established benchmark. Current volume is only {dealer.progress}% of the baseline target.</p>
                </div>
                <button className={styles.button} style={{ width: '100%', pointerEvents: 'none' }}>View Data & Playbook</button>
              </ClientClickWrapper>
            ))}
          </div>
        </section>

        {/* Feature 1: Smart Rebate & Discount Calculator */}
        <section className={`${styles.section}`}>
          <h2 className={styles.sectionTitle}>
            📊 Dealer Performance (At-Risk Segment)
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {atRiskDealers.map(dealer => (
              <div key={`perf-${dealer.id}`}>
                <ClientClickWrapper dealerId={dealer.id}>
                  <h3 style={{ fontSize: "17px", lineHeight: "22px", fontWeight: 600, marginBottom: "8px", color: 'var(--blue)', cursor: 'pointer' }}>
                    {dealer.name}
                  </h3>
                </ClientClickWrapper>
                <div className={styles.trackerStats} style={{ marginBottom: "8px" }}>
                  <div>
                    <div className={styles.statLabel}>Current Volume (Total KGS)</div>
                    <div className={styles.statValue} style={{ fontSize: "17px" }}>{dealer.kgsSold.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className={styles.statLabel}>Target ({TARGET_BASIS_LABEL})</div>
                    <div className={styles.statValue} style={{ fontSize: "17px" }}>{dealer.target.toLocaleString()} kg</div>
                  </div>
                </div>
                
                <div className={styles.progressBarContainer}>
                  <div 
                    className={styles.progressBar} 
                    style={{ width: `${dealer.progress}%`, background: dealer.progress < 80 ? 'var(--red)' : 'var(--blue)' }}
                  ></div>
                </div>
                <div className={styles.statLabel} style={{ textAlign: "center", marginBottom: "16px", marginTop: "8px" }}>
                  {dealer.progress}% of localized sales target baseline reached
                </div>
                
                <button className={styles.button} style={{ width: "auto", fontSize: "13px", minHeight: "36px", padding: "0 16px" }}>Generate Volume Rebate Promo</button>
              </div>
            ))}
          </div>
        </section>

        {/* Feature 2: Claude AI Pattern Recognition Engine */}
        <section className={`${styles.section}`}>
          <h2 className={styles.sectionTitle}>
            🧠 Strategic Action Cards
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {atRiskDealers.map(dealer => (
              <ClientClickWrapper key={`ai-${dealer.id}`} dealerId={dealer.id} className={styles.actionCard}>
                <div className={styles.actionHeader}>
                  ✨ Claude AI Insight
                </div>
                <p>{dealer.name}&apos;s ordering cadence has slowed down significantly relative to their normal baseline. Suggest deploying a pre-approved volume promotion immediately to shield this account from rival poaching.</p>
              </ClientClickWrapper>
            ))}
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
