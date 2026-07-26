"use client";

import Link from "next/link";
import styles from "./intelligence.module.css";
import { useClientDrawer } from "../../context/ClientDrawerContext";

export default function DealerRow({ dealer, startPeriod, endPeriod, target }) {
  const { openClient } = useClientDrawer();

  return (
    <>
      <tr 
        onClick={() => openClient(dealer)}
        style={{ cursor: "pointer" }}
      >
        <td style={{ fontWeight: 500 }}>
          <span 
            onClick={() => openClient(dealer)} 
            style={{ color: "var(--primary-accent)", textDecoration: "underline", cursor: "pointer" }}
          >
            {dealer.name || "Unknown"}
          </span>
        </td>
        <td>
          <span className={`${styles.badge} ${dealer.classification === 'Exclusive' ? styles.badgeExclusive : styles.badgeStandard}`}>
            {dealer.classification || "Standard"}
          </span>
        </td>
        <td>{dealer.kgsSold?.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</td>
        <td style={{ color: "var(--text-secondary)" }}>{dealer.prevKgsSold ? `${dealer.prevKgsSold.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg` : "N/A"}</td>
        <td style={{ color: "var(--text-secondary)" }}>{target > 0 ? `${target.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg` : "N/A"}</td>
        <td>
          <button 
            className={styles.iconButton}
            title="View Intelligence"
            onClick={(e) => {
              e.stopPropagation();
              openClient(dealer);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </td>
      </tr>
    </>
  );
}
