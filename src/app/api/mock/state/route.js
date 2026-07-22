export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getMockConfig, getWhitelist, getActiveSessions } from '../../../../lib/mockStore';

export async function GET() {
  return NextResponse.json({
    config: getMockConfig(),
    whitelist: getWhitelist(),
    activeSessions: getActiveSessions()
  });
}

