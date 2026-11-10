import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { isAgentKey } from '@/lib/alertAgents';
import { runAgentBriefing, briefingError } from '@/lib/agentBriefing';

// An investigation takes several rounds of queries.
export const maxDuration = 300;

// Runs one agent over its batch on request from a signed-in person.
export async function POST(request) {
  const session = await verifySession(request.cookies.get('__session')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!isAgentKey(body?.agentKey)) {
    return NextResponse.json({ error: 'Unknown agent.' }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set on the server.' }, { status: 503 });
  }
  try {
    return NextResponse.json(await runAgentBriefing(body.agentKey, { force: body.force === true }));
  } catch (error) {
    console.error('[alerts] briefing failed:', error);
    const { status, error: message } = briefingError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
