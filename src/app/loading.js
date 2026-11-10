import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      width: '100%',
      minHeight: '60vh',
      color: 'var(--text)',
    }}>
      <Loader2 size={48} className="animate-spin" style={{ color: 'var(--blue)', marginBottom: '16px' }} />
      <h2 style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-.01em' }}>Loading Dashboard...</h2>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px' }}>
        Analyzing and compiling data from BigQuery.
      </p>
    </div>
  );
}
