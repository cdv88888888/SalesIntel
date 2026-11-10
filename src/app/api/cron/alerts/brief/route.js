import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/cronAuth';
import { isAgentKey } from '@/lib/alertAgents';
import { runAgentBriefing, briefingError } from '@/lib/agentBriefing';

export const maxDuration = 300;

// Scheduled investigation for one agent: POST /api/cron/alerts/brief?agent=dealer-1
// One agent per request, so each gets the full request time to itself.
export async function POST(request) {
  const ok = cronAuthorized(request);
  if (ok === null) {
    return NextResponse.json({ error: 'CRON_SECRET is not set on the server.' }, { status: 503 });
  }
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const agentKey = new URL(request.url).searchParams.get('agent');
  if (!isAgentKey(agentKey)) {
    return NextResponse.json({ error: 'Unknown agent.' }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set on the server.' }, { status: 503 });
  }
  try {
    const { briefing, cached } = await runAgentBriefing(agentKey);
    // The log line a person reads in the workflow run: no briefing text.
    return NextResponse.json({
      agentKey,
      cached,
      dataThrough: briefing.dataThrough,
      queries: briefing.queries,
      usage: briefing.usage,
    });
  } catch (error) {
    console.error(`[alerts] scheduled briefing failed for ${agentKey}:`, error);
    const { status, error: message } = briefingError(error);
    return NextResponse.json({ agentKey, error: message }, { status });
  }
}
