"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

function SettingsContent() {
  const searchParams = useSearchParams();
  const segment = searchParams.get('segment') || 'dealer';

  const [globalTarget, setGlobalTarget] = useState(150000);
  const [dealerTargets, setDealerTargets] = useState({});
  const [dealersList, setDealersList] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [isManagingUsers, setIsManagingUsers] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('dark');
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  const ALLOWED_ADMINS = useMemo(() => ['cdv@masaganagas.com', 'janalbert.santos@masaganagas.com'], []);
  const canManageUsers = useMemo(() => ALLOWED_ADMINS.includes(currentUserEmail), [ALLOWED_ADMINS, currentUserEmail]);

  useEffect(() => {
    async function loadUserSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data?.user?.email) {
          setCurrentUserEmail(data.user.email.trim().toLowerCase());
        }
      } catch (err) {
        console.error("Failed to load user session:", err);
      }
    }
    loadUserSession();
  }, []);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

  const sortedDealers = useMemo(() => {
    const list = [...dealersList];
    if (!sortConfig.key) return list;

    list.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (sortConfig.key === 'name') {
        valA = a.name || a.id || "";
        valB = b.name || b.id || "";
        return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = valA !== null && valA !== undefined ? valA : -999999999;
      valB = valB !== null && valB !== undefined ? valB : -999999999;

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [dealersList, sortConfig]);

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

  useEffect(() => {
    const t = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'dark';
    setCurrentTheme(t);

    const handleThemeChange = () => {
      setCurrentTheme(localStorage.getItem('theme') || 'dark');
    };
    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, []);

  const handleThemeChange = (newTheme) => {
    setCurrentTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
    window.dispatchEvent(new Event('themechange'));
  };

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/settings?month=${selectedMonth}&segment=${segment}`);
      const data = await res.json();
      const loadedGlobalTarget = data.globalTarget || 150000;
      setGlobalTarget(loadedGlobalTarget);
      
      let loadedDealerTargets = {};
      if (data.dealerTargets) {
        loadedDealerTargets = data.dealerTargets;
        setDealerTargets(loadedDealerTargets);
      }

      try {
        const wlRes = await fetch('/api/whitelist');
        const wlData = await wlRes.json();
        if (wlData.whitelist) {
          setWhitelist(wlData.whitelist);
        }
      } catch (err) {
        console.error("Failed to load whitelist:", err);
      }

      try {
        const suggestRes = await fetch(`/api/targets/suggest?globalTarget=${loadedGlobalTarget}&month=${selectedMonth}&segment=${segment}`);
        const suggestData = await suggestRes.json();
        
        if (suggestData.suggestions) {
          const newList = [];
          for (const [id, info] of Object.entries(suggestData.suggestions)) {
            const savedTarget = loadedDealerTargets[id];
            newList.push({
              id,
              name: info.name,
              avgMonthKgs: Math.round(info.avgMonthKgs),
              highestMonthKgs: info.highestMonthKgs ? Math.round(info.highestMonthKgs) : null,
              lowestMonthKgs: info.lowestMonthKgs ? Math.round(info.lowestMonthKgs) : null,
              target: savedTarget !== undefined ? savedTarget : info.suggestedTarget
            });
          }

          for (const [id, target] of Object.entries(loadedDealerTargets)) {
            if (!suggestData.suggestions[id]) {
              newList.push({
                id,
                name: null,
                avgMonthKgs: null,
                highestMonthKgs: null,
                lowestMonthKgs: null,
                target
              });
            }
          }

          newList.sort((a, b) => b.target - a.target);
          setDealersList(newList);
        } else {
          const list = Object.keys(loadedDealerTargets).map(id => ({
            id,
            target: loadedDealerTargets[id]
          }));
          setDealersList(list);
        }
      } catch (err) {
        console.error("Failed to load suggestions:", err);
        const list = Object.keys(loadedDealerTargets).map(id => ({
          id,
          target: loadedDealerTargets[id]
        }));
        setDealersList(list);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSettings();
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedMonth, segment]);

  const generateSuggestions = async () => {
    setIsGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/targets/suggest?globalTarget=${globalTarget}&month=${selectedMonth}&segment=${segment}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate suggestions");
      }

      const suggestions = data.suggestions;
      const newList = [];
      const newTargetsMap = { ...dealerTargets };

      for (const [id, info] of Object.entries(suggestions)) {
        newList.push({
          id,
          name: info.name,
          avgMonthKgs: Math.round(info.avgMonthKgs),
          highestMonthKgs: info.highestMonthKgs ? Math.round(info.highestMonthKgs) : null,
          lowestMonthKgs: info.lowestMonthKgs ? Math.round(info.lowestMonthKgs) : null,
          target: info.suggestedTarget
        });
        newTargetsMap[id] = info.suggestedTarget;
      }

      // Sort by target descending
      newList.sort((a, b) => b.target - a.target);

      setDealersList(newList);
      setDealerTargets(newTargetsMap);
      setMessage("Suggestions generated based on historical averages. Review and save to apply.");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTargetChange = (id, newTarget) => {
    const val = parseInt(newTarget, 10) || 0;
    setDealerTargets(prev => ({
      ...prev,
      [id]: val
    }));
    setDealersList(prev => prev.map(d => d.id === id ? { ...d, target: val } : d));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          globalTarget: parseInt(globalTarget, 10),
          dealerTargets,
          month: selectedMonth,
          segment
        })
      });

      if (!res.ok) {
        throw new Error("Failed to save settings");
      }

      setMessage("Settings saved successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const addUser = async () => {
    if (!newUserEmail) return;
    setIsManagingUsers(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newUserEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add user");
      setWhitelist(data.whitelist);
      setNewUserEmail('');
      setMessage("User added successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsManagingUsers(false);
    }
  };

  const removeUser = async (email) => {
    setIsManagingUsers(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/whitelist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove user");
      setWhitelist(data.whitelist);
      setMessage("User removed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsManagingUsers(false);
    }
  };

  const updateUserRole = async (email, role) => {
    setIsManagingUsers(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/whitelist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      setWhitelist(data.whitelist);
      setMessage("User role updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsManagingUsers(false);
    }
  };

  if (isLoading) return <div className={styles.container}>Loading settings...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="gradient-text">Target Allocation Settings</h1>
            <p>Set global monthly goals and distribute them across {segment} customers.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 600 }}>Target Month:</label>
            <input 
              type="month" 
              className={styles.inputField}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--input-text)' }}
            />
          </div>
        </div>
      </header>

      {error && <div className={styles.alertError}>{error}</div>}
      {message && <div className={styles.alertSuccess}>{message}</div>}

      <section className={`${styles.section} glass-panel`}>
        <h2 className={styles.sectionTitle}>Global Configuration</h2>
        
        <div className={styles.formGroup}>
          <label>Global Monthly Target (KG)</label>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <input 
              type="number" 
              className={styles.inputField} 
              value={globalTarget}
              onChange={(e) => setGlobalTarget(e.target.value)}
            />
            <button 
              className={styles.button} 
              onClick={generateSuggestions}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate Suggested Split"}
            </button>
          </div>
        </div>

        <div className={styles.formGroup} style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <label>Theme Preference</label>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={() => handleThemeChange('light')}
              className={styles.button}
              style={{
                background: currentTheme === 'light' ? 'var(--primary-accent)' : 'var(--surface-hover)',
                color: currentTheme === 'light' ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                width: 'auto',
                margin: 0
              }}
            >
              ☀️ Light Mode
            </button>
            <button
              onClick={() => handleThemeChange('dark')}
              className={styles.button}
              style={{
                background: currentTheme === 'dark' ? 'var(--primary-accent)' : 'var(--surface-hover)',
                color: currentTheme === 'dark' ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                width: 'auto',
                margin: 0
              }}
            >
              🌙 Dark Mode
            </button>
          </div>
        </div>
      </section>

      {dealersList.length > 0 && (
        <section className={`${styles.section} glass-panel`}>
          <h2 className={styles.sectionTitle}>{segment.charAt(0).toUpperCase() + segment.slice(1)} Allocation</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Review the suggested targets. You can manually adjust the target for any {segment}.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('name')}>
                    Customer Name{renderSortIndicator('name')}
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('avgMonthKgs')}>
                    Historical Avg (KG){renderSortIndicator('avgMonthKgs')}
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('lowestMonthKgs')}>
                    Lowest (KG){renderSortIndicator('lowestMonthKgs')}
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('highestMonthKgs')}>
                    Highest (KG){renderSortIndicator('highestMonthKgs')}
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('target')}>
                    Assigned Target (KG){renderSortIndicator('target')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDealers.map(dealer => (
                  <tr key={dealer.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{dealer.name || dealer.id}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {dealer.id}</div>
                    </td>
                    <td>{dealer.avgMonthKgs ? dealer.avgMonthKgs.toLocaleString() : 'N/A'}</td>
                    <td>{dealer.lowestMonthKgs !== null && dealer.lowestMonthKgs !== undefined ? dealer.lowestMonthKgs.toLocaleString() : 'N/A'}</td>
                    <td>{dealer.highestMonthKgs !== null && dealer.highestMonthKgs !== undefined ? dealer.highestMonthKgs.toLocaleString() : 'N/A'}</td>
                    <td>
                      <input 
                        type="number" 
                        className={styles.tableInput}
                        value={dealer.target}
                        onChange={(e) => handleTargetChange(dealer.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.actions}>
            <button 
              className={styles.button} 
              onClick={saveSettings}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </section>
      )}

      {canManageUsers && (
        <section className={`${styles.section} glass-panel`} style={{ marginTop: '32px' }}>
          <h2 className={styles.sectionTitle}>Onboarded Users</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Users authorized to access the system.
          </p>
          
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <input 
              type="email" 
              className={styles.inputField} 
              placeholder="Add new user email..."
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              style={{ flexGrow: 1 }}
            />
            <button 
              className={styles.button} 
              onClick={addUser}
              disabled={!newUserEmail || isManagingUsers}
            >
              Add User
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {whitelist.map((user) => {
              const emailStr = user.email || user;
              const isProtected = ALLOWED_ADMINS.includes((emailStr || '').trim().toLowerCase());
              return (
                <div key={emailStr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
                  <span style={{ minWidth: '200px' }}>{emailStr}</span>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <select 
                      value={user.role || 'viewer'} 
                      onChange={(e) => updateUserRole(emailStr, e.target.value)}
                      disabled={isManagingUsers || isProtected}
                      style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}
                    >
                      <option value="admin" style={{ color: '#000' }}>Admin</option>
                      <option value="viewer" style={{ color: '#000' }}>Viewer</option>
                    </select>
                    <button 
                      onClick={() => removeUser(emailStr)}
                      disabled={isManagingUsers || isProtected}
                      style={{ background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', opacity: (isManagingUsers || isProtected) ? 0.5 : 1 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            {whitelist.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>No users found.</div>}
          </div>
        </section>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '24px' }}>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
