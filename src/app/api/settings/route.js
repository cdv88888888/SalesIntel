import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';
import { verifySession } from '@/lib/session';
import { normalizeSegment, normalizeBaseSegment, ALL_SEGMENT } from '@/lib/segments';

export async function GET(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const segment = normalizeSegment(searchParams.get('segment'));
  
  const settings = await getSettings(month, segment);
  return NextResponse.json(settings);
}

export async function POST(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { month, segment: rawSegment = 'dealer', ...settingsData } = body;
    if (rawSegment === ALL_SEGMENT) {
      return NextResponse.json({ error: 'Targets are set per segment; choose Dealer, Commercial or Bulk' }, { status: 400 });
    }
    const segment = normalizeBaseSegment(rawSegment);
    const updated = await saveSettings(settingsData, month, segment);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: 'Invalid settings data' }, { status: 400 });
  }
}
