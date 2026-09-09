"use client";

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { SEGMENTS, normalizeSegment, segmentLabel } from '../lib/segments';

/**
 * Segment chips rendered beneath a page in the sidebar.
 *
 * - `pageHref`: the page these chips navigate to (e.g. "/risk").
 * - `segments`: the segment ids offered for this page (defaults to all, incl. "all").
 * - `onNavigate`: optional callback fired when a chip triggers navigation.
 *
 * The highlighted chip only reflects the URL when the chips belong to the
 * page currently being viewed; chips under other pages are plain links into
 * that page with the chosen segment.
 */
export default function SegmentToggle({ pageHref = '/', segments = SEGMENTS.map(s => s.id), onNavigate }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingSegment, setPendingSegment] = useState(null);

  const isCurrentPage = pathname === pageHref;
  const currentSegment = normalizeSegment(searchParams.get('segment'));
  const options = SEGMENTS.filter(s => segments.includes(s.id));

  const handleToggle = (newSegment) => {
    if (isCurrentPage && currentSegment === newSegment) return;

    setPendingSegment(newSegment);
    if (onNavigate) onNavigate();
    startTransition(() => {
      // Keep the page's other filters (date range, customers, sort) when only
      // the segment changes; start clean when jumping to another page.
      const params = isCurrentPage ? new URLSearchParams(searchParams) : new URLSearchParams();
      params.set('segment', newSegment);
      router.push(`${pageHref}?${params.toString()}`);
    });
  };

  const rowStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 0 6px 36px',
  };

  const chipStyle = (isActive) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '3px 9px',
    borderRadius: '999px',
    border: `1px solid ${isActive ? 'var(--primary-accent)' : 'var(--border-color)'}`,
    background: isActive ? 'var(--primary-accent)' : 'transparent',
    color: isActive ? '#fff' : 'var(--text-secondary)',
    fontWeight: isActive ? 600 : 400,
    fontSize: '0.72rem',
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
    cursor: isPending ? 'wait' : 'pointer',
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
            {pendingSegment === 'all'
              ? 'Fetching real-time aggregates for all segments.'
              : `Fetching real-time aggregates for ${segmentLabel(pendingSegment).toLowerCase()}s.`}
          </p>
        </div>
      )}

      <div style={rowStyle} role="group" aria-label="Segment">
        {options.map(({ id, label }) => {
          const isActive = isCurrentPage && currentSegment === id;
          return (
            <button
              key={id}
              type="button"
              style={chipStyle(isActive)}
              onClick={() => handleToggle(id)}
              disabled={isPending}
              aria-pressed={isActive}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              {isPending && pendingSegment === id && <Loader2 size={12} className="animate-spin" />}
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}
