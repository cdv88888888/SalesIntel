"use client";

import dynamic from 'next/dynamic';

const CrmUpdatesStream = dynamic(() => import('./CrmUpdatesStream'), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px", alignItems: "center" }}>
      <div style={{
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        border: "3px solid rgba(255, 255, 255, 0.1)",
        borderTopColor: "var(--primary-accent)",
        animation: "spin 1s linear infinite"
      }}></div>
      <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Loading feed...</span>
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
});

export default CrmUpdatesStream;
