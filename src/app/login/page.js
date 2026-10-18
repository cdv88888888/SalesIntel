'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginUser } from '../../lib/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const urlParam = searchParams.get('callbackUrl');
  const callbackUrl = (
    urlParam &&
    urlParam.startsWith('/') &&
    !urlParam.startsWith('//') &&
    !urlParam.startsWith('/login') &&
    !urlParam.startsWith('/access-denied') &&
    !urlParam.includes(':')
  ) ? urlParam : '/';

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      await loginUser();
      router.push(callbackUrl);
    } catch (err) {
      console.error(err);
      if (err.message === 'NOT_WHITELISTED') {
        router.push('/access-denied');
      } else {
        setError(err.message || 'An error occurred during sign-in.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--background-dark)', color: 'var(--text-primary)' }}>
      <div style={{ backgroundColor: 'var(--surface-dark)', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center', width: '360px' }}>
        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>MGC Sales Intelligence</h1>
        </div>
        
        {error && (
          <div style={{ backgroundColor: '#fecaca', color: '#dc2626', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: '#fff',
            color: '#3c4043',
            border: '1px solid #dadce0',
            borderRadius: '4px',
            fontWeight: '500',
            fontSize: '15px',
            fontFamily: 'Roboto, arial, sans-serif',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'background-color 0.2s, box-shadow 0.2s',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 1px 2px 0 rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)'
          }}
          onMouseOver={(e) => {
            if(!loading) e.currentTarget.style.backgroundColor = '#f8f9fa';
            if(!loading) e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(60,64,67,0.30), 0 4px 8px 3px rgba(60,64,67,0.15)';
          }}
          onMouseOut={(e) => {
            if(!loading) e.currentTarget.style.backgroundColor = '#fff';
            if(!loading) e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)';
          }}
        >
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{display: 'block', width: '18px', height: '18px'}}>
            <g><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></g>
          </svg>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        {process.env.NODE_ENV === 'development' && (
          <button 
            onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch('/api/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: 'cdv@masaganagas.com' })
                });
                if (res.ok) {
                  router.push(callbackUrl);
                } else {
                  setError('Failed to bypass login');
                  setLoading(false);
                }
              } catch(e) {
                setError(e.message);
                setLoading(false);
              }
            }}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: '4px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background-color 0.2s',
            }}
          >
            Skip Login (Dev Only)
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-primary)', textAlign: 'center', marginTop: '20%' }}>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
