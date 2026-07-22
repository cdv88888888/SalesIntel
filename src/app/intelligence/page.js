import styles from "./intelligence.module.css";
export const dynamic = 'force-dynamic';

import { getDealerAggregates, getAvailableMonths, getTrendData, getAvailableDealers } from "../../lib/bigquery";
import CustomerMultiSelect from "./CustomerMultiSelect";
import Link from "next/link";
import DealerRow from "./DealerRow";
import { getSettings } from "../../lib/settings";
import { cookies } from "next/headers";

export default async function BusinessIntelligence({ searchParams }) {
  let dealers = [];
  let totalKgs = 0;
  let activeDealers = 0;
  let availableMonths = [];
  let yearlyTotals = [];
  
  const params = await searchParams;
  const segment = params.segment || 'dealer';

  let startPeriod = params.start || null;
  let endPeriod = params.end || null;
  
  // Parse customer parameter as array of strings
  let selectedCustomers = params.customer ? params.customer.split(',') : [];

  // Backwards compatibility for old URLs
  if (params.period && !startPeriod && !endPeriod) {
    startPeriod = params.period;
    endPeriod = params.period;
  } else if (params.year && params.month && !startPeriod && !endPeriod) {
    startPeriod = `${params.year}-${String(params.month).padStart(2, '0')}`;
    endPeriod = startPeriod;
  }
  let sortBy = params.sort || 'kgsSold';
  let sortOrder = params.order || 'desc';

  let availableDealers = [];
  const settings = await getSettings(null, segment);
  const dealerTargets = settings?.dealerTargets || {};

  try {
    const [monthsRes, dealersRes] = await Promise.all([
      getAvailableMonths(),
      getAvailableDealers(segment)
    ]);
    availableMonths = monthsRes;
    availableDealers = dealersRes;
    
    if (availableMonths.length > 0 && (!startPeriod || !endPeriod)) {
      const defaultYear = availableMonths[0].year;
      const defaultMonth = String(availableMonths[0].month).padStart(2, '0');
      startPeriod = `${defaultYear}-${defaultMonth}`;
      endPeriod = `${defaultYear}-${defaultMonth}`;
    }

    if (startPeriod && endPeriod) {
      const [aggregatesRes, trendRes] = await Promise.all([
        getDealerAggregates(startPeriod, endPeriod, selectedCustomers, segment),
        getTrendData(startPeriod, endPeriod, segment)
      ]);
      dealers = aggregatesRes;
      yearlyTotals = trendRes;
      activeDealers = dealers.length;
      totalKgs = dealers.reduce((sum, d) => sum + (d.kgsSold || 0), 0);

      // Background cache warming for other segments to prevent lag when toggling
      const otherSegments = ['dealer', 'commercial', 'bulk'].filter(s => s !== segment);
      if (startPeriod && endPeriod) {
        Promise.all(otherSegments.map(async (s) => {
          try {
            await Promise.all([
              getDealerAggregates(startPeriod, endPeriod, [], s),
              getTrendData(startPeriod, endPeriod, s),
              getAvailableDealers(s)
            ]);
          } catch (e) {
            // Ignore background warming errors
          }
        })).catch(() => {});
      }

      dealers.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        
        if (sortBy === 'target') {
          valA = dealerTargets[a.id] !== undefined ? dealerTargets[a.id] : (a.prevKgsSold ? a.prevKgsSold * 1.15 : 0);
          valB = dealerTargets[b.id] !== undefined ? dealerTargets[b.id] : (b.prevKgsSold ? b.prevKgsSold * 1.15 : 0);
        } else if (sortBy === 'name') {
          valA = a.name || "";
          valB = b.name || "";
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (sortBy === 'classification') {
          valA = a.classification || "";
          valB = b.classification || "";
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (sortBy === 'id') {
          valA = a.id || "";
          valB = b.id || "";
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        
        valA = valA || 0;
        valB = valB || 0;
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
  } catch (err) {
    console.error("Failed to load data from BigQuery:", err);
  }

  const getSortLink = (columnKey) => {
    const newOrder = sortBy === columnKey && sortOrder === 'desc' ? 'asc' : 'desc';
    const paramsObj = {};
    if (startPeriod && endPeriod) {
      paramsObj.start = startPeriod;
      paramsObj.end = endPeriod;
    }
    if (selectedCustomers.length > 0) paramsObj.customer = selectedCustomers.join(',');
    paramsObj.segment = segment;
    paramsObj.sort = columnKey;
    paramsObj.order = newOrder;
    
    const qs = new URLSearchParams(paramsObj).toString();
    return `?${qs}`;
  };

  const renderSortIndicator = (columnKey) => {
    if (sortBy !== columnKey) return null;
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className="gradient-text">Dealer Volume Analytics</h1>
            <p>Real-time Sales in KGs & Performance Tracking</p>
          </div>
          <form method="GET" className={styles.filterForm}>
            <input type="hidden" name="segment" value={segment} />
            {selectedCustomers.length > 0 && <input type="hidden" name="customer" value={selectedCustomers.join(',')} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Start:</label>
              <input 
                type="month"
                name="start"
                defaultValue={startPeriod || ""}
                style={{ background: 'var(--surface-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', fontSize: '1rem', colorScheme: 'dark' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ color: "var(--text-secondary)", fontWeight: 500 }}>End:</label>
              <input 
                type="month"
                name="end"
                defaultValue={endPeriod || ""}
                style={{ background: 'var(--surface-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', fontSize: '1rem', colorScheme: 'dark' }}
              />
            </div>
            <button type="submit" className={styles.button} style={{ marginTop: 0, padding: "8px 16px", width: "auto" }}>Apply</button>
            {selectedCustomers.length > 0 && (
              <Link href={`?start=${startPeriod}&end=${endPeriod}&segment=${segment}`} style={{ color: "var(--danger-color)", fontSize: "0.9rem", marginLeft: "12px" }}>
                Clear Filter
              </Link>
            )}
          </form>
        </div>
      </header>

      {/* KPI Section */}
      <div className={styles.dashboardGrid}>
        <div className={`${styles.kpiCard} glass-panel`}>
          <span className={styles.kpiLabel}>Total KGs Sold ({startPeriod === endPeriod ? startPeriod : `${startPeriod} to ${endPeriod}`})</span>
          <span className={styles.kpiValue}>{totalKgs.toLocaleString()} kg</span>
          <span className={`${styles.kpiTrend} ${styles.trendUp}`}>Live BigQuery Data</span>
        </div>
        <div className={`${styles.kpiCard} glass-panel`}>
          <span className={styles.kpiLabel}>Active Dealers</span>
          <span className={styles.kpiValue}>{activeDealers}</span>
          <span className={`${styles.kpiTrend} ${styles.trendUp}`}>Live BigQuery Data</span>
        </div>
        {/* Multi-Select Customer Filter */}
        <div className={`${styles.kpiCard} glass-panel`} style={{ overflow: 'visible', zIndex: 10 }}>
          <h3 className={styles.kpiTitle}>Customer Filter</h3>
          <div style={{ marginTop: '12px' }}>
            <CustomerMultiSelect 
              availableDealers={availableDealers} 
              selectedCustomers={selectedCustomers} 
            />
          </div>
        </div>
      </div>

      {/* MoM Trend Chart */}
      <section className={`${styles.tableContainer} glass-panel`} style={{ marginBottom: "24px", padding: "24px" }}>
        <h2 className={styles.chartTitle} style={{ marginBottom: "24px", fontSize: '1.1rem' }}>
          {(() => {
            if (!startPeriod || !endPeriod) return "Month on month Trend";
            const startY = startPeriod.split('-')[0];
            const endY = endPeriod.split('-')[0];
            return startY === endY ? `${startY} Month on month` : `${startY} to ${endY} Month on month`;
          })()}
        </h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '160px', gap: '12px', padding: '0 8px 8px 8px', borderBottom: '1px solid rgba(255,255,255,0.1)', overflowX: 'auto' }}>
          {(() => {
            if (!startPeriod || !endPeriod) return null;
            const startY = parseInt(startPeriod.split('-')[0]);
            const startM = parseInt(startPeriod.split('-')[1]);
            const endY = parseInt(endPeriod.split('-')[0]);
            const endM = parseInt(endPeriod.split('-')[1]);
            
            const allMonths = [];
            let currY = startY;
            let currM = 1;
            while (currY < endY || (currY === endY && currM <= 12)) {
              allMonths.push({ year: currY, month: currM });
              currM++;
              if (currM > 12) {
                currM = 1;
                currY++;
              }
            }

            const chartMax = yearlyTotals.length > 0 ? Math.max(...yearlyTotals.map(t => t.totalKgs)) : 0;
            const validTotals = yearlyTotals.map(t => t.totalKgs).filter(v => v > 0);
            const chartMin = validTotals.length > 0 ? Math.min(...validTotals) : 0;
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            
            return allMonths.map(({ year, month }) => {
              const dataPoint = yearlyTotals.find(t => t.year === year && t.month === month);
              const val = dataPoint ? dataPoint.totalKgs : 0;
              const heightPct = chartMax > 0 ? (val / chartMax) * 100 : 0;
              
              const isSelected = (year > startY || (year === startY && month >= startM)) && (year < endY || (year === endY && month <= endM));
              const isHighest = val === chartMax && chartMax > 0;
              const isLowest = val === chartMin && chartMin < chartMax && val > 0;
              
              let bgColor = 'rgba(255,255,255,0.08)';
              let glow = 'none';
              let borderColor = '1px solid transparent';
              
              if (isHighest) {
                bgColor = 'var(--success-color)';
                glow = '0 0 16px rgba(16, 185, 129, 0.4)';
              } else if (isLowest) {
                bgColor = 'var(--danger-color)';
                glow = '0 0 16px rgba(239, 68, 68, 0.4)';
              } else if (isSelected) {
                bgColor = 'var(--primary-accent)';
                glow = '0 0 16px rgba(99, 102, 241, 0.3)';
                borderColor = '1px solid rgba(255,255,255,0.2)';
              }
              
              const isFirstOfMonthOrYear = month === 1 || (year === startY && month === startM);
              
              return (
                <div key={`${year}-${month}`} style={{ flex: '1 0 50px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', height: '100%', minWidth: '50px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '32px', justifyContent: 'flex-end' }}>
                    {isHighest && <span style={{fontSize: '0.65rem', color: 'var(--success-color)', fontWeight: 'bold', lineHeight: 1, marginBottom: '2px'}}>MAX</span>}
                    {isLowest && <span style={{fontSize: '0.65rem', color: 'var(--danger-color)', fontWeight: 'bold', lineHeight: 1, marginBottom: '2px'}}>MIN</span>}
                    <span style={{ fontSize: '0.75rem', color: isSelected || isHighest || isLowest ? 'var(--text-primary)' : 'var(--text-secondary)', opacity: val > 0 ? 1 : 0, fontWeight: isSelected || isHighest || isLowest ? 600 : 400, transition: 'opacity 0.2s', lineHeight: 1 }}>
                      {(val / 1000).toFixed(1)}k
                    </span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    maxWidth: '48px', 
                    height: `${Math.max(heightPct, 2)}%`, 
                    background: bgColor, 
                    borderRadius: '6px 6px 0 0',
                    transition: 'all 0.3s ease',
                    boxShadow: glow,
                    border: borderColor,
                    borderBottom: 'none'
                  }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.85rem', color: isSelected || isHighest || isLowest ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isSelected || isHighest || isLowest ? 'bold' : 'normal', lineHeight: 1 }}>
                      {months[month-1]}
                    </span>
                    {isFirstOfMonthOrYear && <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1 }}>{year}</span>}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </section>

      {/* Dealer Data Table */}
      <section className={`${styles.tableContainer} glass-panel`}>
        <h2 className={styles.chartTitle} style={{ marginBottom: "16px" }}>Dealer Ledger (Live BigQuery Sync)</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ padding: 0 }}><Link href={getSortLink('name')} style={{ display: 'block', padding: '12px 16px', color: 'inherit', textDecoration: 'none' }}>Customer Name{renderSortIndicator('name')}</Link></th>
              <th style={{ padding: 0 }}><Link href={getSortLink('classification')} style={{ display: 'block', padding: '12px 16px', color: 'inherit', textDecoration: 'none' }}>Classification{renderSortIndicator('classification')}</Link></th>
              <th style={{ padding: 0 }}><Link href={getSortLink('kgsSold')} style={{ display: 'block', padding: '12px 16px', color: 'inherit', textDecoration: 'none' }}>Total KGS Sold (Selected){renderSortIndicator('kgsSold')}</Link></th>
              <th style={{ padding: 0 }}><Link href={getSortLink('prevKgsSold')} style={{ display: 'block', padding: '12px 16px', color: 'inherit', textDecoration: 'none' }}>Prev. Period KGs (YoY){renderSortIndicator('prevKgsSold')}</Link></th>
              <th style={{ padding: 0 }}><Link href={getSortLink('target')} style={{ display: 'block', padding: '12px 16px', color: 'inherit', textDecoration: 'none' }}>Assigned Target{renderSortIndicator('target')}</Link></th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {dealers.map((dealer) => {
              const target = dealerTargets[dealer.id] !== undefined ? dealerTargets[dealer.id] : (dealer.prevKgsSold ? dealer.prevKgsSold * 1.15 : 0);
              return (
                <DealerRow 
                  key={dealer.id}
                  dealer={dealer}
                  startPeriod={startPeriod}
                  endPeriod={endPeriod}
                  target={target}
                />
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
