"use client";

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import styles from './alerts.module.css';

// Shows the AI explanation for one flagged account, or a button to write one.
// `initial` is the stored explanation, if there is one; `dataThrough` is the
// date of the sales data the page is showing, used to mark an older one.
export default function ExplainButton({ accountId, initial = null, dataThrough }) {
  const [explanation, setExplanation] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isOutdated = explanation && explanation.dataThrough !== dataThrough;

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
            {isOutdated && ` Written on data through ${explanation.dataThrough}.`}
          </div>
        </div>
      )}
      {(!explanation || isOutdated) && (
        <button type="button" className={styles.explainBtn} onClick={explain} disabled={loading}>
          {loading ? <Loader2 size={13} className={styles.spin} /> : <Sparkles size={13} />}
          {loading ? 'Reading the orders…' : explanation ? 'Update explanation' : 'Explain with AI'}
        </button>
      )}
      {error && <div className={styles.explainError}>{error}</div>}
    </div>
  );
}
