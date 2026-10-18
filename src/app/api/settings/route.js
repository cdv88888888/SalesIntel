import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';
import { verifySession } from '@/lib/session';

export async function GET(request) {
  const token = request.cookies.get('__session')?.value;
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const segment = searchParams.get('segment') || 'dealer';
  
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
    const { month, segment = 'dealer', ...settingsData } = body;
    const updated = await saveSettings(settingsData, month, segment);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: 'Invalid settings data' }, { status: 400 });
  }
}
