import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { signSession, verifySession, isSessionSecretConfigured } from '../../../../lib/session';
import { getMockConfig, addActiveSession, removeActiveSession, getActiveSessions } from '../../../../lib/mockStore';
import { checkUserAccess } from '../../../../lib/auth';
import { getUserRoleFromFirestore } from '../../../../lib/whitelist';
import { recordAccessLog } from '../../../../lib/accessLog';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const checkEmail = searchParams.get('checkEmail');
  
  if (checkEmail) {
    const isAllowed = await checkUserAccess(checkEmail);
    if (!isAllowed) {
      const ip = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1';
      await recordAccessLog({
        email: checkEmail,
        action: 'Login Attempt (Blocked: Not Whitelisted)',
        type: 'login',
        status: 'Denied',
        ip
      });
    }
    return NextResponse.json({ allowed: isAllowed });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('__session')?.value;
  const session = await verifySession(token);

  const isDev = process.env.NODE_ENV !== 'production';
  const activeSessions = getActiveSessions();
  const isActive = !isDev || activeSessions.includes(token);

  if (session && isActive) {
    const email = session.email.trim().toLowerCase();
    const { getUserRoleFromFirestore } = await import('../../../../lib/whitelist.js');
    const role = await getUserRoleFromFirestore(email);
    return NextResponse.json({ user: { email: session.email, role } });
  }
  return NextResponse.json({ user: null });
}

export async function POST(request) {
  const mockConfig = getMockConfig();

  // Simulate Broken Auth mode
  if (mockConfig.mode === 'broken' && mockConfig.brokenType === 'auth') {
    return NextResponse.json({ error: 'Auth failed (Simulated)' }, { status: 500 });
  }

  // Without a signing key we cannot issue a trustworthy cookie. Say so plainly
  // rather than failing later as a login -> redirect loop.
  if (!isSessionSecretConfigured()) {
    console.error('SESSION_SECRET is not set; login is disabled.');
    return NextResponse.json(
      { error: 'Server misconfigured: SESSION_SECRET is not set' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const email = body.email;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const trimmedEmail = email.trim();

    const token = await signSession(trimmedEmail);

    // Track this session token
    addActiveSession(token);

    const cookieStore = await cookies();
    cookieStore.set('__session', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    // Log Login Success (awaited direct write so sign-ins are reliably recorded)
    const ip = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1';
    await recordAccessLog({
      email: trimmedEmail,
      action: 'Login Success',
      type: 'login',
      status: 'Success',
      ip
    });

    return NextResponse.json({ success: true, user: { email: trimmedEmail } });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__session')?.value;
  
  let email = 'unknown';
  if (token) {
    const session = await verifySession(token);
    if (session) {
      email = session.email;
    }
    removeActiveSession(token);
  }

  cookieStore.set('__session', '', {
    path: '/',
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax'
  });

  // Log Logout (awaited direct write)
  const ip = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1';
  await recordAccessLog({
    email,
    action: 'Logout',
    type: 'login',
    status: 'Success',
    ip
  });

  return NextResponse.json({ success: true });
}

