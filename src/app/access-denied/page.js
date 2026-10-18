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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--background-dark)', color: 'var(--text-primary)' }}>
      <div style={{ backgroundColor: 'var(--surface-dark)', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center', width: '380px' }}>
        <h1 style={{ marginBottom: '16px', fontSize: '1.8rem', fontWeight: 'bold', color: '#ef4444' }}>Access Denied</h1>
        <div id="denied-container" style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem', lineHeight: '1.5' }}>
          You do not have permission to view this page. Your account is not whitelisted.
        </div>
        <a 
          href="/login"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '4px',
            fontWeight: '600',
            transition: 'background-color 0.2s',
          }}
        >
          Return to Sign In
        </a>
      </div>
    </div>
  );
}
