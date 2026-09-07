import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { verifySession } from '@/lib/session';
import { getUserRoleFromFirestore, getWhitelistedUsersFromFirestore } from '@/lib/whitelist';

// How far back (days) a user's last activity may be for them to count as "active".
const ACTIVE_WINDOW_DAYS = 30;
// Upper bound on log rows scanned for the per-user roll-up.
const SCAN_LIMIT = 5000;

// Mirrors the client/DELETE test-payload heuristic so synthetic security-test
// traffic does not get reported as a real person using the app.
function isTestPayload(email) {
  if (!email || typeof email !== 'string') return true;
  const clean = email.toLowerCase();
  return (
    clean.includes('<script>') ||
    clean.includes("' or '") ||
    clean.includes('aaaaa') ||
    clean.includes('example.com') ||
    clean.includes('evil.com') ||
    clean === 'undefined' ||
    clean === 'unknown' ||
    clean === 'anonymous'
  );
}

function emptyStats() {
  return {
    loginSuccess: 0,
    loginDenied: 0,
    accessAllowed: 0,
    accessDenied: 0,
    totalEvents: 0,
    lastLogin: null,
    lastActivity: null,
  };
}

function toIso(ts) {
  try {
    if (ts && typeof ts.toDate === 'function') return ts.toDate().toISOString();
  } catch {
    /* ignore malformed timestamps */
  }
  return null;
}

function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export async function GET(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requesterEmail = session.email.trim().toLowerCase();
  const requesterRole = await getUserRoleFromFirestore(requesterEmail);
  if (requesterRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 1) Registered users (source of truth for the roster).
  let registered = [];
  try {
    registered = await getWhitelistedUsersFromFirestore();
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load registered users', details: err.message },
      { status: 500 }
    );
  }

  // 2) Aggregate activity per email across the log history.
  const statsByEmail = new Map();
  let scannedRows = 0;
  let logsError = null;
  try {
    const logsRef = collection(db, 'access_logs');
    const snap = await getDocs(query(logsRef, orderBy('timestamp', 'desc'), limit(SCAN_LIMIT)));
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const email = (d.email || '').trim().toLowerCase();
      if (!email) return;
      scannedRows++;
      const iso = toIso(d.timestamp);
      const s = statsByEmail.get(email) || emptyStats();
      s.totalEvents++;
      s.lastActivity = newer(s.lastActivity, iso);
      const status = (d.status || '').toLowerCase();
      if (d.type === 'login') {
        if (status === 'success') {
          s.loginSuccess++;
          s.lastLogin = newer(s.lastLogin, iso);
        } else if (status === 'denied') {
          s.loginDenied++;
        }
      } else {
        if (status === 'denied') s.accessDenied++;
        else s.accessAllowed++;
      }
      statsByEmail.set(email, s);
    });
  } catch (err) {
    logsError = err.message;
  }

  const activeCutoff = Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const isActive = (lastActivity) =>
    !!lastActivity && new Date(lastActivity).getTime() >= activeCutoff;

  // 3) Join roster with activity. Drop synthetic security-test / seed
  //    accounts (e.g. *@example.com) so the roster shows real people only.
  const seen = new Set();
  const users = registered
    .map((u) => (typeof u === 'string' ? u : u.email).trim().toLowerCase())
    .filter((email) => email && !isTestPayload(email))
    .map((email) => {
      const u = registered.find((r) => (typeof r === 'string' ? r : r.email).trim().toLowerCase() === email);
      seen.add(email);
    const s = statsByEmail.get(email) || emptyStats();
    return {
      email,
      role: typeof u === 'string' ? 'viewer' : u.role || 'viewer',
      hasLoggedIn: s.loginSuccess > 0,
      loginCount: s.loginSuccess,
      lastLogin: s.lastLogin,
      lastActivity: s.lastActivity,
      totalEvents: s.totalEvents,
      active: isActive(s.lastActivity),
    };
  });

  // Sort: active first, then anyone who has logged in, then by email.
  users.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.hasLoggedIn !== b.hasLoggedIn) return a.hasLoggedIn ? -1 : 1;
    return a.email.localeCompare(b.email);
  });

  // 4) Non-registered people who actually logged in (excludes test payloads).
  const others = [];
  for (const [email, s] of statsByEmail.entries()) {
    if (seen.has(email)) continue;
    if (s.loginSuccess === 0) continue;
    if (isTestPayload(email)) continue;
    others.push({
      email,
      loginCount: s.loginSuccess,
      lastLogin: s.lastLogin,
      lastActivity: s.lastActivity,
      totalEvents: s.totalEvents,
      active: isActive(s.lastActivity),
    });
  }
  others.sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0));

  return NextResponse.json({
    users,
    others,
    scannedRows,
    activeWindowDays: ACTIVE_WINDOW_DAYS,
    generatedAt: new Date().toISOString(),
    ...(logsError ? { logsError } : {}),
  });
}
