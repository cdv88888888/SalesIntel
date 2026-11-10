"use client";

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import styles from './alerts.module.css';

// A button that shows the AI explanation for one flagged account. Nothing is
// shown until it is clicked; the server then returns the stored explanation
// if one exists for the current sales data, or writes one.
export default function ExplainButton({ accountId }) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const explain = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/alerts/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setExplanation(body.explanation);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.explain}>
      {explanation && (
        <div className={styles.explainText}>
          {explanation.text.split('\n').filter(Boolean).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          <div className={styles.explainMeta}>
            AI reading of the order history — a likely cause, not a confirmed one.
          </div>
        </div>
      )}
      {!explanation && (
        <button type="button" className={styles.explainBtn} onClick={explain} disabled={loading}>
          {loading ? <Loader2 size={13} className={styles.spin} /> : <Sparkles size={13} />}
          {loading ? 'Reading the orders…' : 'Explain with AI'}
        </button>
      )}
      {error && <div className={styles.explainError}>{error}</div>}
    </div>
  );
}
