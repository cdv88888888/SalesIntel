"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CustomerMultiSelect({ availableDealers, selectedCustomers }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  const handleSelect = (dealerId) => {
    const params = new URLSearchParams(searchParams.toString());
    const newSelected = [...selectedCustomers, dealerId];
    params.set('customer', newSelected.join(','));
    router.push(`?${params.toString()}`, { scroll: false });
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleRemove = (dealerId) => {
    const params = new URLSearchParams(searchParams.toString());
    const newSelected = selectedCustomers.filter(id => id !== dealerId);
    if (newSelected.length > 0) {
      params.set('customer', newSelected.join(','));
    } else {
      params.delete('customer');
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const filteredDealers = availableDealers
    .filter(d => !selectedCustomers.includes(d.id))
    .filter(d => d.name && d.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 50); // Limit to 50 results for performance

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      
      {/* Search Input */}
      <input
        type="text"
        placeholder="Search and select dealers..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onClick={() => setIsOpen(true)}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: 'var(--input-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          color: 'var(--text-primary)',
          fontSize: '0.95rem',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 2px var(--primary-accent)' : 'none',
          transition: 'box-shadow 0.2s ease'
        }}
      />

      {/* Selected Pills */}
      {selectedCustomers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
          {selectedCustomers.map(id => {
            const dealer = availableDealers.find(d => d.id === id);
            return (
              <div key={id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--primary-accent)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '0.8rem',
                fontWeight: '500'
              }}>
                <span style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {dealer ? dealer.name : id}
                </span>
                <button
                  onClick={() => handleRemove(id)}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '14px',
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '46px',
          left: 0,
          right: 0,
          background: 'var(--surface-dark)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 50,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
        }}>
          {filteredDealers.length === 0 ? (
            <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
              No dealers found
            </div>
          ) : (
            filteredDealers.map(dealer => (
              <div
                key={dealer.id}
                onClick={() => handleSelect(dealer.id)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {dealer.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
