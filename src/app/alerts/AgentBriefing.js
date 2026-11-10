"use client";

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Loader2 } from 'lucide-react';
import styles from './alerts.module.css';

// The investigating agent's briefing for one batch, with a button to run the
// agent now. `initial` is the stored briefing, if any.
export default function AgentBriefing({ agentKey, initial = null, dataThrough }) {
  const [briefing, setBriefing] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isOutdated = briefing && briefing.dataThrough !== dataThrough;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/alerts/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentKey, force: Boolean(briefing) && !isOutdated }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setBriefing(body.briefing);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.briefing}>
      <div className={styles.briefingHead}>
        <span className={styles.briefingTitle}><Bot size={14} /> Agent briefing</span>
        {briefing && (
          <span className={styles.briefingMeta}>
            Sales data through {briefing.dataThrough} · {briefing.queries} queries
            {isOutdated && ' · newer data is available'}
          </span>
        )}
        <button type="button" className={styles.explainBtn} onClick={run} disabled={loading}>
          {loading && <Loader2 size={13} className={styles.spin} />}
          {loading ? 'Agent is investigating… (1–3 min)' : briefing ? 'Run again' : 'Run agent'}
        </button>
      </div>
      {briefing && (
        <div className={styles.briefingBody}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing.text}</ReactMarkdown>
        </div>
      )}
      {!briefing && !loading && (
        <div className={styles.briefingMeta}>
          The agent has not analysed this batch yet. It runs on the schedule, or start it now.
        </div>
      )}
      {error && <div className={styles.explainError}>{error}</div>}
    </div>
  );
}
