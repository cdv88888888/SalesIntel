import { auth } from './firebase.js';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';

/**
 * Checks if the given email is whitelisted for access.
 * Handles case-insensitivity and trims whitespace.
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function checkUserAccess(email) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();

  if (typeof window === 'undefined') {
    // Server-side
    try {
      const { getMockConfig } = await import('./mockStore.js');
      const mockConfig = getMockConfig();
      if (mockConfig && mockConfig.mode === 'broken') {
        if (mockConfig.brokenType === 'whitelist') {
          return true;
        } else if (mockConfig.brokenType === 'access-denied') {
          return false;
        }
      }
      
      const { getWhitelistedUsersFromFirestore } = await import('./whitelist.js');
      const whitelist = await getWhitelistedUsersFromFirestore();
      return whitelist.some(u => {
        const emailStr = typeof u === 'string' ? u : u.email;
        return emailStr.trim().toLowerCase() === cleanEmail;
      });
    } catch (e) {
      console.error("ERROR IN checkUserAccess server-side Firestore load:", e);
      return false;
    }
  } else {
    // Client-side: query session check endpoint
    try {
      const res = await fetch(`/api/auth/session?checkEmail=${encodeURIComponent(cleanEmail)}`);
      if (res.ok) {
        const data = await res.json();
        return !!data.allowed;
      }
    } catch (e) {
      console.error('Failed to check user access on client:', e);
    }
    return false;
  }
}

/**
 * Authenticates user with Google and establishes server session if whitelisted.
 * If authentication succeeds but user is not whitelisted, signs out of Firebase,
 * clears session, and throws NOT_WHITELISTED.
 */
export async function loginUser() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const email = result.user.email;

  try {
    const isAllowed = await checkUserAccess(email);
    if (!isAllowed) {
      throw new Error('NOT_WHITELISTED');
    }

    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('NOT_WHITELISTED');
      }
      throw new Error('Failed to create server session.');
    }

    return result.user;
  } catch (err) {
    // Ensure clean sign-out on authorization failures
    await signOut(auth);
    await fetch('/api/auth/session', { method: 'DELETE' });
    throw err;
  }
}

/**
 * Terminate both Firebase and server session.
 */
export async function logoutUser() {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch (e) {
    // ignore
  }
  try {
    await signOut(auth);
  } catch (e) {
    // ignore
  }
}
