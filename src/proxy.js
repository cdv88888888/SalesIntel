import { NextResponse } from 'next/server';
import { verifySession } from './lib/session';
import { isPermanentAdmin } from './lib/admins';
import { getAdminDb, FieldValue, withTimeout } from './lib/firebase-admin';

const PROTECTED_PREFIXES = ['/intelligence', '/account-sync', '/alerts', '/risk', '/settings', '/predictive-ai', '/proactive', '/admin', '/gemini-ai', '/api/chat', '/api/settings', '/api/whitelist', '/api/admin', '/api/monday-updates', '/api/alerts'];

// Module-level in-memory cache for the Firestore whitelist (15s TTL)
let cachedWhitelist = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15000;

const DEFAULT_WHITELIST = [
  { email: 'cdv@masaganagas.com', role: 'admin' },
  { email: 'maclaire.jabines@masaganagas.com', role: 'viewer' },
  { email: 'janalbert.santos@masaganagas.com', role: 'admin' },
  { email: 'anton.antonio@masaganagas.com', role: 'viewer' },
  { email: 'melroziene.dorio@masaganagas.com', role: 'viewer' },
  { email: 'patrick.yao@masaganagas.com', role: 'viewer' },
  { email: 'marialourdes.jordan@masaganagas.com', role: 'viewer' },
  { email: 'nora.sulit@masaganagas.com', role: 'viewer' },
  { email: 'anna.neri@masaganagas.com', role: 'viewer' },
  { email: 'hanes.llamas@masaganagas.com', role: 'viewer' },
  { email: 'jenette.morente@masaganagas.com', role: 'viewer' },
  { email: 'richardyao@masaganagas.com', role: 'viewer' },
  { email: 'kristinelara.rizos@masaganagas.com', role: 'viewer' },
  { email: 'altheamarie.eda@masaganagas.com', role: 'viewer' },
  { email: 'beatriz.maayo@masaganagas.com', role: 'viewer' }
];

function getStaticFallbackWhitelist() {
  if (process.env.AUTH_WHITELIST) {
    return process.env.AUTH_WHITELIST.split(',')
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0)
      .map(entry => {
        const parts = entry.split(':');
        const email = parts[0].trim().toLowerCase();
        const role = parts[1] ? parts[1].trim() : ((email === 'cdv@masaganagas.com' || email === 'team@example.com') ? 'admin' : 'viewer');
        return { email, role };
      });
  }
  return DEFAULT_WHITELIST;
}

async function fetchWhitelistedUsers() {
  const now = Date.now();
  if (cachedWhitelist !== null && (now - lastCacheTime) < CACHE_TTL_MS) {
    return cachedWhitelist;
  }

  // Read through the Admin SDK: firestore.rules denies unauthenticated
  // requests, so the public REST endpoint no longer answers.
  try {
    const snapshot = await withTimeout(getAdminDb().collection('whitelisted_users').get(), 3000);
    if (!snapshot.empty) {
      const parsed = snapshot.docs.map(doc => {
        const data = doc.data() || {};
        const email = typeof data.email === 'string' && data.email ? data.email : doc.id;
        const role = typeof data.role === 'string' && data.role ? data.role : 'viewer';
        return { email: email.toLowerCase(), role };
      });
      const fallback = getStaticFallbackWhitelist();
      fallback.forEach(item => {
        if (!parsed.some(p => p.email === item.email)) {
          parsed.push(item);
        }
      });
      cachedWhitelist = parsed;
      lastCacheTime = Date.now();
      return parsed;
    }
  } catch (err) {
    console.error('[PROXY_FIRESTORE_ERROR] Failed reading the whitelist from Firestore, using fallback:', err?.message || err);
  }

  const fallback = getStaticFallbackWhitelist();
  cachedWhitelist = fallback;
  lastCacheTime = Date.now();
  return fallback;
}

async function logAccess(request, email, path, isAllowed, reason = '') {
  const ip = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1';

  // Write the access event straight to Firestore with the Admin SDK (Proxy
  // runs on the Node.js runtime). Awaited and wrapped so logging can never
  // break navigation.
  try {
    await withTimeout(getAdminDb().collection('access_logs').add({
      email: String(email || 'unknown').trim().toLowerCase(),
      action: `Access ${path}${reason ? ` (${reason})` : ''}`,
      type: 'access',
      status: isAllowed ? 'Allowed' : 'Denied',
      ip: ip || 'unknown',
      timestamp: FieldValue.serverTimestamp(),
    }), 3000);
  } catch (err) {
    console.error('[PROXY_ACCESS_LOG_ERROR] Failed to write access log:', err?.message || err);
  }
}

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;

  // Normalize pathname to handle multiple slashes and lowercasing for case-insensitive route matching
  const cleanPath = pathname.replace(/\/+/g, '/');
  const lowerPath = cleanPath.toLowerCase();

  // Bypass middleware checks for internal Next.js assets, favicon, mock/auth APIs,
  // and the POST logging API to avoid infinite loops
  const isMockOrAuth = lowerPath.startsWith('/api/mock') || 
                       lowerPath.startsWith('/api/auth') || 
                       (lowerPath === '/api/admin/logs' && request.method === 'POST') ||
                       lowerPath.startsWith('/_next') ||
                       lowerPath === '/favicon.ico';

  if (isMockOrAuth) {
    return NextResponse.next();
  }

  console.log(`[PROXY_DEBUG] cleanPath: ${cleanPath}`);

  // Fetch mock state during development/testing, but query Firestore first
  let mockConfig = { mode: 'correct', brokenType: null };
  let whitelist = await fetchWhitelistedUsers();
  let activeSessions = [];
  
  if (process.env.NODE_ENV !== 'production' || process.env.TESTING_MODE === 'true') {
    try {
      const stateRes = await fetch(new URL(`/api/mock/state?t=${Date.now()}`, request.nextUrl.origin), {
        cache: 'no-store',
        next: { revalidate: 0 },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (stateRes.ok) {
        const data = await stateRes.json();
        mockConfig = data.config || mockConfig;
        if (data.whitelist && data.whitelist.length > 0) {
          whitelist = data.whitelist;
        }
        activeSessions = data.activeSessions || activeSessions;
      }
    } catch (e) {
      // Fallback if API is not initialized yet
    }
  }

  // Handle server-wide simulated crashes
  if (mockConfig.mode === 'broken' && mockConfig.brokenType === 'server') {
    return new Response('Internal Server Error (Simulated)', { status: 500 });
  }

  // Determine if it is a protected path
  const isRoot = lowerPath === '/';
  const isProtected = isRoot || PROTECTED_PREFIXES.some(prefix => lowerPath.startsWith(prefix));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Read session token
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);

  const isDev = process.env.NODE_ENV !== 'production';
  const isActive = !isDev || activeSessions.includes(token);

  if (!session || !isActive) {
    // Unauthenticated
    await logAccess(request, 'anonymous', cleanPath, false, 'Unauthenticated');

    if (lowerPath.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    } else {
      const searchParams = new URLSearchParams(search);
      searchParams.delete('_rsc');
      const cleanSearch = searchParams.toString();
      const callbackUrl = encodeURIComponent(cleanPath + (cleanSearch ? `?${cleanSearch}` : ''));
      const loginUrl = new URL(`/login?callbackUrl=${callbackUrl}`, request.url);
      return NextResponse.redirect(loginUrl, { status: 307 });
    }
  }

  // Authenticated - check whitelist
  const email = session.email.trim().toLowerCase();
  const userRecord = whitelist.find(e => {
    if (typeof e === 'string') return e.trim().toLowerCase() === email;
    return e.email.trim().toLowerCase() === email;
  });
  
  let isAllowed = !!userRecord;
  let role = 'viewer';
  if (userRecord && typeof userRecord !== 'string') {
    role = userRecord.role;
  }
  // A locked account is an admin whatever the whitelist row says, and is never
  // shut out of the screen that manages the whitelist.
  if (isPermanentAdmin(email)) {
    isAllowed = true;
    role = 'admin';
  }

  // Apply broken modes for authorization
  if (mockConfig.mode === 'broken') {
    if (mockConfig.brokenType === 'whitelist') {
      isAllowed = true; // allow everyone
      role = 'admin';
    } else if (mockConfig.brokenType === 'access-denied') {
      isAllowed = false; // deny everyone
    }
  }

  // Role-based Access Control (RBAC): only admins can access settings and admin dashboard
  if (isAllowed && role !== 'admin') {
    const isAdminOrSettings = lowerPath.startsWith('/settings') || 
                              lowerPath.startsWith('/api/settings') || 
                              lowerPath.startsWith('/api/whitelist') ||
                              lowerPath.startsWith('/admin') ||
                              lowerPath.startsWith('/api/admin');
    if (isAdminOrSettings) {
      isAllowed = false;
    }
  }

  // Log the access!
  await logAccess(request, email, cleanPath, isAllowed, isAllowed ? '' : 'RBAC Denied');

  if (isAllowed) {
    return NextResponse.next();
  } else {
    // Unauthorized
    if (lowerPath.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else {
      // Clear session on server (bridge to Node.js api)
      if (token && isDev && !userRecord) {
        try {
          await fetch(new URL('/api/auth/session', request.nextUrl.origin), {
            method: 'DELETE',
            headers: { 'Cookie': `__session=${token}` }
          });
        } catch (e) {
          // ignore
        }
      }

      // Redirect to access-denied
      const response = NextResponse.redirect(new URL('/access-denied', request.url), { status: 307 });
      
      // Only clear cookie if they are completely unauthorized (not in whitelist).
      // Do not clear cookie if they are merely RBAC denied (e.g. viewer accessing /settings).
      if (!userRecord) {
        response.cookies.set('__session', '', {
          path: '/',
          expires: new Date(0),
          httpOnly: true,
          sameSite: 'lax'
        });
      }
      return response;
    }
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
