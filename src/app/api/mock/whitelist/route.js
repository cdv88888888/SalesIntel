import { NextResponse } from 'next/server';
import { getWhitelist, addToWhitelist, removeFromWhitelist } from '../../../../lib/mockStore';

export async function GET() {
  return NextResponse.json({ whitelist: getWhitelist() });
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body.email) {
      addToWhitelist(body.email);
    }
    return NextResponse.json({ success: true, whitelist: getWhitelist() });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    if (body.email) {
      removeFromWhitelist(body.email);
    }
    return NextResponse.json({ success: true, whitelist: getWhitelist() });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
