import { NextResponse } from 'next/server';
import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import { verifySession, getSessionSecret } from '@/lib/session';
import { getUserRoleFromFirestore } from '@/lib/whitelist';

// GET: Fetch recent access logs from Firestore (Admin only)
export async function GET(request) {
  try {
    const token = request.cookies.get('__session')?.value;
    const session = await verifySession(token);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = session.email.trim().toLowerCase();
    const role = await getUserRoleFromFirestore(email);
    
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const querySnapshot = await getAdminDb().collection('access_logs').orderBy('timestamp', 'desc').limit(1000).get();
    
    const logs = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        email: data.email,
        action: data.action,
        type: data.type || 'access',
        status: data.status,
        ip: data.ip || 'unknown',
        // Convert Firestore Timestamp to ISO string for transport
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : new Date().toISOString()
      });
    });

    return NextResponse.json({ logs });
  } catch (err) {
    console.error('Error fetching logs from Firestore:', err);
    
    // Explicitly return friendly explanation if Cloud Firestore is disabled
    let errorMessage = err.message || 'Unknown Firestore error';
    if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('disabled') || errorMessage.includes('Firestore API')) {
      errorMessage = 'The server could not read Cloud Firestore in project sales-intel-cdv-2026. Check that Firestore is enabled and that the App Hosting service account has Firestore access.';
    }
    
    return NextResponse.json({ 
      error: errorMessage, 
      details: err.message,
      logs: [] 
    }, { status: 500 });
  }
}

// POST: Add an access/login log to Firestore (Internal/Secure)
export async function POST(request) {
  try {
    // Basic verification using the shared session secret. No hard-coded
    // fallback: an unset secret must refuse the call, not accept a key that
    // anyone can read out of this repository.
    const internalKey = request.headers.get('x-internal-key');
    const expectedKey = getSessionSecret();

    if (expectedKey === null) {
      console.error('SESSION_SECRET is not set; refusing internal log writes.');
      return NextResponse.json({ error: 'Server misconfigured: SESSION_SECRET is not set' }, { status: 503 });
    }

    if (!internalKey || internalKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized internal call' }, { status: 401 });
    }

    const body = await request.json();
    const { email, action, type, status, ip } = body;

    if (!email || !action) {
      return NextResponse.json({ error: 'Email and action are required' }, { status: 400 });
    }

    const docRef = await getAdminDb().collection('access_logs').add({
      email: email.trim().toLowerCase(),
      action,
      type: type || 'access',
      status: status || 'Allowed',
      ip: ip || 'unknown',
      timestamp: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error('Error writing log to Firestore:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Purge test security logs from Firestore (Admin only)
export async function DELETE(request) {
  try {
    const token = request.cookies.get('__session')?.value;
    const session = await verifySession(token);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = session.email.trim().toLowerCase();
    const role = await getUserRoleFromFirestore(email);
    
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const querySnapshot = await getAdminDb().collection('access_logs').limit(1000).get();
    
    const isTestEmail = (em) => {
      if (!em || typeof em !== 'string') return true;
      const clean = em.toLowerCase();
      return (
        clean.includes('<script>') ||
        clean.includes("' or '") ||
        clean.includes('aaaaa') ||
        clean.includes('example.com') ||
        clean.includes('evil.com') ||
        clean === 'undefined' ||
        clean === 'unknown'
      );
    };

    let deletedCount = 0;
    const deletePromises = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (isTestEmail(data.email)) {
        deletePromises.push(docSnap.ref.delete());
        deletedCount++;
      }
    });

    await Promise.all(deletePromises);

    return NextResponse.json({ success: true, deletedCount });
  } catch (err) {
    console.error('Error purging test logs from Firestore:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
