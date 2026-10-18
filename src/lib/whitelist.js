import { db } from './firebase.js';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getWhitelist as getMockWhitelist, 
  getUserRole as getMockUserRole, 
  addToWhitelist as addToMockWhitelist, 
  removeFromWhitelist as removeFromMockWhitelist 
} from './mockStore.js';

const COLLECTION_NAME = 'whitelisted_users';

const DEFAULT_ADMINS = [
  { email: 'cdv@masaganagas.com', role: 'admin' },
  { email: 'team@example.com', role: 'admin' }
];

const DEFAULT_VIEWERS = [
  'maclaire.jabines@masaganagas.com',
  'janalbert.santos@masaganagas.com',
  'anton.antonio@masaganagas.com',
  'melroziene.dorio@masaganagas.com',
  'patrick.yao@masaganagas.com',
  'marialourdes.jordan@masaganagas.com',
  'nora.sulit@masaganagas.com',
  'anna.neri@masaganagas.com',
  'hanes.llamas@masaganagas.com',
  'allowed@example.com',
  'admin@cdv-sales-intelligence.com'
];

/**
 * Helper to enforce a tight timeout on Firestore client promises.
 */
function withTimeout(promise, timeoutMs = 500) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Firestore operation timeout')), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Returns initial default users list combining default admins and env/static viewers.
 */
export function getDefaultUsers() {
  const usersMap = new Map();

  // Add default admins
  DEFAULT_ADMINS.forEach(admin => {
    usersMap.set(admin.email.toLowerCase(), admin);
  });

  // Check process.env.AUTH_WHITELIST
  if (process.env.AUTH_WHITELIST) {
    process.env.AUTH_WHITELIST.split(',')
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0)
      .forEach(entry => {
        const parts = entry.split(':');
        const email = parts[0].trim().toLowerCase();
        const role = parts[1] ? parts[1].trim() : (usersMap.has(email) ? usersMap.get(email).role : 'viewer');
        usersMap.set(email, { email, role });
      });
  } else {
    // Add fallback viewers
    DEFAULT_VIEWERS.forEach(email => {
      const clean = email.toLowerCase();
      if (!usersMap.has(clean)) {
        usersMap.set(clean, { email: clean, role: 'viewer' });
      }
    });
  }

  return Array.from(usersMap.values());
}

/**
 * Seeds initial users into Firestore whitelisted_users collection if empty.
 */
export async function autoSeedWhitelistIfNeeded() {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await withTimeout(getDocs(colRef), 10000);

    if (!snapshot.empty) {
      return snapshot.docs.map(d => ({
        email: d.id,
        role: d.data().role || 'viewer',
        timestamp: d.data().timestamp
      }));
    }

    // Collection is empty: perform batch insert
    const defaults = getDefaultUsers();
    const batch = writeBatch(db);

    defaults.forEach(user => {
      const cleanEmail = user.email.trim().toLowerCase();
      const docRef = doc(db, COLLECTION_NAME, cleanEmail);
      batch.set(docRef, {
        email: cleanEmail,
        role: user.role,
        timestamp: serverTimestamp()
      });
      // Also ensure mockStore stays in sync
      addToMockWhitelist(cleanEmail, user.role);
    });

    await withTimeout(batch.commit(), 10000);
    return defaults;
  } catch (err) {
    console.error('[WHITELIST_SEED_ERROR] Failed auto-seeding Firestore whitelisted_users:', err.message);
    return getDefaultUsers();
  }
}

/**
 * Fetches all whitelisted users from Firestore.
 * Triggers auto-seeding if collection is empty.
 * Falls back to mockStore if Firestore fails.
 */
export async function getWhitelistedUsersFromFirestore() {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await withTimeout(getDocs(colRef), 10000);

    if (snapshot.empty) {
      return await autoSeedWhitelistIfNeeded();
    }

    const list = snapshot.docs.map(d => ({
      email: d.id,
      role: d.data().role || 'viewer',
      timestamp: d.data().timestamp
    }));

    return list;
  } catch (err) {
    console.error('[WHITELIST_FETCH_ERROR] Firestore fetch failed, falling back to mockStore:', err.message);
    return getMockWhitelist();
  }
}

/**
 * Gets role for a given email from Firestore whitelisted_users collection.
 * Falls back to mockStore if document not found or on error.
 */
export async function getUserRoleFromFirestore(email) {
  if (!email || typeof email !== 'string') return 'viewer';
  const cleanEmail = email.trim().toLowerCase();

  try {
    const docRef = doc(db, COLLECTION_NAME, cleanEmail);
    const docSnap = await withTimeout(getDoc(docRef), 10000);

    if (docSnap.exists()) {
      return docSnap.data().role || 'viewer';
    }

    // If not found in Firestore doc, check if collection is empty and seed
    const colRef = collection(db, COLLECTION_NAME);
    const colSnap = await withTimeout(getDocs(colRef), 10000);
    if (colSnap.empty) {
      const seeded = await autoSeedWhitelistIfNeeded();
      const user = seeded.find(u => u.email === cleanEmail);
      if (user) return user.role;
    }

    // Fallback to mockStore
    return getMockUserRole(cleanEmail);
  } catch (err) {
    console.error(`[WHITELIST_ROLE_ERROR] Failed fetching role for ${cleanEmail} from Firestore:`, err.message);
    return getMockUserRole(cleanEmail);
  }
}

/**
 * Adds or updates a user in Firestore whitelisted_users collection.
 * Also synchronizes with mockStore.
 */
export async function addWhitelistedUserToFirestore(email, role = 'viewer') {
  if (!email || typeof email !== 'string') return await getWhitelistedUsersFromFirestore();
  const cleanEmail = email.trim().toLowerCase();
  const validRole = (role === 'admin' || role === 'viewer') ? role : 'viewer';

  // Always sync with mockStore
  addToMockWhitelist(cleanEmail, validRole);

  let success = false;
  try {
    const docRef = doc(db, COLLECTION_NAME, cleanEmail);
    await withTimeout(setDoc(docRef, {
      email: cleanEmail,
      role: validRole,
      timestamp: serverTimestamp()
    }, { merge: true }), 10000);
    success = true;
  } catch (err) {
    console.error(`[WHITELIST_ADD_ERROR] Failed adding ${cleanEmail} to Firestore:`, err.message);
  }

  if (!success) {
    return getMockWhitelist();
  }

  return await getWhitelistedUsersFromFirestore();
}

/**
 * Removes a user from Firestore whitelisted_users collection.
 * Also synchronizes with mockStore.
 */
export async function removeWhitelistedUserFromFirestore(email) {
  if (!email || typeof email !== 'string') return await getWhitelistedUsersFromFirestore();
  const cleanEmail = email.trim().toLowerCase();

  // Always sync with mockStore
  removeFromMockWhitelist(cleanEmail);

  let success = false;
  try {
    const docRef = doc(db, COLLECTION_NAME, cleanEmail);
    await withTimeout(deleteDoc(docRef), 10000);
    success = true;
  } catch (err) {
    console.error(`[WHITELIST_REMOVE_ERROR] Failed deleting ${cleanEmail} from Firestore:`, err.message);
  }

  if (!success) {
    return getMockWhitelist();
  }

  return await getWhitelistedUsersFromFirestore();
}
