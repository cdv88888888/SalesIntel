import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { verifySession } from '@/lib/session';
import { getVolumeWatch, getAccountOrderDetail } from '@/lib/bigquery';
import { assessAccount, asIsoDate } from '@/lib/declineAlerts';
import { explainAccount, getStoredExplanations, EXPLANATION_VERSION } from '@/lib/alertExplanations';

export const maxDuration = 120;

// Writes (or returns the stored) AI explanation for one flagged account.
export async function POST(request) {
  const session = await verifySession(request.cookies.get('__session')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let accountId;
  try {
    accountId = String((await request.json())?.accountId || '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!accountId) {
    return NextResponse.json({ error: 'Missing accountId.' }, { status: 400 });
  }

  try {
    const rows = await getVolumeWatch();
    const row = rows.find(r => r.id === accountId);
    if (!row) {
      return NextResponse.json({ error: 'That account is not on the watch list.' }, { status: 404 });
    }
    const account = { ...assessAccount(row), dataThrough: asIsoDate(row.dataThrough) };
    if (!account.alert) {
      return NextResponse.json({ error: 'That account is not flagged any more.' }, { status: 409 });
    }

    // Already explained on this data: do not pay for it twice.
    const stored = (await getStoredExplanations())[accountId];
    if (stored && stored.dataThrough === account.dataThrough && stored.version === EXPLANATION_VERSION) {
      return NextResponse.json({ explanation: stored, cached: true });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set on the server.' }, { status: 503 });
    }

    const detail = await getAccountOrderDetail(accountId);
    const explanation = await explainAccount(account, detail);
    return NextResponse.json({ explanation, cached: false });
  } catch (error) {
    console.error('[alerts] explain failed:', error);
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'The Claude API key was rejected. Check ANTHROPIC_API_KEY.' }, { status: 502 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Claude is rate-limited right now. Try again in a minute.' }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Claude API error (${error.status}): ${error.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: error.message || 'Something went wrong.' }, { status: 500 });
  }
}
