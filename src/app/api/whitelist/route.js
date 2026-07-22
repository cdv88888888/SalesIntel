import { NextResponse } from 'next/server';
import { getWhitelist, addToWhitelist, removeFromWhitelist } from '@/lib/mockStore';
import { verifySession } from '@/lib/session';

export async function GET(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const whitelist = getWhitelist();
    return NextResponse.json({ whitelist });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch whitelist' }, { status: 500 });
  }
}

export async function POST(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, role } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    addToWhitelist(email, role || 'viewer');
    return NextResponse.json({ success: true, whitelist: getWhitelist() });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 });
  }
}

export async function PUT(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, role } = await request.json();
    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }
    addToWhitelist(email, role);
    return NextResponse.json({ success: true, whitelist: getWhitelist() });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    removeFromWhitelist(email);
    return NextResponse.json({ success: true, whitelist: getWhitelist() });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}
