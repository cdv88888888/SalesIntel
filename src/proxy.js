import { NextResponse } from 'next/server';
import { verifySession } from './lib/session';

const PROTECTED_PREFIXES = ['/intelligence', '/settings', '/predictive-ai', '/proactive', '/admin', '/api/settings', '/api/whitelist', '/api/admin'];

function logAccess(request, email, path, isAllowed, reason = '') {
  const secret = process.env.SESSION_SECRET || 'mgc-sales-intelligence-session-secret-2026-prod-secret';
  const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';
  
  // Non-blocking fetch to logging route handler
  fetch(new URL('/api/admin/logs', request.nextUrl.origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': secret
    },
    body: JSON.stringify({
      email: email || 'unknown',
      action: `Access ${path}${reason ? ` (${reason})` : ''}`,
      type: 'access',
      status: isAllowed ? 'Allowed' : 'Denied',
      ip
    })
  }).catch(err => {
    console.error('Middleware logging failed:', err);
  });
}

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;

  // Normalize pathname to handle multiple slashes
  const cleanPath = pathname.replace(/\/+/g, '/');

  // Bypass middleware checks for internal Next.js assets, favicon, mock/auth APIs,
  // and the POST logging API to avoid infinite loops
  const isMockOrAuth = cleanPath.startsWith('/api/mock') || 
                       cleanPath.startsWith('/api/auth') || 
                       (cleanPath === '/api/admin/logs' && request.method === 'POST') ||
                       cleanPath.startsWith('/_next') ||
                       cleanPath === '/favicon.ico';

  if (isMockOrAuth) {
    return NextResponse.next();
  }

  // Fetch mock state during development/testing
  let mockConfig = { mode: 'correct', brokenType: null };
  let whitelist = [
    { email: 'cdv@masaganagas.com', role: 'admin' },
    { email: 'maclaire.jabines@masaganagas.com', role: 'viewer' },
    { email: 'janalbert.santos@masaganagas.com', role: 'viewer' },
    { email: 'anton.antonio@masaganagas.com', role: 'viewer' },
    { email: 'melroziene.dorio@masaganagas.com', role: 'viewer' },
    { email: 'patrick.yao@masaganagas.com', role: 'viewer' },
    { email: 'marialourdes.jordan@masaganagas.com', role: 'viewer' },
    { email: 'nora.sulit@masaganagas.com', role: 'viewer' },
    { email: 'anna.neri@masaganagas.com', role: 'viewer' },
    { email: 'hanes.llamas@masaganagas.com', role: 'viewer' },
    { email: 'team@example.com', role: 'viewer' },
    { email: 'allowed@example.com', role: 'viewer' },
    { email: 'admin@cdv-sales-intelligence.com', role: 'viewer' }
  ];
  let activeSessions = [];
  
  if (process.env.NODE_ENV === 'production') {
    if (process.env.AUTH_WHITELIST) {
      whitelist = process.env.AUTH_WHITELIST.split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0)
        .map(email => ({ email, role: email === 'cdv@masaganagas.com' ? 'admin' : 'viewer' }));
    }
  } else {
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
        whitelist = data.whitelist || whitelist;
        activeSessions = data.activeSessions || activeSessions;
      }
    } catch (e) {
      // Fallback if API is not initialized yet
    }
  }

  // Handle server-wide simulated crashes (CRITICAL: applies to all other paths)
  if (mockConfig.mode === 'broken' && mockConfig.brokenType === 'server') {
    return new Response('Internal Server Error (Simulated)', { status: 500 });
  }

  // Bypass route guard checks if broken-guard is active
  if (mockConfig.mode === 'broken' && mockConfig.brokenType === 'guard') {
    if (cleanPath === '/api/settings') {
      return NextResponse.json({ settings: { theme: 'dark', notifications: true } });
    } else {
      return new Response(`<html><body><h1>${cleanPath}</h1><div id="content">Protected content loaded (Guard bypassed)</div></body></html>`, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // Determine if it is a protected path
  const isRoot = cleanPath === '/';
  const isProtected = isRoot || PROTECTED_PREFIXES.some(prefix => cleanPath.startsWith(prefix));

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
    logAccess(request, 'anonymous', cleanPath, false, 'Unauthenticated');

    if (cleanPath.startsWith('/api/')) {
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
    const isAdminOrSettings = cleanPath.startsWith('/settings') || 
                              cleanPath.startsWith('/api/settings') || 
                              cleanPath.startsWith('/api/whitelist') ||
                              cleanPath.startsWith('/admin') ||
                              cleanPath.startsWith('/api/admin');
    if (isAdminOrSettings) {
      isAllowed = false;
    }
  }

  // Log the access!
  logAccess(request, email, cleanPath, isAllowed, isAllowed ? '' : 'RBAC Denied');

  if (isAllowed) {
    return NextResponse.next();
  } else {
    // Unauthorized
    if (cleanPath.startsWith('/api/')) {
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


