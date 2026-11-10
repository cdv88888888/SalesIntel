"use client";

import React, { useState } from 'react';
import ExpandableKanban from '../../components/ExpandableKanban';
import styles from './page.module.css';
import { useClientDrawer } from '../../context/ClientDrawerContext';

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '-';
const fmtDays = (n) => `${n % 1 ? n : Math.round(n)} days`;

export default function ProactiveBoard({ initialColumns, loadError }) {
  const [columns, setColumns] = useState(initialColumns);
  const [dragOverCol, setDragOverCol] = useState(null);
  const { openClient } = useClientDrawer();

  const handleDragStart = (e, card, sourceColumn) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/json", JSON.stringify({ cardId: card.id, sourceColumn }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e, colKey) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCol(colKey);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCol(null);
  };

  const handleDrop = (e, targetColumn = 'confirmed') => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCol(null);
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const { cardId, sourceColumn } = JSON.parse(dataStr);

      if (!sourceColumn || sourceColumn === targetColumn) return;

      // Only allow dragging from 'today' to 'confirmed'
      if (sourceColumn === 'today' && targetColumn === 'confirmed') {
        const sourceCards = columns[sourceColumn];
        const card = sourceCards.find(c => c.id === cardId);
        if (!card) return;

        // Default delivery date to local date (YYYY-MM-DD)
        const localDate = new Date();
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const updatedCard = { ...card, deliveryDate: todayStr };

        setColumns(prev => ({
          ...prev,
          [sourceColumn]: prev[sourceColumn].filter(c => c.id !== cardId),
          confirmed: [...prev.confirmed, updatedCard]
        }));
      }
      // Dragging from 'confirmed' back to 'today'
      else if (sourceColumn === 'confirmed' && targetColumn === 'today') {
        const sourceCards = columns.confirmed;
        const card = sourceCards.find(c => c.id === cardId);
        if (!card) return;

        // Delete/clear deliveryDate from card object
        const { deliveryDate, ...cleanedCard } = card;

        setColumns(prev => {
          // Restore the biggest-first order
          const targetList = [...(prev[targetColumn] || []), cleanedCard];
          targetList.sort((a, b) => b.avgKg - a.avgKg);

          return {
            ...prev,
            confirmed: prev.confirmed.filter(c => c.id !== cardId),
            [targetColumn]: targetList
          };
        });
      }
    } catch (err) {
      console.error("Drop operation failed:", err);
    }
  };

  const handleDateChange = (cardId, newDate) => {
    setColumns(prev => ({
      ...prev,
      confirmed: prev.confirmed.map(c => c.id === cardId ? { ...c, deliveryDate: newDate } : c)
    }));
  };

  const renderFacts = (dealer) => (
    <>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Usual gap:</span>
        <span className={styles.statValue}>Every {fmtDays(dealer.x)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Since last order:</span>
        <span className={styles.statValue}>{dealer.d} days</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Last Order:</span>
        <span className={styles.statValue}>{fmtDate(dealer.lastOrder)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Due:</span>
        <span className={styles.statValue}>{fmtDate(dealer.dueDate)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>At Risk from:</span>
        <span className={styles.statValue}>{fmtDate(dealer.atRiskDate)}</span>
      </div>
      {dealer.declining && (
        <div className={styles.statRow}>
          <span className={styles.statLabel} style={{ color: 'var(--red)' }}>Orders:</span>
          <span className={styles.statValue} style={{ color: 'var(--red)' }}>Declining</span>
        </div>
      )}
    </>
  );

  const renderCard = (dealer, columnKey) => {
    const isDraggable = columnKey === 'today';

    return (
      <div
        key={dealer.id}
        className={`${styles.card} ${isDraggable ? styles.draggableCard : ''}`}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => handleDragStart(e, dealer, columnKey) : undefined}
        onClick={(e) => {
          e.stopPropagation();
          openClient(dealer.id);
        }}
        style={{ cursor: 'pointer' }}
      >
        <div className={styles.dealerName}>{dealer.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {renderFacts(dealer)}
          <div className={styles.pitchBox}>
            <div className={styles.pitchLabel}>Average per Order</div>
            <div className={styles.pitchValue}>{dealer.avgKg.toLocaleString()} KGs</div>
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmedCard = (dealer) => {
    return (
      <div
        key={dealer.id}
        className={`${styles.card} ${styles.draggableCard}`}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, dealer, 'confirmed')}
        onClick={(e) => {
          e.stopPropagation();
          openClient(dealer.id);
        }}
        style={{ cursor: 'pointer' }}
      >
        <div className={styles.dealerName}>{dealer.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {renderFacts(dealer)}

          <div className={styles.pitchBox}>
            <div className={styles.pitchLabel}>Average per Order</div>
            <div className={styles.pitchValue}>{dealer.avgKg.toLocaleString()} KGs</div>
          </div>

          <div style={{ marginTop: '8px', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
            <div className={styles.dateLabel}>Delivery Date</div>
            <input
              type="date"
              value={dealer.deliveryDate || ''}
              onChange={(e) => {
                e.stopPropagation();
                handleDateChange(dealer.id, e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className={styles.dateInput}
            />
          </div>
        </div>
      </div>
    );
  };

  const handleExportCSV = () => {
    const columnLabels = {
      today: 'Call Today',
      confirmed: 'Confirmed Delivery'
    };

    const headers = [
      'Status / Column',
      'Account Name',
      'Usual Gap (Days)',
      'Days Since Last Order',
      'Last Order Date',
      'Due Date',
      'At Risk Date',
      'Declining',
      'Average Kg per Order',
      'Confirmed Delivery Date'
    ];

    const rows = [];
    for (const key of ['today', 'confirmed']) {
      for (const card of columns[key] || []) {
        rows.push([
          `"${columnLabels[key]}"`,
          `"${(card.name || '').replace(/"/g, '""')}"`,
          card.x,
          card.d,
          `"${card.lastOrder || ''}"`,
          `"${card.dueDate || ''}"`,
          `"${card.atRiskDate || ''}"`,
          card.declining ? 'Yes' : 'No',
          card.avgKg || 0,
          `"${card.deliveryDate || ''}"`
        ].join(','));
      }
    }

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const todayStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `proactive_calling_kanban_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1>Proactive Calling Kanban</h1>
          <p>Accounts inside their usual order window. Call them before they turn overdue.</p>
        </div>
        <button className={styles.exportBtn} onClick={handleExportCSV}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </header>

      {loadError && (
        <p style={{ color: 'var(--danger-color, #ef4444)', fontSize: '15px', lineHeight: '22px', marginBottom: '16px' }}>
          Could not load sales data, so no accounts are shown. The query failed: {loadError}
        </p>
      )}

      <ExpandableKanban className={styles.kanbanBoard}>
      {/* 2. Call Today */}
      <div
        className={`${styles.column} ${styles.colToday} ${dragOverCol === 'today' ? styles.dragOver : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={(e) => handleDragEnter(e, 'today')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, 'today')}
      >
        <div className={styles.columnHeader}>
          <div className={styles.columnTitle}>Call Today</div>
          <div className={styles.countBadge}>{columns.today.length}</div>
        </div>
        <div className={styles.cardList} onClick={(e) => e.stopPropagation()}>
          {columns.today.map(d => renderCard(d, 'today'))}
          {columns.today.length === 0 && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '20px' }}>
              {loadError ? 'No data loaded' : 'No account is due for a call today.'}
            </div>
          )}
        </div>
      </div>

      {/* 3. Confirmed Delivery */}
      <div
        className={`${styles.column} ${styles.colConfirmed} ${dragOverCol === 'confirmed' ? styles.dragOver : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={(e) => handleDragEnter(e, 'confirmed')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, 'confirmed')}
      >
        <div className={styles.columnHeader}>
          <div className={styles.columnTitle}>Confirmed Delivery</div>
          <div className={styles.countBadge}>{columns.confirmed.length}</div>
        </div>
        <div className={styles.cardList} onClick={(e) => e.stopPropagation()}>
          {columns.confirmed.map(renderConfirmedCard)}
          {columns.confirmed.length === 0 && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '20px' }}>
              Drag accounts here to confirm delivery
            </div>
          )}
        </div>
      </div>

    </ExpandableKanban>
  </>
  );
}
