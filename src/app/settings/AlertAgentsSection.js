"use client";

import { useEffect, useState } from 'react';
import styles from './page.module.css';
import { segmentLabel } from '../../lib/segments';

const formatWhen = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

// Settings panel: pick the person each volume-watch agent reports to.
export default function AlertAgentsSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/alert-agents')
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
        if (!cancelled) setData(body);
      })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  const assign = async (key, email) => {
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch('/api/settings/alert-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setData(prev => ({ ...prev, assignments: body.assignments }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey(null);
    }
  };

  const lastRun = data?.lastRun;

  return (
    <section className={`${styles.section} glass-panel`} style={{ marginTop: '32px' }}>
      <h2 className={styles.sectionTitle}>Volume Alert Agents</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>
        Each agent watches 50 accounts in one channel, ranked by volume. Pick the person
        who receives each agent&apos;s warnings. Membership is re-ranked at the start of
        each month.
      </p>

      {lastRun && (
        <p style={{ color: 'var(--muted)', marginBottom: '16px', fontSize: '13px' }}>
          Last run {formatWhen(lastRun.checkedAt || lastRun.ranAt)} on sales data through{' '}
          {lastRun.dataThrough}: {lastRun.flagged} flagged, {lastRun.newCount} new,{' '}
          {lastRun.resolvedCount} recovered.
          {lastRun.skipped ? ` ${lastRun.skipped}` : ''}
        </p>
      )}

      {error && <div className={styles.alertError}>{error}</div>}
      {!data && !error && <div style={{ color: 'var(--muted)' }}>Loading agents…</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {(data?.agents || []).map(agent => (
          <div
            key={agent.key}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--s2)', border: 0, borderRadius: 'var(--r-card)', fontSize: '15px' }}
          >
            <span style={{ minWidth: '260px' }}>
              <strong>{segmentLabel(agent.segment)} · Agent {agent.batch}</strong>
              <span style={{ color: 'var(--muted)', marginLeft: '10px', fontSize: '13px' }}>
                ranks {agent.firstRank}–{agent.lastRank} · {agent.flagged} flagged
              </span>
            </span>
            <select
              value={data.assignments?.[agent.key] || ''}
              onChange={(e) => assign(agent.key, e.target.value)}
              disabled={savingKey === agent.key}
              style={{ background: 'var(--surface)', color: 'var(--text)', border: 0, borderRadius: '12px', minHeight: '44px', padding: '0 14px', fontFamily: 'inherit', fontSize: '15px', minWidth: '260px' }}
            >
              <option value="" style={{ color: 'var(--text)', background: 'var(--s2)' }}>Unassigned</option>
              {(data.users || []).map(email => (
                <option key={email} value={email} style={{ color: 'var(--text)', background: 'var(--s2)' }}>{email}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}
