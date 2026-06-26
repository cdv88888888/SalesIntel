import styles from "./page.module.css";
export const dynamic = 'force-dynamic';

import { getDealerAggregates, getAvailableMonths } from "../lib/bigquery";
import { getSettings } from "../lib/settings";
import ViewDealerModal from "./intelligence/ViewDealerModal";
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
  const segment = params.segment || 'dealer';

  const settings = await getSettings();
  const MONTHLY_SALES_TARGET = settings.globalTarget || 150000;
  const dealerTargets = settings.dealerTargets || {};
  let atRiskDealers = [];
  let totalKgsMonth = 0;

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
        
        if (d.prevKgsSold && d.prevKgsSold > 1000) { // filter out tiny dealers to avoid noise
          const target = dealerTargets[d.id] || (d.prevKgsSold * 1.15);
          const progress = (d.kgsSold / target) * 100;
          
          // Define "Needs Attention" as less than 90% of target
          if (progress < 90) {
            atRiskDealers.push({
              ...d,
              id: d.id,
              name: d.name || "Unknown Dealer",
              kgsSold: d.kgsSold || 0,
              target: Math.round(target),
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
  }

  // Calculate Monthly Target Progress
  const kgsRemaining = Math.max(0, MONTHLY_SALES_TARGET - totalKgsMonth);
  const targetProgressPct = Math.min(100, Math.round((totalKgsMonth / MONTHLY_SALES_TARGET) * 100));

  // If BigQuery fails, provide some fallback data for preview
  if (atRiskDealers.length === 0) {
    atRiskDealers = [{
      id: "FB-1",
      name: "MARISON LPG TRADING (Mockup)",
      kgsSold: 1248,
      target: 1600,
      progress: 78
    }];
  }

  return (
    <div className={styles.dashboard}>
      <main className={styles.mainColumn}>
        <header className={styles.header}>
          <h1 className="gradient-text">Dealer Intelligence</h1>
          <p>Smart Relationship Management & Operational Automation</p>
        </header>

        {/* New Feature: Monthly Target Tracker */}
        <section className={`${styles.section} glass-panel`} style={{ borderColor: 'var(--primary-accent)', display: 'flex', alignItems: 'center', gap: '32px' }}>
          
          <div style={{ width: '140px', height: '140px', flexShrink: 0, position: 'relative', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100">
              <ActivityRing radius={42} stroke={10} progress={targetProgressPct} color="var(--primary-accent)" bg="rgba(59, 130, 246, 0.2)" />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{targetProgressPct}%</span>
            </div>
          </div>

          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
              🎯 Monthly Goal Progress
            </h2>
            
            <div className={styles.trackerStats} style={{ display: 'flex', gap: '48px', marginBottom: 0 }}>
              <div>
                <div className={styles.statLabel}>Total Volume Sold</div>
                <div className={styles.statValue} style={{ color: 'var(--text-primary)' }}>{totalKgsMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</div>
              </div>
              <div>
                <div className={styles.statLabel}>Monthly Target</div>
                <div className={styles.statValue}>{MONTHLY_SALES_TARGET.toLocaleString()} kg</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Remaining KGs to Close:</span>
                <strong style={{ color: kgsRemaining > 0 ? 'var(--danger-color)' : 'var(--success-color, #4ade80)' }}>
                  {kgsRemaining > 0 ? `${kgsRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg` : 'Goal Reached!'}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Days Left in Month:</span>
                <strong style={{ color: remainingDays < 7 ? 'var(--danger-color)' : 'var(--text-primary)' }}>
                  {remainingDays} Days
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* Feature 3: Predictive Order Forecasting & Anomaly Alerts */}
        <section className={`${styles.section} glass-panel`}>
          <h2 className={styles.sectionTitle}>
            ⚠️ Active Escalations ({atRiskDealers.length})
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {atRiskDealers.map(dealer => (
              <div key={dealer.id} className={styles.alertCard}>
                <div className={styles.alertHeader}>
                  <span>REVENUE AT RISK ALERT: {dealer.name}</span>
                  <span>Needs Attention</span>
                </div>
                <div className={styles.alertBody}>
                  <p>Volume collapsed below minimum established benchmark. Current volume is only {dealer.progress}% of the baseline target.</p>
                </div>
                <ViewDealerModal 
                  dealer={dealer} 
                  customTrigger={<button className={styles.button} style={{ width: '100%' }}>View Data & Playbook</button>} 
                />
              </div>
            ))}
          </div>
        </section>

        {/* Feature 1: Smart Rebate & Discount Calculator */}
        <section className={`${styles.section} glass-panel`}>
          <h2 className={styles.sectionTitle}>
            📊 Dealer Performance (At-Risk Segment)
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {atRiskDealers.map(dealer => (
              <div key={`perf-${dealer.id}`}>
                <h3 style={{ fontSize: "1rem", marginBottom: "8px" }}>{dealer.name}</h3>
                <div className={styles.trackerStats} style={{ marginBottom: "8px" }}>
                  <div>
                    <div className={styles.statLabel}>Current Volume (Total KGS)</div>
                    <div className={styles.statValue} style={{ fontSize: "1.2rem" }}>{dealer.kgsSold.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className={styles.statLabel}>Target (Avg + 15%)</div>
                    <div className={styles.statValue} style={{ fontSize: "1.2rem" }}>{dealer.target.toLocaleString()} kg</div>
                  </div>
                </div>
                
                <div className={styles.progressBarContainer}>
                  <div 
                    className={styles.progressBar} 
                    style={{ width: `${dealer.progress}%`, background: dealer.progress < 80 ? 'var(--danger-color)' : 'var(--primary-accent)' }}
                  ></div>
                </div>
                <div className={styles.statLabel} style={{ textAlign: "center", marginBottom: "16px", marginTop: "8px" }}>
                  {dealer.progress}% of localized sales target baseline reached
                </div>
                
                <button className={styles.button} style={{ width: "auto", fontSize: "0.85rem", padding: "6px 12px" }}>Generate Volume Rebate Promo</button>
              </div>
            ))}
          </div>
        </section>

        {/* Feature 2: Gemini AI Pattern Recognition Engine */}
        <section className={`${styles.section} glass-panel`}>
          <h2 className={styles.sectionTitle}>
            🧠 Strategic Action Cards
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {atRiskDealers.map(dealer => (
              <div key={`ai-${dealer.id}`} className={styles.actionCard}>
                <div className={styles.actionHeader}>
                  ✨ Gemini AI Insight
                </div>
                <p>{dealer.name}&apos;s ordering cadence has slowed down significantly relative to their normal baseline. Suggest deploying a pre-approved volume promotion immediately to shield this account from rival poaching.</p>
              </div>
            ))}
          </div>
        </section>

      </main>

      <aside className={styles.sideColumn}>
        {/* Feature 4: Field Intelligence Logger */}
        <section className={`${styles.section} glass-panel`}>
          <h2 className={styles.sectionTitle}>
            🛡️ Field Intelligence Logger
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "16px", fontSize: "0.9rem" }}>
            Log localized competitive actions to unlock contextual discounting structures.
          </p>
          <textarea 
            className={styles.inputField} 
            placeholder="Enter rival local price slashes, tank degradation observations, etc..."
            rows={4}
          ></textarea>
          <button className={styles.button}>Submit Log & Unlock Playbook</button>
        </section>

        {/* Placeholder for Feature 5 & 6 (Phase 2 CRM Integration) */}
        <section className={`${styles.section} glass-panel`} style={{ opacity: 0.5 }}>
          <h2 className={styles.sectionTitle}>
            🔄 CRM Updates Stream
          </h2>
          <p style={{ fontSize: "0.9rem" }}>
            (Pending Monday.com Integration)
          </p>
          <div style={{ marginTop: "16px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            <p><strong>2026-02-07 | Mel Dorio</strong></p>
            <p>Subject: Swapping Approval...</p>
          </div>
        </section>
      </aside>
    </div>
  );
}
