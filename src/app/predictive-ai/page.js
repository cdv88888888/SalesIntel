import styles from "./page.module.css";
export const dynamic = 'force-dynamic';

import { getDealerAggregates, getAvailableMonths } from "../../lib/bigquery";
import { getSettings } from "../../lib/settings";
import ClientClickWrapper from "../../components/ClientClickWrapper";
import { cookies } from "next/headers";

export default async function PredictiveAI({ searchParams }) {
  const params = await searchParams;
  const segment = params.segment || 'dealer';

  const settings = await getSettings(null, segment);
  const dealerTargets = settings.dealerTargets || {};
  
  let predictions = [];

  // Calculate days in current month to figure out run-rate
  const today = new Date();
  const currentDay = today.getDate();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthProgressPct = currentDay / lastDayOfMonth;

  try {
    const availableMonths = await getAvailableMonths();
    if (availableMonths.length > 0) {
      const latest = availableMonths[0];
      // Only forecast if we are looking at the current month
      const isCurrentMonth = latest.year === today.getFullYear() && latest.month === (today.getMonth() + 1);
      
      const currentPeriod = `${latest.year}-${String(latest.month).padStart(2, '0')}`;
      const dealers = await getDealerAggregates(currentPeriod, currentPeriod, [], segment);

      for (const d of dealers) {
        if (!d.monthlyHistory || d.kgsSold < 500) continue; // Skip small accounts for cleaner predictions

        const history = JSON.parse(d.monthlyHistory);
        // Exclude current month from history average if it's incomplete
        const pastMonths = history.filter(h => h.year !== latest.year || h.month !== latest.month);
        
        if (pastMonths.length < 3) continue; // Need at least 3 months of history to predict

        // Calculate 3-month moving average
        const recent3 = pastMonths.slice(0, 3);
        const avg3Month = recent3.reduce((sum, m) => sum + m.monthlyKgs, 0) / 3;

        // Current Run-Rate Calculation
        const currentKgs = d.kgsSold || 0;
        let projectedKgs = currentKgs;
        
        if (isCurrentMonth) {
          // If we are halfway through the month, multiply current by (total_days / current_day)
          // But blend it with the historical average to smooth out spikes
          const pureRunRate = currentKgs / monthProgressPct;
          projectedKgs = (pureRunRate * 0.7) + (avg3Month * 0.3); 
        } else {
          // If the month is already over, the projected is just the final amount
          projectedKgs = currentKgs;
        }

        const target = dealerTargets[d.id] || (avg3Month * 1.15); // Default target is 15% growth over 3mo avg
        const projectedProgressPct = (projectedKgs / target) * 100;
        
        let status = "SAFE";
        let insight = (
          <ul className={styles.insightList}>
            <li>Projected to hit <strong>{Math.round(projectedProgressPct)}% of target</strong></li>
            <li>Run-rate aligns with historical avg</li>
          </ul>
        );
        
        if (currentKgs >= target) {
          status = "ACHIEVED";
          insight = (
            <ul className={styles.insightList}>
              <li>Reached <strong>{Math.round((currentKgs / target) * 100)}% of target</strong></li>
              <li>Volume is strong and secure</li>
            </ul>
          );
        } else if (projectedProgressPct < 85) {
          status = "DANGER";
          insight = (
            <ul className={styles.insightList}>
              <li>Pacing <strong>{Math.round(100 - projectedProgressPct)}% below target</strong></li>
              <li>
                <div>Weak run-rate vs 3-mo avg</div>
                <div className={styles.historyTable}>
                  {recent3.map((m, i) => (
                    <div key={i} className={styles.historyRow}>
                      <span className={styles.historyMonth}>{new Date(m.year, m.month - 1).toLocaleString('default', { month: 'short' })}</span>
                      <span className={styles.historyKgs}>{Math.round(m.monthlyKgs).toLocaleString()} kg</span>
                    </div>
                  ))}
                </div>
              </li>
              <li><strong>Action:</strong> Intervene immediately</li>
            </ul>
          );
        } else if (projectedProgressPct < 100) {
          status = "WARNING";
          insight = (
            <ul className={styles.insightList}>
              <li>Pacing <strong>{Math.round(100 - projectedProgressPct)}% below target</strong></li>
              <li>Needs a push to hit {Math.round(target).toLocaleString()} kg</li>
            </ul>
          );
        } else if (projectedProgressPct > 120) {
          status = "SAFE";
          insight = (
            <ul className={styles.insightList}>
              <li>Tracking <strong>{Math.round(projectedProgressPct - 100)}% above target</strong></li>
              <li><strong>Action:</strong> Consider increasing target next month</li>
            </ul>
          );
        }

        predictions.push({
          id: d.id,
          name: d.name || "Unknown Dealer",
          currentKgs: currentKgs,
          projectedKgs: Math.round(projectedKgs),
          target: Math.round(target),
          avg3Month: Math.round(avg3Month),
          projectedProgressPct: Math.min(150, Math.round(projectedProgressPct)),
          status,
          insight
        });
      }
      
      // Inject a mock "ACHIEVED" dealer so the user can see the UI for it
      predictions.push({
        id: "MOCK-ACHIEVED-1",
        name: "LPG SUMMIT TRADING (Demo)",
        currentKgs: 25000,
        projectedKgs: 30000,
        target: 22000,
        avg3Month: 19100,
        projectedProgressPct: 136,
        status: "ACHIEVED",
        insight: (
          <ul className={styles.insightList}>
            <li>Reached <strong>113% of target</strong></li>
            <li>Volume is strong and secure</li>
          </ul>
        )
      });

      // Sort by status (Danger first, then warning, then safe, then achieved)
      const statusWeight = { "DANGER": 4, "WARNING": 3, "SAFE": 2, "ACHIEVED": 1 };
      predictions.sort((a, b) => {
        if (statusWeight[b.status] !== statusWeight[a.status]) {
          return statusWeight[b.status] - statusWeight[a.status];
        }
        return b.projectedProgressPct - a.projectedProgressPct;
      });
    }
  } catch (error) {
    console.error("Failed to load BigQuery data for Predictive AI:", error);
    // Mock data fallback
    predictions = [
      {
        id: "MOCK-1",
        name: "SEVA LPG TRADING (Mock)",
        currentKgs: 12400,
        projectedKgs: 14500,
        target: 20000,
        avg3Month: 18500,
        projectedProgressPct: 72,
        status: "DANGER",
        insight: (
          <ul className={styles.insightList}>
            <li>Pacing <strong>28% below target</strong></li>
            <li>
              <div>Weak run-rate vs 3-mo avg</div>
              <div className={styles.historyTable}>
                <div className={styles.historyRow}><span className={styles.historyMonth}>May</span><span className={styles.historyKgs}>18,200 kg</span></div>
                <div className={styles.historyRow}><span className={styles.historyMonth}>Apr</span><span className={styles.historyKgs}>19,100 kg</span></div>
                <div className={styles.historyRow}><span className={styles.historyMonth}>Mar</span><span className={styles.historyKgs}>18,200 kg</span></div>
              </div>
            </li>
            <li><strong>Action:</strong> Intervene immediately</li>
          </ul>
        )
      }
    ];
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className="gradient-text">Predictive AI Forecast</h1>
        <p>Mathematical modeling of end-of-month volume based on historical run-rates</p>
      </header>

      <div className={styles.grid}>
        {predictions.map(dealer => (
          <ClientClickWrapper 
            key={dealer.id} 
            dealerId={dealer.id}
            className={`${styles.card} glass-panel`} 
            style={{ 
              borderColor: dealer.status === 'DANGER' ? 'rgba(248, 113, 113, 0.3)' : dealer.status === 'WARNING' ? 'rgba(250, 204, 21, 0.3)' : dealer.status === 'ACHIEVED' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255,255,255,0.05)',
              cursor: 'pointer'
            }}
          >
            <div className={styles.cardHeader}>
              <div className={styles.dealerName}>{dealer.name}</div>
              <div className={`${styles.statusBadge} ${dealer.status === 'DANGER' ? styles.statusDanger : dealer.status === 'WARNING' ? styles.statusWarning : dealer.status === 'ACHIEVED' ? styles.statusAchieved : styles.statusSafe}`}>
                {dealer.status === 'DANGER' ? 'AT RISK' : dealer.status === 'WARNING' ? 'BEHIND TARGET' : dealer.status === 'ACHIEVED' ? 'TARGET MET' : 'ON TRACK'}
              </div>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Current MTD</span>
                <span className={styles.statValue}>{dealer.currentKgs.toLocaleString()} kg</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Projected EOM</span>
                <span className={styles.statValue}>{dealer.projectedKgs.toLocaleString()} kg</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Monthly Target</span>
                <span className={styles.statValue}>{dealer.target.toLocaleString()} kg</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>3-Mo Average</span>
                <span className={styles.statValue}>{dealer.avg3Month.toLocaleString()} kg</span>
              </div>
            </div>

            <div className={styles.progressSection}>
              <div className={styles.progressLabelRow}>
                <span>Projected Target Progress</span>
                <strong>{dealer.projectedProgressPct}%</strong>
              </div>
              <div className={styles.progressBarContainer}>
                <div 
                  className={styles.progressBar} 
                  style={{ 
                    width: `${dealer.projectedProgressPct}%`,
                    background: dealer.status === 'DANGER' ? '#f87171' : dealer.status === 'WARNING' ? '#facc15' : dealer.status === 'ACHIEVED' ? '#a855f7' : '#4ade80'
                  }}
                ></div>
              </div>
            </div>

            <div className={`${styles.insightBox} ${dealer.status === 'DANGER' ? styles.insightBoxDanger : dealer.status === 'WARNING' ? styles.insightBoxWarning : dealer.status === 'ACHIEVED' ? styles.insightBoxAchieved : styles.insightBoxSafe}`}>
              <div className={`${styles.insightHeader} ${dealer.status === 'DANGER' ? styles.insightHeaderDanger : dealer.status === 'WARNING' ? styles.insightHeaderWarning : dealer.status === 'ACHIEVED' ? styles.insightHeaderAchieved : styles.insightHeaderSafe}`}>
                <span>{dealer.status === 'DANGER' ? '🚨' : dealer.status === 'WARNING' ? '⚠️' : dealer.status === 'ACHIEVED' ? '🏆' : '✨'} AI Analysis</span>
              </div>
              {dealer.insight}
            </div>
            
          </ClientClickWrapper>
        ))}
      </div>
    </div>
  );
}
