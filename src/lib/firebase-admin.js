// Server-only Firestore access through the Firebase Admin SDK.
//
// The Admin SDK authenticates as a service account and bypasses
// firestore.rules, which is what lets the rules deny every client request.
// On Firebase App Hosting it needs no key file: it picks up the compute
// service account through Application Default Credentials. Never import this
// from a client component.
import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function resolveProjectId() {
  try {
    const cfg = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
    if (cfg.projectId) return cfg.projectId;
  } catch {
    /* fall through */
  }
  return (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    'sales-intel-cdv-2026'
  );
}

let db = null;

// Lazy, so importing this module never fails a build or a cold start; a
// missing credential surfaces on the first query, where callers already
// handle Firestore being unavailable.
export function getAdminDb() {
  if (db) return db;
  if (getApps().length === 0) {
    initializeApp({ projectId: resolveProjectId() });
  }
  db = getFirestore(getApp());
  return db;
}

export { FieldValue };

// Rejects when a Firestore call takes too long, so a slow or unreachable
// database degrades to the caller's fallback instead of hanging the request.
export function withTimeout(promise, timeoutMs = 10000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Firestore operation timeout')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
