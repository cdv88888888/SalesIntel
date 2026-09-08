import { db } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Write an access/login event directly to the Firestore `access_logs`
 * collection. This replaces the previous fire-and-forget self-fetch to
 * `/api/admin/logs`, which depended on internal URL resolution and a shared
 * secret and silently dropped events when either failed.
 *
 * Awaited by callers so a login is reliably recorded before the response is
 * returned. Never throws: logging must not break authentication.
 *
 * @param {{ email?: string, action: string, type?: string, status?: string, ip?: string }} entry
 * @returns {Promise<boolean>} true if the write succeeded
 */
export async function recordAccessLog({ email, action, type = 'access', status = 'Allowed', ip = 'unknown' }) {
  try {
    if (!email || !action) return false;
    await addDoc(collection(db, 'access_logs'), {
      email: String(email).trim().toLowerCase(),
      action,
      type,
      status,
      ip: ip || 'unknown',
      timestamp: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('[ACCESS_LOG] Failed to write access log:', err?.message || err);
    return false;
  }
}
