"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { getMonthlySalesByDealers, getSingleDealerIntelligence } from '../app/actions';
import ViewDealerModal from '../app/intelligence/ViewDealerModal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function RiskTableModal({ title, dealers, segment = 'dealer' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const pdfRef = useRef(null);
  const [monthlyData, setMonthlyData] = useState({}); // { dealerId: { '2026-01': 100, '2026-02': 200 } }

  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const [selectedDealerIntell, setSelectedDealerIntell] = useState(null);
  const [isIntelligenceLoading, setIsIntelligenceLoading] = useState(false);
  const [isIntelligenceModalOpen, setIsIntelligenceModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  const handleRowClick = async (dealerId) => {
    setIsIntelligenceLoading(true);
    try {
      const fullDealerData = await getSingleDealerIntelligence(dealerId, segment);
      if (fullDealerData) {
        setSelectedDealerIntell(fullDealerData);
        setIsIntelligenceModalOpen(true);
      } else {
        alert("Could not load intelligence for this dealer.");
      }
    } catch (e) {
      console.error(e);
      alert("Error loading intelligence data.");
    } finally {
      setIsIntelligenceLoading(false);
    }
  };

  const handleOpen = async (e) => {
    e.stopPropagation();
    setIsOpen(true);
    if (dealers.length > 0 && Object.keys(monthlyData).length === 0) {
      setLoading(true);
      try {
        const dealerIds = dealers.map(d => d.id);
        const data = await getMonthlySalesByDealers(dealerIds);
        
        // Transform array into nested object
        const mapped = {};
        data.forEach(row => {
          if (!mapped[row.id]) mapped[row.id] = {};
          mapped[row.id][row.month] = row.volume;
        });
        setMonthlyData(mapped);
      } catch (err) {
        console.error("Failed to fetch monthly data", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Get current year from data, or fallback to 2026
  let yearPrefix = '2026';
  if (Object.keys(monthlyData).length > 0) {
     const firstDealerId = Object.keys(monthlyData)[0];
     const firstMonthStr = Object.keys(monthlyData[firstDealerId])[0];
     if (firstMonthStr) {
       yearPrefix = firstMonthStr.split('-')[0];
     }
  }

  // Calculate row stats and sort
  const processedDealers = useMemo(() => {
    if (dealers.length === 0) return [];
    
    const withStats = dealers.map(dealer => {
      const dealerData = monthlyData[dealer.id] || {};
      let ytdTotal = 0;
      let maxVolume = 0;
      const monthValues = {};

      monthNames.forEach((_, i) => {
        const monthNum = String(i + 1).padStart(2, '0');
        const key = `${yearPrefix}-${monthNum}`;
        const val = dealerData[key] || 0;
        monthValues[monthNum] = val;
        ytdTotal += val;
        if (val > maxVolume) maxVolume = val;
      });

      return {
        ...dealer,
        monthValues,
        ytdTotal,
        maxVolume,
        declineRate: (dealer.prevMonthVol && dealer.prevMonthVol > 0) 
          ? ((dealer.prevMonthVol - dealer.currentMonthVol) / dealer.prevMonthVol) * 100 
          : 0
      };
    });

    if (sortConfig.key) {
      withStats.sort((a, b) => {
        let aVal, bVal;
        if (sortConfig.key === 'name') {
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
        } else if (sortConfig.key === 'ytd') {
          aVal = a.ytdTotal;
          bVal = b.ytdTotal;
        } else if (sortConfig.key === 'declineRate') {
          aVal = a.declineRate || 0;
          bVal = b.declineRate || 0;
        } else {
          // Sort by month
          aVal = a.monthValues[sortConfig.key];
          bVal = b.monthValues[sortConfig.key];
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return withStats;
  }, [dealers, monthlyData, sortConfig, yearPrefix, monthNames]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const handleExportCSV = () => {
    if (!processedDealers || processedDealers.length === 0) return;

    const headers = ['Customer Name'];
    if (title === 'Volume Decline') {
      headers.push('Decline Rate (%)');
    }
    headers.push(...monthNames, 'YTD Total');
    
    const rows = processedDealers.map(dealer => {
      const row = [
        `"${dealer.name.replace(/"/g, '""')}"`
      ];
      if (title === 'Volume Decline') {
        row.push(dealer.declineRate ? `-${dealer.declineRate.toFixed(1)}%` : '0%');
      }
      row.push(
        ...monthNames.map((_, i) => {
          const monthNum = String(i + 1).padStart(2, '0');
          return Math.round(dealer.monthValues[monthNum] || 0);
        }),
        Math.round(dealer.ytdTotal)
      );
      return row.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title.replace(/\s+/g, '_')}_Sales_${yearPrefix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    if (!pdfRef.current) return;
    
    // Temporarily hide the close and export buttons for the PDF
    const buttonsToHide = pdfRef.current.querySelectorAll('.pdf-hide');
    buttonsToHide.forEach(btn => btn.style.display = 'none');
    
    // Temporarily adjust styles to capture full content without scrollbars
    const originalMaxHeight = pdfRef.current.style.maxHeight;
    const tableContainer = pdfRef.current.querySelector('.table-container');
    const originalOverflow = tableContainer ? tableContainer.style.overflow : '';
    
    pdfRef.current.style.maxHeight = 'none';
    if (tableContainer) tableContainer.style.overflow = 'visible';

    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2, // High resolution
        backgroundColor: '#1a1f2e',
        useCORS: true,
        logging: false,
        windowWidth: pdfRef.current.scrollWidth,
        windowHeight: pdfRef.current.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Calculate dimensions in mm (1 px = 0.264583 mm)
      const pdfWidth = canvas.width * 0.264583;
      const pdfHeight = canvas.height * 0.264583;

      // Create PDF with custom dimensions to fit exactly
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'l' : 'p',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${title.replace(/\s+/g, '_')}_Sales_${yearPrefix}.pdf`);
    } catch (error) {
      console.error("Error generating PDF", error);
    } finally {
      // Restore styles
      buttonsToHide.forEach(btn => btn.style.display = 'flex');
      pdfRef.current.style.maxHeight = originalMaxHeight;
      if (tableContainer) tableContainer.style.overflow = originalOverflow;
    }
  };

  return (
    <>
      <button 
        onClick={handleOpen}
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '0.75rem',
          cursor: 'pointer',
          fontWeight: 600,
          transition: 'background 0.2s',
          marginTop: '-4px'
        }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
        onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
      >
        Open in Table
      </button>

      {isOpen && (
        <div 
          onClick={handleClose}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div 
            ref={pdfRef}
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1a1f2e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '1200px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{title} - Monthly Sales ({yearPrefix}) <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>(Figures in KGs)</span></h2>
              <div className="pdf-hide" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <button 
                  onClick={handleExportPDF}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                  Export PDF
                </button>
                <button 
                  onClick={handleExportCSV}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                  Export CSV
                </button>
                <button 
                  onClick={handleClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    fontSize: '1.5rem',
                    cursor: 'pointer'
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="table-container" style={{ overflow: 'auto', flexGrow: 1 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  Loading monthly data...
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th onClick={() => requestSort('name')} style={{ padding: '12px', position: 'sticky', top: 0, background: '#1a1f2e', zIndex: 1, cursor: 'pointer', userSelect: 'none' }}>
                        Customer Name{renderSortIndicator('name')}
                      </th>
                      {title === 'Volume Decline' && (
                        <th onClick={() => requestSort('declineRate')} style={{ padding: '12px', position: 'sticky', top: 0, background: '#1a1f2e', zIndex: 1, cursor: 'pointer', userSelect: 'none', color: '#ef4444' }}>
                          Decline Rate{renderSortIndicator('declineRate')}
                        </th>
                      )}
                      {monthNames.map((m, i) => {
                        const monthNum = String(i + 1).padStart(2, '0');
                        return (
                          <th key={m} onClick={() => requestSort(monthNum)} style={{ padding: '12px', position: 'sticky', top: 0, background: '#1a1f2e', zIndex: 1, cursor: 'pointer', userSelect: 'none' }}>
                            {m}{renderSortIndicator(monthNum)}
                          </th>
                        );
                      })}
                      <th onClick={() => requestSort('ytd')} style={{ padding: '12px', position: 'sticky', top: 0, background: '#1a1f2e', zIndex: 1, cursor: 'pointer', userSelect: 'none' }}>
                        YTD Total{renderSortIndicator('ytd')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedDealers.map(dealer => {
                      return (
                        <tr 
                          key={dealer.id} 
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s' }}
                          onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                          onClick={() => handleRowClick(dealer.id)}
                        >
                          <td style={{ padding: '12px', fontWeight: '500', minWidth: '200px', maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {dealer.name}
                          </td>
                          {title === 'Volume Decline' && (
                            <td style={{ padding: '12px', color: '#ef4444', fontWeight: '500', minWidth: '100px' }}>
                              {dealer.declineRate ? `-${dealer.declineRate.toFixed(1)}%` : '-'}
                            </td>
                          )}
                          {monthNames.map((m, i) => {
                            const monthNum = String(i + 1).padStart(2, '0');
                            const val = dealer.monthValues[monthNum];
                            
                            // Heatmap styling logic per account
                            let backgroundColor = 'transparent';
                            if (val > 0 && dealer.maxVolume > 0) {
                               const intensity = Math.max(0.15, val / dealer.maxVolume);
                               backgroundColor = `rgba(59, 130, 246, ${intensity})`; // Blue tint
                            }

                            return (
                              <td key={m} style={{ padding: '12px', color: val > 0 ? '#fff' : 'rgba(255,255,255,0.3)', backgroundColor }}>
                                {val > 0 ? Math.round(val).toLocaleString() : '-'}
                              </td>
                            );
                          })}
                          <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--primary-accent)' }}>
                            {Math.round(dealer.ytdTotal).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {processedDealers.length === 0 && (
                      <tr>
                        <td colSpan={14} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No accounts found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {isIntelligenceLoading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 10000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{ background: 'var(--surface-dark)', padding: '20px 40px', borderRadius: '8px', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            Loading Intelligence Data...
          </div>
        </div>
      )}

      {isIntelligenceModalOpen && selectedDealerIntell && (
        <ViewDealerModal 
          dealer={selectedDealerIntell} 
          isOpen={isIntelligenceModalOpen} 
          onClose={() => setIsIntelligenceModalOpen(false)}
          hideTrigger={true}
        />
      )}
    </>
  );
}
