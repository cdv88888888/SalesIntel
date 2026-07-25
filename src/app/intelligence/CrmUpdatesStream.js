"use client";

import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import styles from "./intelligence.module.css";

const sanitizeHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  if (typeof window !== 'undefined' && DOMPurify && DOMPurify.sanitize) {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'br', 'span', 'div', 'img'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'src', 'alt', 'title', 'width', 'height']
    });
  }
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
};

// Helper to format relative time
const getRelativeTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
};

export default function CrmUpdatesStream() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/monday-updates/stream")
      .then((res) => res.json())
      .then((data) => {
        setUpdates(data.updates || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch CRM updates stream:", err);
        setLoading(false);
      });
  }, []);

  return (
    <section className={styles.updatesFeed} style={{ width: "100%" }}>
      <div className={styles.feedHeader}>
        <h4>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          CRM Updates Stream
        </h4>
        {updates.length > 0 && (
          <span className={styles.feedBadge}>{updates.length}</span>
        )}
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <span>Loading feed...</span>
        </div>
      ) : updates.length === 0 ? (
        <div className={styles.emptyState}>
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <strong>No updates yet</strong>
          <span style={{ fontSize: '0.85rem' }}>Updates from Monday.com will appear here once posted.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "65vh", overflowY: "auto", paddingRight: "4px" }}>
          {updates.map((update) => {
            const initials = (update.creator?.name || 'User')
              .split(' ')
              .map(n => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            
            const colors = ['#10b981', '#8b5cf6', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6'];
            const avatarColor = colors[(update.creator?.name?.length || 0) % colors.length];

            return (
              <div key={update.id} className={styles.updateCard} style={{ background: "rgba(255, 255, 255, 0.015)" }}>
                <div className={styles.updateAuthorRow}>
                  <div 
                    className={styles.avatarCircle} 
                    style={{ 
                      backgroundColor: avatarColor,
                      backgroundImage: update.creator?.photo_original ? `url(${update.creator.photo_original})` : 'none'
                    }}
                  >
                    {!update.creator?.photo_original && initials}
                  </div>
                  <div className={styles.authorMeta}>
                    <span className={styles.authorName}>{update.creator?.name || 'Unknown User'}</span>
                    <span className={styles.updateTime}>{getRelativeTime(update.createdAt)}</span>
                  </div>
                </div>

                <div style={{ fontSize: "0.85rem", color: "var(--primary-accent)", fontWeight: 600, background: "rgba(99, 102, 241, 0.08)", padding: "4px 8px", borderRadius: "4px", alignSelf: "flex-start" }}>
                  📍 {update.itemName}
                </div>
                
                <div 
                  className={styles.updateContent} 
                  style={{ fontSize: "0.9rem" }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(update.body) }}
                />

                <div className={styles.cardInteractions} style={{ borderTop: "1px solid rgba(255, 255, 255, 0.03)", paddingTop: "10px", marginTop: "4px" }}>
                  {update.mondayUrl ? (
                    <a 
                      href={update.mondayUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={styles.mondayLinkBtn}
                      style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                      Open in Monday.com
                    </a>
                  ) : (
                    <div></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
