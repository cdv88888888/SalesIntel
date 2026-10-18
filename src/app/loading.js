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
      color: 'white',
    }}>
      <Loader2 size={48} className="animate-spin" style={{ color: 'var(--primary-accent)', marginBottom: '16px' }} />
      <h2 style={{ fontSize: '1.2rem', fontWeight: 500 }}>Loading Dashboard...</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>
        Analyzing and compiling data from BigQuery.
      </p>
    </div>
  );
}
