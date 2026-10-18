import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { verifySession } from '@/lib/session';
import { getUserRole } from '@/lib/mockStore';

// GET: Fetch recent access logs from Firestore (Admin only)
export async function GET(request) {
  try {
    const token = request.cookies.get('__session')?.value;
    const session = await verifySession(token);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = session.email.trim().toLowerCase();
    const role = getUserRole(email);
    
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const logsRef = collection(db, 'access_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(1000));
    const querySnapshot = await getDocs(q);
    
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
      errorMessage = 'Cloud Firestore API is not enabled or provisioned in project sales-intel-cdv-2026. Please enable it in the Google Cloud/Firebase Console.';
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
    // Basic verification using shared secret
    const internalKey = request.headers.get('x-internal-key');
    const expectedKey = process.env.SESSION_SECRET || 'mgc-sales-intelligence-session-secret-2026-prod-secret';
    
    if (!internalKey || internalKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized internal call' }, { status: 401 });
    }

    const body = await request.json();
    const { email, action, type, status, ip } = body;

    if (!email || !action) {
      return NextResponse.json({ error: 'Email and action are required' }, { status: 400 });
    }

    const logsRef = collection(db, 'access_logs');
    const docRef = await addDoc(logsRef, {
      email: email.trim().toLowerCase(),
      action,
      type: type || 'access',
      status: status || 'Allowed',
      ip: ip || 'unknown',
      timestamp: serverTimestamp()
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error('Error writing log to Firestore:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
