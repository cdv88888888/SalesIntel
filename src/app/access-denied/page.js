'use client';

import { useEffect } from 'react';
import { logoutUser } from '../../lib/auth';

export default function AccessDeniedPage() {
  useEffect(() => {
    // Proactively clear any client-side Firebase Auth and session remnants
    logoutUser().catch(err => {
      console.error('Failed to log out user on access-denied page:', err);
    });
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text)', padding: '16px' }}>
      <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: 'var(--r-group)', textAlign: 'center', width: '100%', maxWidth: '380px' }}>
        <h1 style={{ marginBottom: '16px', fontSize: '28px', lineHeight: '32px', fontWeight: 700, letterSpacing: '-.02em', color: 'var(--red)' }}>Access Denied</h1>
        <div id="denied-container" style={{ color: 'var(--muted)', marginBottom: '24px', fontSize: '15px', lineHeight: '22px' }}>
          You do not have permission to view this page. Your account is not whitelisted.
        </div>
        <a 
          href="/login"
          style={{
            display: 'inline-block',
            padding: '12px 20px',
            minHeight: '44px',
            backgroundColor: 'var(--blue)',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '999px',
            fontWeight: 600,
          }}
        >
          Return to Sign In
        </a>
      </div>
    </div>
  );
}
