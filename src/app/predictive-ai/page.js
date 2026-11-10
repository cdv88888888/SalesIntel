import styles from "./page.module.css";
export const dynamic = 'force-dynamic';

import { getDealerAggregates, getAvailableMonths } from "../../lib/bigquery";
import { normalizeSegment } from "../../lib/segments";
import { getSettings } from "../../lib/settings";
import ClientClickWrapper from "../../components/ClientClickWrapper";
import { cookies } from "next/headers";
import {
  targetFor, recentMonths, projectEndOfMonth, paceStatus, monthProgress,
  BASELINE_MONTHS, PACE_AHEAD,
} from "../../lib/targets";

// Accounts with less than this sold so far are left off the forecast: a
// run-rate projected from one small order says nothing.
const MIN_FORECAST_KGS = 500;

export default async function PredictiveAI({ searchParams }) {
  const params = await searchParams;
  const segment = normalizeSegment(params.segment);

  const settings = await getSettings(null, segment);
  const dealerTargets = settings.dealerTargets || {};

  let predictions = [];
  let loadError = null;

  try {
    const availableMonths = await getAvailableMonths();
    if (availableMonths.length > 0) {
      const latest = availableMonths[0];
      const calendar = monthProgress(latest);

      const currentPeriod = `${latest.year}-${String(latest.month).padStart(2, '0')}`;
      const dealers = await getDealerAggregates(currentPeriod, currentPeriod, [], segment);

      for (const d of dealers) {
        if (!d.monthlyHistory || d.kgsSold < MIN_FORECAST_KGS) continue;

        // The same baseline and target every other page uses.
        const recent3 = recentMonths(d, BASELINE_MONTHS, latest);
        if (recent3.length < BASELINE_MONTHS) continue; // Not enough history to forecast from

        const target = targetFor(d, dealerTargets, latest);
        const avg3Month = target.baselineKgs;
        const currentKgs = d.kgsSold || 0;
        const projectedKgs = projectEndOfMonth({
          kgsSoFar: currentKgs,
          baselineKgs: avg3Month,
          ...calendar,
        });
        const projectedProgressPct = target.kgs > 0 ? (projectedKgs / target.kgs) * 100 : 0;
        const status = paceStatus({ kgsSoFar: currentKgs, projectedKgs, targetKgs: target.kgs });

        let insight = (
          <ul className={styles.insightList}>
            <li>Projected to hit <strong>{Math.round(projectedProgressPct)}% of target</strong></li>
            <li>Run-rate aligns with historical avg</li>
          </ul>
        );
        
        if (status === "ACHIEVED") {
          insight = (
            <ul className={styles.insightList}>
              <li>Reached <strong>{Math.round((currentKgs / target.kgs) * 100)}% of target</strong></li>
              <li>Volume is strong and secure</li>
            </ul>
          );
        } else if (status === "DANGER") {
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
        } else if (status === "WARNING") {
          insight = (
            <ul className={styles.insightList}>
              <li>Pacing <strong>{Math.round(100 - projectedProgressPct)}% below target</strong></li>
              <li>Needs a push to hit {Math.round(target.kgs).toLocaleString()} kg</li>
            </ul>
          );
        } else if (projectedProgressPct > PACE_AHEAD * 100) {
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
          target: Math.round(target.kgs),
          avg3Month: Math.round(avg3Month),
          projectedProgressPct: Math.min(150, Math.round(projectedProgressPct)),
          status,
          insight
        });
      }

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
    loadError = error?.message || String(error);
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1>Predictive AI Forecast</h1>
        <p>Mathematical modeling of end-of-month volume based on historical run-rates</p>
      </header>

      {loadError && (
        <p style={{ color: 'var(--danger-color, #ef4444)', fontSize: '15px', lineHeight: '22px', marginBottom: '16px' }}>
          Could not load sales data, so there is no forecast. The query failed: {loadError}
        </p>
      )}
      {!loadError && predictions.length === 0 && (
        <p style={{ color: 'var(--muted, var(--text-secondary))', fontSize: '15px', lineHeight: '22px', marginBottom: '16px' }}>
          No account has enough history this month to forecast from.
        </p>
      )}

      <div className={styles.grid}>
        {predictions.map(dealer => (
          <ClientClickWrapper 
            key={dealer.id} 
            dealerId={dealer.id}
            className={styles.card} 
            style={{ 
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
                    background: dealer.status === 'DANGER' ? 'var(--red)' : dealer.status === 'WARNING' ? 'var(--orange)' : 'var(--green)'
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
