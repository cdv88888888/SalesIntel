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
        border: "3px solid var(--trk)",
        borderTopColor: "var(--blue)",
        animation: "spin 1s linear infinite"
      }}></div>
      <span style={{ color: "var(--muted)", fontSize: "13px" }}>Loading feed...</span>
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
});

export default CrmUpdatesStream;
