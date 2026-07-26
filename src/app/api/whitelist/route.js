import { NextResponse } from 'next/server';
import { 
  getWhitelistedUsersFromFirestore, 
  addWhitelistedUserToFirestore, 
  removeWhitelistedUserFromFirestore,
  getUserRoleFromFirestore
} from '@/lib/whitelist.js';
import { verifySession } from '@/lib/session';

const ALLOWED_ADMINS = ['cdv@masaganagas.com', 'janalbert.santos@masaganagas.com'];

function isAllowedUser(email) {
  if (!email) return false;
  return ALLOWED_ADMINS.includes(email.trim().toLowerCase());
}

export async function GET(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);
  
  if (!session || !isAllowedUser(session.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const whitelist = await getWhitelistedUsersFromFirestore();
    return NextResponse.json({ whitelist });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch whitelist' }, { status: 500 });
  }
}

export async function POST(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);
  
  if (!session || !isAllowedUser(session.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { email, role } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const whitelist = await addWhitelistedUserToFirestore(email, role || 'viewer');
    return NextResponse.json({ success: true, whitelist });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 });
  }
}

export async function PUT(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);
  
  if (!session || !isAllowedUser(session.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { email, role } = await request.json();
    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }
    const whitelist = await addWhitelistedUserToFirestore(email, role);
    return NextResponse.json({ success: true, whitelist });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);
  
  if (!session || !isAllowedUser(session.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const whitelist = await removeWhitelistedUserFromFirestore(email);
    return NextResponse.json({ success: true, whitelist });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}
