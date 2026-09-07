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
  ArrowUpDown,
  Users,
  UserCheck,
  UserX
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
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  // Filter out automated security test payloads by default
  const [hideTestPayloads, setHideTestPayloads] = useState(true);
  const [isPurging, setIsPurging] = useState(false);

  // Registered-user roster with per-user login/activity roll-up
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [otherUsers, setOtherUsers] = useState([]);
  const [usersError, setUsersError] = useState(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [activeWindowDays, setActiveWindowDays] = useState(30);

  const isTestPayload = (email) => {
    if (!email || typeof email !== 'string') return true;
    const clean = email.toLowerCase();
    return (
      clean.includes('<script>') ||
      clean.includes("' or '") ||
      clean.includes('aaaaa') ||
      clean.includes('example.com') ||
      clean.includes('evil.com') ||
      clean === 'undefined' ||
      clean === 'unknown'
    );
  };

  const handlePurgeTestLogs = async () => {
    if (!confirm("Are you sure you want to permanently delete all security test payload logs from Firestore?")) return;
    setIsPurging(true);
    try {
      const res = await fetch('/api/admin/logs', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully purged ${data.deletedCount || 0} test log entries.`);
        fetchLogs();
      } else {
        alert(`Failed to purge test logs: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error purging test logs: ${err.message}`);
    } finally {
      setIsPurging(false);
    }
  };

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

  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch registered users');
      }
      setRegisteredUsers(data.users || []);
      setOtherUsers(data.others || []);
      if (typeof data.activeWindowDays === 'number') setActiveWindowDays(data.activeWindowDays);
    } catch (err) {
      console.error('Error fetching registered users:', err);
      setUsersError(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchUsers();
  }, []);

  // Filter logs logic
  useEffect(() => {
    let result = [...logs];

    // Filter out security test payloads if enabled
    if (hideTestPayloads) {
      result = result.filter(log => !isTestPayload(log.email));
    }

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

    // Apply Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        if (sortConfig.key === 'timestamp') {
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
        }

        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        // String comparison
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredLogs(result);
  }, [logs, searchEmail, filterType, filterStatus, filterDate, sortConfig, hideTestPayloads]);

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

  // Get unique emails from all logs for the dropdown filter option (real users only)
  const uniqueEmails = Array.from(
    new Set(logs.map(log => log.email).filter(e => e && (!hideTestPayloads || !isTestPayload(e))))
  ).sort();

  // Dropdown lists EVERY registered user (even those with no activity yet),
  // unioned with any other real emails found in the logs.
  const dropdownEmails = Array.from(
    new Set([
      ...registeredUsers.map(u => u.email),
      ...uniqueEmails,
    ].filter(Boolean))
  ).sort();

  const formatWhen = (iso) => {
    if (!iso) return 'Never';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return 'Never';
    // Absolute UTC timestamp (pure); recency is already reflected by the
    // server-computed "Currently Using" active/idle flag.
    return iso.replace('T', ' ').substring(0, 16);
  };

  const loggedInCount = registeredUsers.filter(u => u.hasLoggedIn).length;
  const activeCount = registeredUsers.filter(u => u.active).length;

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
              onClick={handlePurgeTestLogs} 
              disabled={isPurging}
              style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }}
              title="Purge security test payload logs from Firestore"
            >
              {isPurging ? 'Purging...' : 'Purge Test Logs'}
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

      {/* Registered Users Roster */}
      <section className={`${styles.tableSection} glass-panel`}>
        <div className={styles.tableHeader}>
          <Users size={16} />
          <h2>Registered Users</h2>
          <span className={styles.recordCount}>
            {usersLoading
              ? 'Loading…'
              : `${loggedInCount} of ${registeredUsers.length} have logged in · ${activeCount} active in last ${activeWindowDays}d`}
          </span>
          <button
            className={styles.iconButton}
            onClick={fetchUsers}
            disabled={usersLoading}
            title="Refresh registered users"
            style={{ marginLeft: 'auto' }}
          >
            <RefreshCw size={16} className={usersLoading ? styles.spin : ''} />
          </button>
        </div>

        {usersError ? (
          <div className={`${styles.errorAlert} glass-panel`}>
            <ShieldAlert size={20} className={styles.errorIcon} />
            <div>
              <h3>Could not load registered users</h3>
              <p>{usersError}</p>
            </div>
          </div>
        ) : usersLoading ? (
          <div className={styles.loadingContainer}>
            <RefreshCw size={28} className={styles.spin} style={{ color: 'var(--primary-accent)' }} />
            <p>Loading registered users…</p>
          </div>
        ) : registeredUsers.length === 0 ? (
          <div className={styles.emptyContainer}>
            <Users size={40} style={{ color: 'var(--text-secondary)', marginBottom: '12px', opacity: 0.5 }} />
            <h3>No registered users found</h3>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>Role</th>
                  <th>Login Status</th>
                  <th>Logins</th>
                  <th>Last Login</th>
                  <th>Last Activity</th>
                  <th>Currently Using</th>
                </tr>
              </thead>
              <tbody>
                {registeredUsers.map((u) => (
                  <tr
                    key={u.email}
                    onClick={() => setSearchEmail(u.email)}
                    style={{ cursor: 'pointer' }}
                    title="Filter the activity log below by this user"
                  >
                    <td className={styles.emailTd}>{u.email}</td>
                    <td>
                      <span className={`${styles.badge} ${u.role === 'admin' ? styles.loginBadge : styles.accessBadge}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${u.hasLoggedIn ? styles.statusSuccess : styles.statusDanger}`}>
                        {u.hasLoggedIn ? (
                          <><UserCheck size={13} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />Logged in</>
                        ) : (
                          <><UserX size={13} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />Never</>
                        )}
                      </span>
                    </td>
                    <td>{u.loginCount.toLocaleString()}</td>
                    <td className={styles.timestampTd}>{formatWhen(u.lastLogin)}</td>
                    <td className={styles.timestampTd}>{formatWhen(u.lastActivity)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${u.active ? styles.statusSuccess : styles.statusDanger}`}>
                        {u.active ? 'Active' : 'Idle'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!usersLoading && !usersError && otherUsers.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div className={styles.tableHeader}>
              <ShieldAlert size={16} />
              <h2>Other people using the app (not registered)</h2>
              <span className={styles.recordCount}>{otherUsers.length} email(s) with successful logins</span>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User Email</th>
                    <th>Logins</th>
                    <th>Last Login</th>
                    <th>Last Activity</th>
                    <th>Currently Using</th>
                  </tr>
                </thead>
                <tbody>
                  {otherUsers.map((u) => (
                    <tr key={u.email} onClick={() => setSearchEmail(u.email)} style={{ cursor: 'pointer' }}>
                      <td className={styles.emailTd}>{u.email}</td>
                      <td>{u.loginCount.toLocaleString()}</td>
                      <td className={styles.timestampTd}>{formatWhen(u.lastLogin)}</td>
                      <td className={styles.timestampTd}>{formatWhen(u.lastActivity)}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${u.active ? styles.statusSuccess : styles.statusDanger}`}>
                          {u.active ? 'Active' : 'Idle'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
              {dropdownEmails.map(email => (
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
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('timestamp')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Timestamp{renderSortIndicator('timestamp')}
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('email')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      User Email{renderSortIndicator('email')}
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('action')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Action / Path{renderSortIndicator('action')}
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('type')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Type{renderSortIndicator('type')}
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('ip')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      IP Address{renderSortIndicator('ip')}
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('status')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Status{renderSortIndicator('status')}
                    </div>
                  </th>
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
