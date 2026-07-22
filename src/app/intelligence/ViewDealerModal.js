"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./intelligence.module.css";

// Helper to format numbers cleanly (e.g. 98,691 -> 98.7k)
const formatKgs = (num) => {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return Math.round(num).toString();
};

const formatMonthYear = (year, month) => {
  if (!year || !month) return "";
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[month - 1]} '${year.toString().slice(-2)}`;
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

export default function ViewDealerModal({ dealer, customTrigger, isOpen: controlledIsOpen, onClose: controlledOnClose, hideTrigger, startPeriod, endPeriod, target: propTarget }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [timeframe, setTimeframe] = useState(6);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(false);
  const chartRef = useRef(null);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  useEffect(() => {
    if (chartRef.current) {
      // Small timeout to ensure layout is complete before scrolling
      setTimeout(() => {
        if (chartRef.current) {
          chartRef.current.scrollLeft = chartRef.current.scrollWidth;
        }
      }, 50);
    }
  }, [timeframe, isOpen]);

  useEffect(() => {
    if (isOpen && dealer?.id) {
      setLoading(true);
      fetch(`/api/monday-updates?dealerId=${dealer.id}&dealerName=${encodeURIComponent(dealer.name || '')}`)
        .then(res => res.json())
        .then(data => {
          setUpdates(data.updates || []);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to load monday updates:", err);
          setLoading(false);
        });
    } else {
      setUpdates([]);
    }
  }, [isOpen, dealer?.id, dealer?.name]);

  const openModal = () => setInternalIsOpen(true);
  const closeModal = () => {
    setInternalIsOpen(false);
    if (controlledOnClose) controlledOnClose();
  };

  const closeModalRef = useRef(closeModal);
  useEffect(() => {
    closeModalRef.current = closeModal;
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        closeModalRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  const target = propTarget !== undefined ? propTarget : (dealer?.prevKgsSold ? dealer.prevKgsSold * 1.15 : 0);
  const current = dealer?.kgsSold || 0;
  const prev = dealer?.prevKgsSold || 0;
  const isBelowTarget = current < target;
  const percentOfTarget = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  
  // Trend calculation
  const diffFromPrev = current - prev;
  const trendPercent = prev > 0 ? Math.round((diffFromPrev / prev) * 100) : 0;
  const isUp = diffFromPrev >= 0;

  let historyData = [];
  try {
    if (dealer?.monthlyHistory) {
      historyData = JSON.parse(dealer.monthlyHistory);
      // Data is ordered DESC by date from BQ, reverse it to ASC (oldest first) for charting
      historyData.reverse();
    }
  } catch (e) {
    console.error("Failed to parse history data", e);
  }

  const baseYear = endPeriod ? parseInt(endPeriod.split('-')[0]) : (historyData.length > 0 ? historyData[historyData.length - 1].year : new Date().getFullYear());
  const baseMonth = endPeriod ? parseInt(endPeriod.split('-')[1]) : (historyData.length > 0 ? historyData[historyData.length - 1].month : new Date().getMonth() + 1);

  const chartData = [];
  for (let i = timeframe - 1; i >= 0; i--) {
    let m = baseMonth - i;
    let y = baseYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    
    const existingData = historyData.find(d => d.year === y && d.month === m);
    if (existingData) {
      chartData.push(existingData);
    } else {
      chartData.push({ year: y, month: m, monthlyKgs: 0 });
    }
  }

  const getAIRecommendation = () => {
    if (!dealer) return "Loading insights...";

    if (isBelowTarget) {
      return (
        <span style={{ color: 'var(--danger-color)', fontWeight: 500 }}>
          At Risk ({percentOfTarget}% of target) - Volume trending downwards
        </span>
      );
    } else {
      return (
        <span style={{ color: 'var(--success-color)', fontWeight: 500 }}>
          Healthy ({percentOfTarget}% of target) - Consistently meeting targets
        </span>
      );
    }
  };

  return (
    <>
      {!hideTrigger && (
        customTrigger ? (
          <div onClick={openModal} style={{ display: 'inline-block', width: '100%' }}>
            {customTrigger}
          </div>
        ) : (
          <button 
            onClick={openModal} 
            className={styles.iconButton}
            title="View Intelligence"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )
      )}

      {isOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={`${styles.modalContent} glass-panel`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle} style={{ marginBottom: '4px' }}>{dealer?.name || "Dealer"} - Intelligence</h3>
                <span style={{ fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "0.9rem" }}>Dealer Code: {dealer?.id || "N/A"}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', background: 'rgba(99, 102, 241, 0.05)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--primary-accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                    </svg>
                    Gemini Intelligence
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    {getAIRecommendation()}
                  </div>
                </div>
                <button className={styles.closeButton} onClick={closeModal}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.splitLayout}>
                {/* Left side: Performance Overview */}
                <div className={styles.leftPane}>
                  <div className={styles.historySection} style={{ border: 'none', padding: 0, marginTop: 0 }}>
                    <h4>Performance Overview</h4>
                    
                    {/* Responsive Layout for Overview */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginBottom: '24px', marginTop: '16px' }}>
                      
                      {/* Activity Rings for Multi-Metric Performance */}
                      <div style={{ flex: '1 1 380px', display: 'flex', alignItems: 'center', gap: '24px', background: 'rgba(255, 255, 255, 0.02)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ width: '160px', height: '160px', flexShrink: 0, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}>
                          <svg width="100%" height="100%" viewBox="0 0 100 100">
                            {/* Target - Red/Pink (#FA114F) */}
                            <ActivityRing radius={40} stroke={9} progress={percentOfTarget} color="#FA114F" bg="rgba(250, 17, 79, 0.35)" />
                            {/* Growth - Green/Lime (#A6FE00) */}
                            <ActivityRing radius={29} stroke={9} progress={prev > 0 ? Math.round((current / prev) * 100) : 0} color="#A6FE00" bg="rgba(166, 254, 0, 0.3)" />
                            {/* Consistency - Cyan (#00E5FF) */}
                            <ActivityRing radius={18} stroke={9} progress={dealer?.avgMonthKgs > 0 ? Math.round((current / dealer.avgMonthKgs) * 100) : 0} color="#00E5FF" bg="rgba(0, 229, 255, 0.3)" />
                          </svg>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flexGrow: 1, minWidth: '180px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FA114F', boxShadow: '0 0 8px rgba(250,17,79,0.5)', flexShrink: 0 }}></div>
                              <span style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Target <span style={{fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 'bold'}}>({formatKgs(target)} kg)</span></span>
                            </div>
                            <span style={{ fontWeight: 'bold', color: '#FA114F', fontSize: '1.1rem' }}>{percentOfTarget}%</span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#A6FE00', boxShadow: '0 0 8px rgba(166,254,0,0.5)', flexShrink: 0 }}></div>
                              <span style={{ fontSize: '1.05rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Prev Period (YoY) <span style={{fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 'bold'}}>({formatKgs(prev)} kg)</span></span>
                            </div>
                            <span style={{ fontWeight: 'bold', color: '#A6FE00', fontSize: '1.1rem' }}>{prev > 0 ? Math.round((current / prev) * 100) : 0}%</span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00E5FF', boxShadow: '0 0 8px rgba(0,229,255,0.5)', flexShrink: 0 }}></div>
                              <span style={{ fontSize: '1.05rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Historical Average <span style={{fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 'bold'}}>({formatKgs(dealer?.avgMonthKgs)} kg)</span></span>
                            </div>
                            <span style={{ fontWeight: 'bold', color: '#00E5FF', fontSize: '1.1rem' }}>{dealer?.avgMonthKgs > 0 ? Math.round((current / dealer.avgMonthKgs) * 100) : 0}%</span>
                          </div>
                        </div>
                      </div>

                      {/* History Stats Grid */}
                      <div style={{ flex: '2 1 450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className={styles.historyStats} style={{ marginTop: 0 }}>
                          <div className={styles.historyStatBox}>
                            <span className={styles.historyStatLabel}>Selected Period</span>
                            <div className={styles.statValueGroup}>
                              <span className={styles.historyStatValue}>{formatKgs(dealer?.kgsSold)} kg</span>
                              <span className={`${styles.trendIndicator} ${isUp ? styles.trendUp : styles.trendDown}`}>
                                {isUp ? '↑' : '↓'} {Math.abs(trendPercent)}%
                              </span>
                            </div>
                          </div>
                          <div className={styles.historyStatBox}>
                            <span className={styles.historyStatLabel}>Previous Period (YoY)</span>
                            <span className={styles.historyStatValue}>{formatKgs(dealer?.prevKgsSold)} kg</span>
                          </div>
                          <div className={styles.historyStatBox}>
                            <span className={styles.historyStatLabel}>Classification</span>
                            <span className={styles.historyStatValue} style={{ fontSize: '1.25rem' }}>{dealer?.classification || "Standard"}</span>
                          </div>
                        </div>

                        <div className={styles.historyStats} style={{ marginTop: 0 }}>
                          <div className={styles.historyStatBox}>
                            <span className={styles.historyStatLabel}>
                              Lowest Month {dealer?.lowestYear && <span style={{fontSize: "0.85em", color: "var(--text-secondary)", marginLeft: "4px"}}>{formatMonthYear(dealer.lowestYear, dealer.lowestMonth)}</span>}
                            </span>
                            <span className={styles.historyStatValue}>{formatKgs(dealer?.lowestMonthKgs)} kg</span>
                          </div>
                          <div className={styles.historyStatBox}>
                            <span className={styles.historyStatLabel}>Average Month</span>
                            <span className={styles.historyStatValue}>{formatKgs(dealer?.avgMonthKgs)} kg</span>
                          </div>
                          <div className={styles.historyStatBox}>
                            <span className={styles.historyStatLabel}>
                              Highest Month {dealer?.highestYear && <span style={{fontSize: "0.85em", color: "var(--text-secondary)", marginLeft: "4px"}}>{formatMonthYear(dealer.highestYear, dealer.highestMonth)}</span>}
                            </span>
                            <span className={styles.historyStatValue}>{formatKgs(dealer?.highestMonthKgs)} kg</span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {historyData.length > 0 && (
                      <div className={styles.historyChartSection}>
                        <div className={styles.timeframeHeader}>
                          <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Volume Trend</h5>
                          <div className={styles.timeframeToggles}>
                            {[6, 12, 24, 36].map(t => (
                              <button 
                                key={t}
                                className={`${styles.timeframeButton} ${timeframe === t ? styles.timeframeButtonActive : ''}`}
                                onClick={() => setTimeframe(t)}
                              >
                                {t === 6 ? '6m' : t === 12 ? '1y' : t === 24 ? '2y' : '3y'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className={styles.miniChart} ref={chartRef}>
                          {(() => {
                            const chartMax = chartData.length > 0 ? Math.max(...chartData.map(h => h.monthlyKgs)) : 0;
                            const chartMin = chartData.length > 0 ? Math.min(...chartData.map(h => h.monthlyKgs)) : 0;
                            return chartData.map((d, i) => {
                              const heightPct = chartMax > 0 ? (d.monthlyKgs / chartMax) * 100 : 0;
                              const isHighest = d.monthlyKgs === chartMax && chartMax > 0;
                              const isLowest = d.monthlyKgs === chartMin && chartMin < chartMax;

                              let barStyle = { height: `${heightPct}%` };
                              if (isHighest) {
                                barStyle.background = 'var(--success-color)';
                                barStyle.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
                                barStyle.opacity = 1;
                              } else if (isLowest) {
                                barStyle.background = 'var(--danger-color)';
                                barStyle.opacity = 0.9;
                              }

                              return (
                                <div key={i} className={styles.miniChartCol}>
                                  {isHighest && <span style={{fontSize: '0.65rem', color: 'var(--success-color)', fontWeight: 'bold', marginBottom: '2px'}}>MAX</span>}
                                  {isLowest && <span style={{fontSize: '0.65rem', color: 'var(--danger-color)', fontWeight: 'bold', marginBottom: '2px'}}>MIN</span>}
                                  <div 
                                    className={`${styles.miniChartBar} ${styles.chartBarHasTooltip}`} 
                                    style={barStyle}
                                  >
                                    <div className={styles.customTooltip}>
                                      {`${d.month}/${d.year.toString().slice(2)}: ${formatKgs(d.monthlyKgs)} kg`}
                                    </div>
                                  </div>
                                  <span className={styles.miniChartLabel}>{chartData.length <= 12 || i % 2 === 0 ? `${d.month}/${d.year.toString().slice(2)}` : '\u00A0'}</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}

                    {historyData.length > 0 && (
                      <div className={styles.tableContainer} style={{ marginTop: '24px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px' }}>
                        <h5 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Year-over-Year Volume Matrix</h5>
                        <div style={{ overflowX: 'auto' }}>
                          <table className={styles.table}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                              <tr>
                                <th style={{ background: 'rgba(15, 23, 42, 1)' }}>Month</th>
                                {[...new Set(chartData.map(d => d.year))].sort((a, b) => a - b).map(y => (
                                  <th key={y} style={{ background: 'rgba(15, 23, 42, 1)', textAlign: 'right' }}>{y}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const tableMax = chartData.length > 0 ? Math.max(...chartData.map(h => h.monthlyKgs)) : 0;
                                const tableMin = chartData.length > 0 ? Math.min(...chartData.map(h => h.monthlyKgs)) : 0;

                                return [
                                  { val: 1, name: "January" }, { val: 2, name: "February" },
                                  { val: 3, name: "March" }, { val: 4, name: "April" },
                                  { val: 5, name: "May" }, { val: 6, name: "June" },
                                  { val: 7, name: "July" }, { val: 8, name: "August" },
                                  { val: 9, name: "September" }, { val: 10, name: "October" },
                                  { val: 11, name: "November" }, { val: 12, name: "December" }
                                ].map(m => {
                                  const availableYears = [...new Set(chartData.map(d => d.year))].sort((a, b) => a - b);

                                  return (
                                    <tr key={m.val}>
                                      <td style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{m.name}</td>
                                      {availableYears.map(y => {
                                        const dataPoint = chartData.find(d => d.year === y && d.month === m.val);
                                        
                                        let isHighest = false;
                                        let isLowest = false;
                                        
                                        if (dataPoint) {
                                          isHighest = dataPoint.monthlyKgs === tableMax && tableMax > 0;
                                          isLowest = dataPoint.monthlyKgs === tableMin && tableMin < tableMax;
                                        }

                                        let cellColor = dataPoint?.monthlyKgs ? 'var(--text-primary)' : 'rgba(255, 255, 255, 0.2)';
                                        if (isHighest) cellColor = 'var(--success-color)';
                                        if (isLowest) cellColor = 'var(--danger-color)';

                                        return (
                                          <td key={y} style={{ textAlign: 'right', color: cellColor, fontWeight: isHighest || isLowest ? 'bold' : 'normal' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                              {isLowest && <span style={{fontSize: '0.65rem', padding: '2px 4px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', lineHeight: 1}}>MIN</span>}
                                              <span>{dataPoint?.monthlyKgs ? dataPoint.monthlyKgs.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '-'}</span>
                                              {isHighest && <span style={{fontSize: '0.65rem', padding: '2px 4px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', lineHeight: 1}}>MAX</span>}
                                            </div>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Monday.com Updates */}
                <div className={styles.rightPane}>
                  <div className={styles.updatesFeed}>
                    <div className={styles.feedHeader}>
                      <h4>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        Monday.com Updates
                      </h4>
                      {updates.length > 0 && (
                        <span className={styles.feedBadge}>{updates.length}</span>
                      )}
                    </div>

                    {/* Composer Box Placeholder */}
                    <div className={styles.composerPlaceholder}>
                      <textarea 
                        className={styles.composerInput} 
                        placeholder="Write an update and mention others with @" 
                        rows={1}
                        readOnly
                      />
                      <div className={styles.composerToolbar}>
                        <div className={styles.composerTools}>
                          <span className={styles.composerToolIcon} title="Add files">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                          </span>
                          <span className={styles.composerToolIcon} title="Mention someone">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
                          </span>
                        </div>
                      </div>
                    </div>

                    {loading ? (
                      <div className={styles.loadingContainer}>
                        <div className={styles.loadingSpinner}></div>
                        <span>Loading updates...</span>
                      </div>
                    ) : updates.length === 0 ? (
                      <div className={styles.emptyState}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <strong>No updates yet</strong>
                        <span style={{ fontSize: '0.85rem' }}>Updates for this account will appear here once posted on Monday.com.</span>
                      </div>
                    ) : (
                      updates.map((update) => (
                        <div key={update.id} className={styles.updateCard}>
                          <div className={styles.updateAuthorRow}>
                            <div 
                              className={styles.avatarCircle} 
                              style={{ 
                                backgroundColor: update.author.avatarColor,
                                backgroundImage: update.author.photo ? `url(${update.author.photo})` : 'none'
                              }}
                            >
                              {!update.author.photo && update.author.initials}
                            </div>
                            <div className={styles.authorMeta}>
                              <span className={styles.authorName}>{update.author.name}</span>
                              <span className={styles.updateTime}>{update.relativeTime}</span>
                            </div>
                          </div>
                          
                          {/* HTML body rendered dangerously because Monday.com returns updates in HTML */}
                          <div 
                            className={styles.updateContent} 
                            dangerouslySetInnerHTML={{ __html: update.body }}
                          />

                          {update.attachments && update.attachments.length > 0 && (
                            <div className={styles.attachmentsList}>
                              {update.attachments.map((file, idx) => (
                                <a 
                                  key={idx} 
                                  href={file.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className={styles.attachmentItem}
                                  title="Click to download attachment"
                                >
                                  {file.type === 'image' ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                                  )}
                                  <span className={styles.attachmentName}>{file.name}</span>
                                  {file.size && <span className={styles.attachmentSize}>{file.size}</span>}
                                </a>
                              ))}
                            </div>
                          )}

                          <div className={styles.cardInteractions}>
                            <div className={styles.interactionButtons}>
                              <button className={styles.interactionBtn}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                                Like
                              </button>
                              <button className={styles.interactionBtn}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                Reply
                              </button>
                            </div>
                            {update.viewsCount !== undefined && (
                              <span>👁️ {update.viewsCount}</span>
                            )}
                          </div>

                          <div className={styles.replyComposerPlaceholder}>
                            Write a reply...
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
