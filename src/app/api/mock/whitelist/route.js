import { NextResponse } from 'next/server';
import { 
  getWhitelistedUsersFromFirestore, 
  addWhitelistedUserToFirestore, 
  removeWhitelistedUserFromFirestore 
} from '../../../../lib/whitelist.js';

export async function GET() {
  const whitelist = await getWhitelistedUsersFromFirestore();
  return NextResponse.json({ whitelist });
}

export async function POST(request) {
  try {
    const body = await request.json();
    let whitelist = [];
    if (body.email) {
      whitelist = await addWhitelistedUserToFirestore(body.email, body.role || 'viewer');
    } else {
      whitelist = await getWhitelistedUsersFromFirestore();
    }
    return NextResponse.json({ success: true, whitelist });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    let whitelist = [];
    if (body.email) {
      whitelist = await removeWhitelistedUserFromFirestore(body.email);
    } else {
      whitelist = await getWhitelistedUsersFromFirestore();
    }
    return NextResponse.json({ success: true, whitelist });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
