"use client";

import { useState, useEffect, useTransition } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Download, 
  RefreshCw, 
  Calendar, 
  Filter, 
  Layers,
  Database,
  ArrowUpDown
} from 'lucide-react';
import styles from './page.module.css';

export default function AdminLogsPage() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters state
  const [searchEmail, setSearchEmail] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  
  // Sorting state
  const [sortAsc, setSortAsc] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/logs');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch logs');
      }
      
      setLogs(data.logs || []);
      setFilteredLogs(data.logs || []);
    } catch (err) {
      console.error("Error in fetching logs UI:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs logic
  useEffect(() => {
    let result = [...logs];

    // Search by Email
    if (searchEmail.trim() !== '') {
      const search = searchEmail.toLowerCase().trim();
      result = result.filter(log => log.email && log.email.toLowerCase().includes(search));
    }

    // Filter by Event Type
    if (filterType !== 'all') {
      result = result.filter(log => log.type === filterType);
    }

    // Filter by Status
    if (filterStatus !== 'all') {
      result = result.filter(log => log.status && log.status.toLowerCase() === filterStatus.toLowerCase());
    }

    // Filter by Date
    if (filterDate !== '') {
      result = result.filter(log => {
        if (!log.timestamp) return false;
        // Compare date portion: YYYY-MM-DD
        const logDate = log.timestamp.split('T')[0];
        return logDate === filterDate;
      });
    }

    // Apply Sorting (default is descending by timestamp)
    result.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortAsc ? timeA - timeB : timeB - timeA;
    });

    setFilteredLogs(result);
  }, [logs, searchEmail, filterType, filterStatus, filterDate, sortAsc]);

  const clearFilters = () => {
    setSearchEmail('');
    setFilterType('all');
    setFilterStatus('all');
    setFilterDate('');
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Timestamp', 'User Email', 'Action/URL', 'Type', 'Status', 'IP Address'];
    const rows = filteredLogs.map(log => [
      log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 19) : '',
      log.email || '',
      `"${(log.action || '').replace(/"/g, '""')}"`,
      log.type || 'access',
      log.status || '',
      log.ip || 'unknown'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `access_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get unique emails from all logs for the dropdown filter option
  const uniqueEmails = Array.from(new Set(logs.map(log => log.email).filter(Boolean))).sort();

  // Calculate metrics
  const totalLogs = filteredLogs.length;
  const totalLogins = filteredLogs.filter(log => log.type === 'login').length;
  const totalAccess = filteredLogs.filter(log => log.type === 'access').length;
  const totalBlocked = filteredLogs.filter(log => log.status === 'Denied').length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTitleContainer}>
          <div>
            <h1 className="gradient-text">Admin Logs Dashboard</h1>
            <p>Monitor system activity, user logins, and whitelisted routing access in real time.</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} onClick={fetchLogs} disabled={isLoading} title="Refresh Logs">
              <RefreshCw size={18} className={isLoading ? styles.spin : ''} />
            </button>
            <button 
              className={styles.button} 
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
            >
              <Download size={16} style={{ marginRight: '8px' }} />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className={`${styles.errorAlert} glass-panel`}>
          <ShieldAlert size={24} className={styles.errorIcon} />
          <div>
            <h3>Firestore Logging Warning</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Metrics Panel */}
      <section className={styles.metricsGrid}>
        <div className={`${styles.metricCard} glass-panel`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Total Events</span>
            <Layers size={20} style={{ color: 'var(--primary-accent)' }} />
          </div>
          <span className={styles.metricValue}>{totalLogs.toLocaleString()}</span>
        </div>
        <div className={`${styles.metricCard} glass-panel`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>User Logins</span>
            <Layers size={20} style={{ color: 'var(--success-color)' }} />
          </div>
          <span className={styles.metricValue}>{totalLogins.toLocaleString()}</span>
        </div>
        <div className={`${styles.metricCard} glass-panel`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Page Accesses</span>
            <Layers size={20} style={{ color: 'rgba(96, 165, 250, 0.8)' }} />
          </div>
          <span className={styles.metricValue}>{totalAccess.toLocaleString()}</span>
        </div>
        <div className={`${styles.metricCard} glass-panel`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Blocked / Denied</span>
            <Layers size={20} style={{ color: 'var(--danger-color)' }} />
          </div>
          <span className={styles.metricValue} style={{ color: totalBlocked > 0 ? 'var(--danger-color)' : 'inherit' }}>
            {totalBlocked.toLocaleString()}
          </span>
        </div>
      </section>

      {/* Filters Section */}
      <section className={`${styles.filtersContainer} glass-panel`}>
        <div className={styles.filtersHeader}>
          <Filter size={16} />
          <h2>Filter Logs</h2>
          {(searchEmail || filterType !== 'all' || filterStatus !== 'all' || filterDate) && (
            <button className={styles.clearBtn} onClick={clearFilters}>Clear Filters</button>
          )}
        </div>
        
        <div className={styles.filtersGrid}>
          {/* Filter by Email */}
          <div className={styles.filterGroup}>
            <label>Filter User Email</label>
            <select 
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
            >
              <option value="">All Users</option>
              {uniqueEmails.map(email => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </div>

          {/* Event Type */}
          <div className={styles.filterGroup}>
            <label>Event Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="access">Page Access</option>
              <option value="login">Login / Auth</option>
            </select>
          </div>

          {/* Status */}
          <div className={styles.filterGroup}>
            <label>Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="allowed">Allowed / Success</option>
              <option value="denied">Denied</option>
            </select>
          </div>

          {/* Date */}
          <div className={styles.filterGroup}>
            <label>Date</label>
            <div className={styles.searchWrapper}>
              <Calendar size={16} className={styles.searchIcon} />
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Table Section */}
      <section className={`${styles.tableSection} glass-panel`}>
        <div className={styles.tableHeader}>
          <Database size={16} />
          <h2>Activity Log Records</h2>
          <span className={styles.recordCount}>Showing {filteredLogs.length} of {logs.length} entries</span>
        </div>

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <RefreshCw size={32} className={styles.spin} style={{ color: 'var(--primary-accent)' }} />
            <p>Loading activity logs from Firestore...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className={styles.emptyContainer}>
            <Layers size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px', opacity: 0.5 }} />
            <h3>No logs found</h3>
            <p>Try adjusting your search filters or check back later.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => setSortAsc(!sortAsc)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Timestamp
                      <ArrowUpDown size={14} />
                    </div>
                  </th>
                  <th>User Email</th>
                  <th>Action / Path</th>
                  <th>Type</th>
                  <th>IP Address</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const isSuccess = log.status === 'Allowed' || log.status === 'Success';
                  return (
                    <tr key={log.id}>
                      <td className={styles.timestampTd}>
                        {log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 19) : 'N/A'}
                      </td>
                      <td className={styles.emailTd}>{log.email}</td>
                      <td className={styles.actionTd}>{log.action}</td>
                      <td>
                        <span className={`${styles.badge} ${log.type === 'login' ? styles.loginBadge : styles.accessBadge}`}>
                          {log.type === 'login' ? 'Auth' : 'Access'}
                        </span>
                      </td>
                      <td className={styles.ipTd}>{log.ip}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${isSuccess ? styles.statusSuccess : styles.statusDanger}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
