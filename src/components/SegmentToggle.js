"use client";

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function SegmentToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segment = searchParams.get('segment') || 'dealer';
  const [isPending, startTransition] = useTransition();
  const [pendingSegment, setPendingSegment] = useState(null);

  const handleToggle = (newSegment) => {
    if (segment === newSegment) return;
    
    setPendingSegment(newSegment);
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      params.set('segment', newSegment);
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '20px',
    padding: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    marginLeft: 'auto',
  };

  const btnStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '6px 16px',
    borderRadius: '16px',
    border: 'none',
    background: isActive ? 'var(--primary-accent)' : 'transparent',
    color: isActive ? '#fff' : 'var(--text-secondary)',
    fontWeight: isActive ? '600' : '400',
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    opacity: isPending ? 0.7 : 1,
  });

  return (
    <>
      {/* Full Page Progress Bar Overlay */}
      {isPending && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
        }}>
          <Loader2 size={48} className="animate-spin" style={{ color: 'var(--primary-accent)', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 500 }}>Loading Data...</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>
            Fetching real-time aggregates for {pendingSegment}s.
          </p>
        </div>
      )}

      <div style={containerStyle}>
        <button 
          style={btnStyle(segment === 'dealer')} 
          onClick={() => handleToggle('dealer')}
          disabled={isPending}
        >
          {isPending && pendingSegment === 'dealer' && <Loader2 size={14} className="animate-spin" />}
          Dealer
        </button>
        <button 
          style={btnStyle(segment === 'commercial')} 
          onClick={() => handleToggle('commercial')}
          disabled={isPending}
        >
          {isPending && pendingSegment === 'commercial' && <Loader2 size={14} className="animate-spin" />}
          Commercial
        </button>
        <button 
          style={btnStyle(segment === 'bulk')} 
          onClick={() => handleToggle('bulk')}
          disabled={isPending}
        >
          {isPending && pendingSegment === 'bulk' && <Loader2 size={14} className="animate-spin" />}
          Bulk
        </button>
      </div>
    </>
  );
}
