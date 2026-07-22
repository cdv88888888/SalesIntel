import styles from "../proactive/page.module.css";
export const dynamic = 'force-dynamic';

import { getProactiveCallingData } from "../../lib/bigquery";
import { cookies } from "next/headers";
import ExpandableKanban from "../../components/ExpandableKanban";
import RiskTableModal from "../../components/RiskTableModal";
import RiskChart from "../../components/RiskChart";
import { getSettings } from "../../lib/settings";

export default async function RiskAndChurn({ searchParams }) {
  await cookies();
  const params = await searchParams;
  const segment = params?.segment || 'dealer';
  
  let riskColumns = {
    newAccounts: [],
    volumeDecline: [],
    noOrders: [],
    lost: []
  };

  let currentVolume = 0;
  let lastMonthVolume = 0;
  let target = 0;

  try {
    const rawData = await getProactiveCallingData(segment);
    const settings = await getSettings(null, segment);
    target = settings?.globalTarget || 0;
    
    let systemDate = new Date();
    if (rawData.length > 0) {
      const maxDateVal = Math.max(...rawData.map(d => new Date(d.last_order_date.value).getTime()));
      systemDate = new Date(maxDateVal);
    }
    
    systemDate.setHours(0,0,0,0);

    for (const dealer of rawData) {
      currentVolume += Math.round(dealer.current_month_vol || 0);
      lastMonthVolume += Math.round(dealer.prev_month_vol || 0);

      const lastOrder = new Date(dealer.last_order_date.value);
      lastOrder.setHours(0,0,0,0);
      
      const avgDays = dealer.avg_days_between_orders ? Math.round(dealer.avg_days_between_orders) : null;
      
      const daysSinceLastOrder = Math.round((systemDate.getTime() - lastOrder.getTime()) / (1000 * 3600 * 24));
      
      const cardData = {
        id: dealer.id,
        name: dealer.name,
        lastOrder: lastOrder.toLocaleDateString(),
        daysSinceLastOrder,
        avgDays: avgDays || 'N/A',
        currentMonthVol: Math.round(dealer.current_month_vol || 0),
        prevMonthVol: Math.round(dealer.prev_month_vol || 0),
        totalOrders: dealer.total_orders
      };

      if (dealer.true_first_order_date && dealer.true_first_order_date.value) {
        const firstOrder = new Date(dealer.true_first_order_date.value);
        firstOrder.setHours(0,0,0,0);
        const daysSinceFirstOrder = Math.round((systemDate.getTime() - firstOrder.getTime()) / (1000 * 3600 * 24));
        cardData.firstOrder = firstOrder.toLocaleDateString();
        cardData.daysSinceFirstOrder = daysSinceFirstOrder;
        
        if (daysSinceFirstOrder <= 60) {
          riskColumns.newAccounts.push(cardData);
          continue;
        }
      }

      if (!avgDays) continue;

      const isLost = daysSinceLastOrder > (4 * avgDays);

      if (isLost) {
        riskColumns.lost.push(cardData);
      } else {
        if (cardData.currentMonthVol === 0 && cardData.prevMonthVol > 0) {
          riskColumns.noOrders.push(cardData);
        } else if (cardData.currentMonthVol > 0 && cardData.prevMonthVol > 0 && cardData.currentMonthVol < cardData.prevMonthVol) {
          riskColumns.volumeDecline.push(cardData);
        }
      }
    }
    
    riskColumns.newAccounts.sort((a, b) => b.totalOrders - a.totalOrders);
    riskColumns.volumeDecline.sort((a, b) => (b.prevMonthVol - b.currentMonthVol) - (a.prevMonthVol - a.currentMonthVol));
    riskColumns.noOrders.sort((a, b) => b.prevMonthVol - a.prevMonthVol);
    riskColumns.lost.sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);

  } catch (error) {
    console.error("Failed to load Risk data:", error);
    riskColumns.volumeDecline = [{
      id: "MOCK-2", name: "TEST LPG (Mock)", lastOrder: "2026-06-01", expectedDate: "2026-06-10", daysUntilExpected: -2, daysSinceLastOrder: 12, avgDays: 10, pitchVolume: 1500, currentMonthVol: 500, prevMonthVol: 2000
    }];
  }

  const renderRiskCard = (dealer, type) => (
    <div key={dealer.id} className={styles.card} style={{ borderLeft: type === 'lost' ? '4px solid #ef4444' : (type === 'no_orders' ? '4px solid #f59e0b' : (type === 'new' ? '4px solid #10b981' : '4px solid #3b82f6')) }}>
      <div className={styles.dealerName}>{dealer.name}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {type === 'new' && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Opened:</span>
            <span className={styles.statValue}>{dealer.firstOrder}</span>
          </div>
        )}
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Last Order:</span>
          <span className={styles.statValue}>{dealer.lastOrder} ({dealer.daysSinceLastOrder} days ago)</span>
        </div>
        {type !== 'new' && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Frequency:</span>
            <span className={styles.statValue}>{dealer.avgDays !== 'N/A' ? `Every ${dealer.avgDays} days` : 'N/A'}</span>
          </div>
        )}
        
        {type === 'new' && (
          <div className={styles.pitchBox} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div className={styles.pitchLabel}>New Account</div>
            <div className={styles.pitchValue} style={{ color: '#34d399', fontSize: '0.9rem' }}>
              Acquired {dealer.daysSinceFirstOrder} days ago
            </div>
          </div>
        )}
        
        {type === 'decline' && (
          <div className={styles.pitchBox} style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div className={styles.pitchLabel}>Volume Drop</div>
            <div className={styles.pitchValue} style={{ color: '#60a5fa' }}>
              {dealer.prevMonthVol.toLocaleString()} KGs → {dealer.currentMonthVol.toLocaleString()} KGs
            </div>
          </div>
        )}
        
        {type === 'no_orders' && (
          <div className={styles.pitchBox} style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <div className={styles.pitchLabel}>Zero Orders This Month</div>
            <div className={styles.pitchValue} style={{ color: '#fbbf24', fontSize: '1rem' }}>
              Prev Month: {dealer.prevMonthVol.toLocaleString()} KGs
            </div>
          </div>
        )}

        {type === 'lost' && (
          <div className={styles.pitchBox} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div className={styles.pitchLabel}>Lost Account Risk</div>
            <div className={styles.pitchValue} style={{ color: '#f87171', fontSize: '0.9rem' }}>
              Inactive for {(dealer.daysSinceLastOrder / dealer.avgDays).toFixed(1)}x their normal frequency.
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className="gradient-text">Risk & Churn Analysis</h1>
        <p>Identify accounts that are dropping off or have completely stopped ordering.</p>
      </header>

      <RiskChart 
        currentVolume={currentVolume} 
        lastMonthVolume={lastMonthVolume} 
        target={target} 
      />

      <ExpandableKanban className={styles.kanbanBoard} isGrid={true}>
        <div className={`${styles.column}`}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitle} style={{ color: '#34d399' }}>New Accounts</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RiskTableModal title="New Accounts" dealers={riskColumns.newAccounts} segment={segment} />
              <div className={styles.countBadge}>{riskColumns.newAccounts.length}</div>
            </div>
          </div>
          <div className={styles.cardList}>
            {riskColumns.newAccounts.map(dealer => renderRiskCard(dealer, 'new'))}
            {riskColumns.newAccounts.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No new accounts</div>}
          </div>
        </div>

        <div className={`${styles.column}`}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitle} style={{ color: '#60a5fa' }}>Volume Decline</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RiskTableModal title="Volume Decline" dealers={riskColumns.volumeDecline} segment={segment} />
              <div className={styles.countBadge}>{riskColumns.volumeDecline.length}</div>
            </div>
          </div>
          <div className={styles.cardList}>
            {riskColumns.volumeDecline.map(dealer => renderRiskCard(dealer, 'decline'))}
            {riskColumns.volumeDecline.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No volume declines</div>}
          </div>
        </div>

        <div className={`${styles.column}`}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitle} style={{ color: '#fbbf24' }}>No Orders This Month</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RiskTableModal title="No Orders This Month" dealers={riskColumns.noOrders} segment={segment} />
              <div className={styles.countBadge}>{riskColumns.noOrders.length}</div>
            </div>
          </div>
          <div className={styles.cardList}>
            {riskColumns.noOrders.map(dealer => renderRiskCard(dealer, 'no_orders'))}
            {riskColumns.noOrders.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No accounts missing</div>}
          </div>
        </div>

        <div className={`${styles.column}`}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitle} style={{ color: '#f87171' }}>Lost Accounts</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RiskTableModal title="Lost Accounts" dealers={riskColumns.lost} segment={segment} />
              <div className={styles.countBadge}>{riskColumns.lost.length}</div>
            </div>
          </div>
          <div className={styles.cardList}>
            {riskColumns.lost.map(dealer => renderRiskCard(dealer, 'lost'))}
            {riskColumns.lost.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No lost accounts</div>}
          </div>
        </div>
      </ExpandableKanban>
    </div>
  );
}
