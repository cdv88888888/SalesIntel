"use client";

import React, { useState } from 'react';
import ExpandableKanban from '../../components/ExpandableKanban';
import styles from './page.module.css';

export default function ProactiveBoard({ initialColumns }) {
  const [columns, setColumns] = useState(initialColumns);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e, card, sourceColumn) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/json", JSON.stringify({ cardId: card.id, sourceColumn }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const { cardId, sourceColumn } = JSON.parse(dataStr);

      // Only allow dragging from 'overdue' and 'today' columns
      if (sourceColumn !== 'overdue' && sourceColumn !== 'today') return;

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

  const renderCard = (dealer, columnKey) => {
    const isDraggable = columnKey === 'overdue' || columnKey === 'today';

    return (
      <div
        key={dealer.id}
        className={`${styles.card} ${isDraggable ? styles.draggableCard : ''}`}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => handleDragStart(e, dealer, columnKey) : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dealerName}>{dealer.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Frequency:</span>
            <span className={styles.statValue}>Every {dealer.avgDays} days</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Last Order:</span>
            <span className={styles.statValue}>{dealer.lastOrder}</span>
          </div>
          {dealer.daysUntilExpected < 0 && (
            <div className={styles.statRow}>
              <span className={styles.statLabel} style={{ color: '#f87171' }}>Status:</span>
              <span className={styles.statValue} style={{ color: '#f87171' }}>{Math.abs(dealer.daysUntilExpected)} Days Overdue</span>
            </div>
          )}
          {dealer.daysUntilExpected > 0 && (
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Expected:</span>
              <span className={styles.statValue}>In {dealer.daysUntilExpected} days</span>
            </div>
          )}

          <div className={styles.pitchBox}>
            <div className={styles.pitchLabel}>Suggested Pitch Volume</div>
            <div className={styles.pitchValue}>{dealer.pitchVolume.toLocaleString()} KGs</div>
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmedCard = (dealer) => {
    return (
      <div
        key={dealer.id}
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dealerName}>{dealer.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Frequency:</span>
            <span className={styles.statValue}>Every {dealer.avgDays} days</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Last Order:</span>
            <span className={styles.statValue}>{dealer.lastOrder}</span>
          </div>

          <div className={styles.pitchBox}>
            <div className={styles.pitchLabel}>Suggested Pitch Volume</div>
            <div className={styles.pitchValue}>{dealer.pitchVolume.toLocaleString()} KGs</div>
          </div>

          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
            <div className={styles.dateLabel}>Delivery Date</div>
            <input
              type="date"
              value={dealer.deliveryDate || ''}
              onChange={(e) => handleDateChange(dealer.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className={styles.dateInput}
            />
          </div>
        </div>
      </div>
    );
  };  const handleExportCSV = () => {
    const columnLabels = {
      overdue: 'Overdue',
      today: 'Call Today',
      confirmed: 'Confirmed Delivery',
      thisWeek: 'Upcoming (1-7 Days)',
      future: 'Recently Ordered'
    };

    const headers = [
      'Status / Column',
      'Account Name',
      'Frequency (Days)',
      'Last Order Date',
      'Expected Order Date',
      'Days Overdue / Until Expected',
      'Suggested Pitch Volume (kgs)',
      'Confirmed Delivery Date'
    ];

    const rows = [];
    const columnKeys = ['overdue', 'today', 'confirmed', 'thisWeek', 'future'];

    for (const key of columnKeys) {
      const colCards = columns[key] || [];
      const colLabel = columnLabels[key];

      for (const card of colCards) {
        let statusStr = '';
        if (card.daysUntilExpected < 0) {
          statusStr = `${Math.abs(card.daysUntilExpected)} Days Overdue`;
        } else if (card.daysUntilExpected === 0) {
          statusStr = 'Due Today';
        } else {
          statusStr = `In ${card.daysUntilExpected} Days`;
        }

        const row = [
          `"${colLabel}"`,
          `"${(card.name || '').replace(/"/g, '""')}"`,
          card.avgDays || 0,
          `"${card.lastOrder || ''}"`,
          `"${card.expectedDate || ''}"`,
          `"${statusStr}"`,
          Math.round(card.pitchVolume || 0),
          `"${card.deliveryDate || ''}"`
        ];

        rows.push(row.join(','));
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
          <h1 className="gradient-text">Proactive Calling Kanban</h1>
          <p>Stay ahead of order cycles. Action accounts before they miss their historical purchasing windows.</p>
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

      <ExpandableKanban className={styles.kanbanBoard}>
      {/* 1. Overdue */}
      <div className={`${styles.column} ${styles.colOverdue}`}>
        <div className={styles.columnHeader}>
          <div className={styles.columnTitle}>Overdue</div>
          <div className={styles.countBadge}>{columns.overdue.length}</div>
        </div>
        <div className={styles.cardList} onClick={(e) => e.stopPropagation()}>
          {columns.overdue.map(d => renderCard(d, 'overdue'))}
          {columns.overdue.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>
              No overdue accounts
            </div>
          )}
        </div>
      </div>

      {/* 2. Call Today */}
      <div className={`${styles.column} ${styles.colToday}`}>
        <div className={styles.columnHeader}>
          <div className={styles.columnTitle}>Call Today</div>
          <div className={styles.countBadge}>{columns.today.length}</div>
        </div>
        <div className={styles.cardList} onClick={(e) => e.stopPropagation()}>
          {columns.today.map(d => renderCard(d, 'today'))}
          {columns.today.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>
              No calls scheduled for today
            </div>
          )}
        </div>
      </div>

      {/* 3. Confirmed Delivery (New Column - Styled Blue) */}
      <div
        className={`${styles.column} ${styles.colConfirmed} ${isDragOver ? styles.dragOver : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={styles.columnHeader}>
          <div className={styles.columnTitle}>Confirmed Delivery</div>
          <div className={styles.countBadge}>{columns.confirmed.length}</div>
        </div>
        <div className={styles.cardList} onClick={(e) => e.stopPropagation()}>
          {columns.confirmed.map(renderConfirmedCard)}
          {columns.confirmed.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>
              Drag accounts here to confirm delivery
            </div>
          )}
        </div>
      </div>

      {/* 4. Upcoming */}
      <div className={`${styles.column} ${styles.colThisWeek}`}>
        <div className={styles.columnHeader}>
          <div className={styles.columnTitle}>Upcoming (1-7 Days)</div>
          <div className={styles.countBadge}>{columns.thisWeek.length}</div>
        </div>
        <div className={styles.cardList} onClick={(e) => e.stopPropagation()}>
          {columns.thisWeek.map(d => renderCard(d, 'thisWeek'))}
          {columns.thisWeek.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>
              No upcoming calls
            </div>
          )}
        </div>
      </div>

      {/* 5. Recently Ordered */}
      <div className={`${styles.column} ${styles.colFuture}`}>
        <div className={styles.columnHeader}>
          <div className={styles.columnTitle}>Recently Ordered</div>
          <div className={styles.countBadge}>{columns.future.length}</div>
        </div>
        <div className={styles.cardList} onClick={(e) => e.stopPropagation()}>
          {columns.future.map(d => renderCard(d, 'future'))}
          {columns.future.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>
              No recent orders
            </div>
          )}
        </div>
      </div>
    </ExpandableKanban>
  </>
  );
}
