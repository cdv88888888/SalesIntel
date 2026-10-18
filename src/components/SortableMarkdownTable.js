'use client';

import React, { useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useClientDrawer } from '../context/ClientDrawerContext';

export default function SortableMarkdownTable({ children }) {
  const containerRef = useRef(null);
  const { openClient } = useClientDrawer();

  useEffect(() => {
    if (!containerRef.current) return;
    const table = containerRef.current.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('th');
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    let currentSortCol = null;
    let currentSortDir = 'asc';

    // 1. Make table headers clickable and sortable
    headers.forEach((th, colIndex) => {
      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';
      th.title = 'Click to sort column';
      th.style.transition = 'background-color 0.2s';

      th.onmouseover = () => {
        th.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
      };
      th.onmouseout = () => {
        th.style.backgroundColor = 'transparent';
      };

      th.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (currentSortCol === colIndex) {
          currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          currentSortCol = colIndex;
          currentSortDir = 'asc';
        }

        // Reset indicators on all headers
        headers.forEach(h => {
          const text = h.getAttribute('data-original-text') || h.innerText.replace(/\s+[↑↓]$/, '');
          if (!h.getAttribute('data-original-text')) {
            h.setAttribute('data-original-text', text);
          }
          h.innerText = text;
        });

        // Set indicator on clicked header
        const baseText = th.getAttribute('data-original-text') || th.innerText;
        th.innerText = `${baseText} ${currentSortDir === 'asc' ? '↑' : '↓'}`;

        // Sort rows
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((rowA, rowB) => {
          const cellA = rowA.children[colIndex]?.innerText?.trim() || '';
          const cellB = rowB.children[colIndex]?.innerText?.trim() || '';

          // Parse numbers (e.g., "12,345.50", "98k", "$100", "50 kg")
          const cleanA = cellA.replace(/,/g, '').replace(/[^0-9.-]+/g, '');
          const cleanB = cellB.replace(/,/g, '').replace(/[^0-9.-]+/g, '');
          const numA = parseFloat(cleanA);
          const numB = parseFloat(cleanB);

          if (!isNaN(numA) && !isNaN(numB) && cellA.match(/\d/) && cellB.match(/\d/)) {
            return currentSortDir === 'asc' ? numA - numB : numB - numA;
          }

          return currentSortDir === 'asc' 
            ? cellA.localeCompare(cellB) 
            : cellB.localeCompare(cellA);
        });

        // Append sorted rows back to tbody
        rows.forEach(r => tbody.appendChild(r));
      };
    });

    // 2. Make rows/cells clickable to open client drawer
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      row.style.cursor = 'pointer';
      row.style.transition = 'background-color 0.15s ease';

      row.onmouseenter = () => {
        row.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
      };
      row.onmouseleave = () => {
        row.style.backgroundColor = 'transparent';
      };

      row.onclick = (e) => {
        // Prevent click if user selected text
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;

        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length === 0) return;

        // Extract dealer candidate from cells
        let dealerIdOrName = null;
        for (const cell of cells) {
          const text = cell.innerText.trim();
          // Check for dealer ID pattern (e.g. 01-01-24004 or FB-1)
          if (/^(\d{2}-\d{2}-\d+|\w+-\d+|\w{2,}\d+)$/i.test(text)) {
            dealerIdOrName = text;
            break;
          }
        }

        if (!dealerIdOrName) {
          // Fallback: check 2nd column (usually Name) or 1st column (ID/Name)
          dealerIdOrName = cells[1]?.innerText?.trim() || cells[0]?.innerText?.trim();
        }

        if (dealerIdOrName) {
          openClient(dealerIdOrName);
        }
      };
    });

  }, [children, openClient]);

  const handleDownload = () => {
    if (!containerRef.current) return;
    const table = containerRef.current.querySelector('table');
    if (!table) return;
    let csv = [];
    const rows = table.querySelectorAll('tr');
    for (let i = 0; i < rows.length; i++) {
      let row = [], cols = rows[i].querySelectorAll('td, th');
      for (let j = 0; j < cols.length; j++) {
        const text = (cols[j].innerText || '').replace(/"/g, '""').replace(/\s+[↑↓]$/, '');
        row.push('"' + text + '"');
      }
      csv.push(row.join(','));
    }
    const csvFile = new Blob([csv.join('\n')], {type: 'text/csv'});
    const downloadLink = document.createElement('a');
    downloadLink.download = 'sales_intelligence_data.csv';
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', margin: '16px 0', width: '100%' }}>
      <div style={{ width: '100%', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
      </div>
      <button 
        onClick={handleDownload} 
        style={{ 
          background: 'var(--primary-accent)', 
          color: 'white', 
          padding: '8px 16px', 
          borderRadius: '8px', 
          border: 'none', 
          cursor: 'pointer', 
          fontSize: '0.9rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          fontWeight: 500,
          transition: 'background-color 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.backgroundColor = '#2563eb'}
        onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--primary-accent)'}
      >
        <Download size={16} />
        Download Data as CSV
      </button>
    </div>
  );
}
