import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/cronAuth';
import { runAgents } from '@/lib/alertAgents';

export const maxDuration = 300;

// The scheduled run of the volume-watch agents. Called by a scheduler, not a
// signed-in person, so it sits outside the session guard and checks a shared
// secret instead. Without CRON_SECRET configured it refuses every call.
export async function POST(request) {
  const ok = cronAuthorized(request);
  if (ok === null) {
    return NextResponse.json({ error: 'CRON_SECRET is not set on the server.' }, { status: 503 });
  }
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get('force') === '1';
  try {
    const summary = await runAgents({ force });
    console.log('[alerts] run:', JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[alerts] run failed:', error);
    return NextResponse.json({ error: error.message || 'Run failed.' }, { status: 500 });
  }
}
