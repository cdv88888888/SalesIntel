import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getVolumeWatch } from '@/lib/bigquery';
import { buildAgents } from '@/lib/declineAlerts';
import { getAssignments, setBatchAssignment, getLastRun, isAgentKey } from '@/lib/alertAgents';
import { getWhitelistedUsersFromFirestore } from '@/lib/whitelist';

// Admin-only (the route guard restricts /api/settings to admins): which
// person each volume-watch agent reports to.

async function requireSession(request) {
  return verifySession(request.cookies.get('__session')?.value);
}

export async function GET(request) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [rows, assignments, users, lastRun] = await Promise.all([
      getVolumeWatch(),
      getAssignments(),
      getWhitelistedUsersFromFirestore(),
      getLastRun(),
    ]);
    const agents = buildAgents(rows).map(a => ({
      key: a.key,
      segment: a.segment,
      batch: a.batch,
      accounts: a.accounts,
      firstRank: a.firstRank,
      lastRank: a.lastRank,
      flagged: a.alerts.length,
    }));
    return NextResponse.json({
      agents,
      assignments: assignments.batches,
      users: users.map(u => u.email).sort(),
      lastRun,
    });
  } catch (error) {
    console.error('[alerts] Could not load agents:', error);
    return NextResponse.json({ error: error.message || 'Could not load the agents.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const key = body?.key;
  const email = String(body?.email || '').trim().toLowerCase();
  if (!isAgentKey(key)) {
    return NextResponse.json({ error: 'Unknown agent.' }, { status: 400 });
  }
  try {
    if (email) {
      const users = await getWhitelistedUsersFromFirestore();
      if (!users.some(u => u.email.toLowerCase() === email)) {
        return NextResponse.json({ error: 'That person is not an onboarded user.' }, { status: 400 });
      }
    }
    const updated = await setBatchAssignment(key, email || null);
    return NextResponse.json({ assignments: updated.batches });
  } catch (error) {
    console.error('[alerts] Could not save assignment:', error);
    return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
  }
}
