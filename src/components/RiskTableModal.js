"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { getMonthlySalesByDealers } from '../app/actions';
import { useClientDrawer } from '../context/ClientDrawerContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function RiskTableModal({ title, dealers, segment = 'dealer' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const pdfRef = useRef(null);
  const [monthlyData, setMonthlyData] = useState({}); // { dealerId: { '2026-01': 100, '2026-02': 200 } }

  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const { openClient } = useClientDrawer();

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

  const handleRowClick = (dealerId) => {
    openClient(dealerId);
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
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
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
        `"${(dealer.name || '').replace(/"/g, '""')}"`
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
          background: 'var(--blue-tint)',
          border: 0,
          color: 'var(--blue)',
          padding: '0 14px',
          minHeight: '32px',
          borderRadius: '999px',
          fontSize: '13px',
          cursor: 'pointer',
          fontWeight: 600,
          marginTop: '-4px'
        }}
      >
        Open in Table
      </button>

      {isOpen && (
        <div 
          onClick={handleClose}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,.32)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div 
            ref={pdfRef}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              border: 0,
              borderRadius: '28px',
              padding: '24px',
              width: '90%',
              maxWidth: '1200px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0,0,0,.35)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-.02em' }}>{title} - Monthly Sales ({yearPrefix}) <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--muted)', letterSpacing: 0 }}>(Figures in KGs)</span></h2>
              <div className="pdf-hide" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button 
                  onClick={handleExportPDF}
                  style={{
                    background: 'var(--blue-tint)',
                    border: 0,
                    color: 'var(--blue)',
                    padding: '0 20px',
                    minHeight: '44px',
                    borderRadius: '999px',
                    fontSize: '15px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Export PDF
                </button>
                <button 
                  onClick={handleExportCSV}
                  style={{
                    background: 'var(--blue-tint)',
                    border: 0,
                    color: 'var(--blue)',
                    padding: '0 20px',
                    minHeight: '44px',
                    borderRadius: '999px',
                    fontSize: '15px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Export CSV
                </button>
                <button 
                  onClick={handleClose}
                  style={{
                    background: 'var(--trk)',
                    border: 0,
                    color: 'var(--text)',
                    fontSize: '20px',
                    lineHeight: 1,
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="table-container" style={{ overflow: 'auto', flexGrow: 1 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                  Loading monthly data...
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <th onClick={() => requestSort('name')} style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--surface)', color: 'var(--muted)', fontSize: '13px', fontWeight: 500, zIndex: 1, cursor: 'pointer', userSelect: 'none' }}>
                        Customer Name{renderSortIndicator('name')}
                      </th>
                      {title === 'Volume Decline' && (
                        <th onClick={() => requestSort('declineRate')} style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--surface)', color: 'var(--muted)', fontSize: '13px', fontWeight: 500, zIndex: 1, cursor: 'pointer', userSelect: 'none', color: 'var(--red)' }}>
                          Decline Rate{renderSortIndicator('declineRate')}
                        </th>
                      )}
                      {monthNames.map((m, i) => {
                        const monthNum = String(i + 1).padStart(2, '0');
                        return (
                          <th key={m} onClick={() => requestSort(monthNum)} style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--surface)', color: 'var(--muted)', fontSize: '13px', fontWeight: 500, zIndex: 1, cursor: 'pointer', userSelect: 'none' }}>
                            {m}{renderSortIndicator(monthNum)}
                          </th>
                        );
                      })}
                      <th onClick={() => requestSort('ytd')} style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--surface)', color: 'var(--muted)', fontSize: '13px', fontWeight: 500, zIndex: 1, cursor: 'pointer', userSelect: 'none' }}>
                        YTD Total{renderSortIndicator('ytd')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedDealers.map(dealer => {
                      return (
                        <tr 
                          key={dealer.id} 
                          style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                          onMouseOver={e => e.currentTarget.style.background = 'var(--trk)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                          onClick={() => handleRowClick(dealer.id)}
                        >
                          <td style={{ padding: '12px', fontWeight: '500', minWidth: '200px', maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {dealer.name}
                          </td>
                          {title === 'Volume Decline' && (
                            <td style={{ padding: '12px', color: 'var(--red)', fontWeight: '500', fontVariantNumeric: 'tabular-nums', minWidth: '100px' }}>
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
                               backgroundColor = intensity >= 0.75 ? 'var(--blue)' : 'var(--blue-tint)'; // Blue heat tiers
                            }

                            return (
                              <td key={m} style={{ padding: '12px', color: val > 0 ? (backgroundColor === 'var(--blue)' ? '#fff' : 'var(--text)') : 'var(--muted)', backgroundColor, fontVariantNumeric: 'tabular-nums' }}>
                                {val > 0 ? Math.round(val).toLocaleString() : '-'}
                              </td>
                            );
                          })}
                          <td style={{ padding: '12px', fontWeight: 600, color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round(dealer.ytdTotal).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {processedDealers.length === 0 && (
                      <tr>
                        <td colSpan={14} style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
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

    </>
  );
}
