import { NextResponse } from 'next/server';
import { updateMockConfig, getMockConfig } from '../../../../lib/mockStore';

export async function POST(request) {
  try {
    const body = await request.json();
    updateMockConfig(body);
    return NextResponse.json({ success: true, config: getMockConfig() });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid config payload' }, { status: 400 });
  }
}
