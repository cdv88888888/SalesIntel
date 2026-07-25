export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getMockConfig, getActiveSessions } from '../../../../lib/mockStore.js';
import { getWhitelistedUsersFromFirestore } from '../../../../lib/whitelist.js';

export async function GET() {
  const whitelist = await getWhitelistedUsersFromFirestore();
  return NextResponse.json({
    config: getMockConfig(),
    whitelist,
    activeSessions: getActiveSessions()
  });
}

