import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ALL_SEGMENT, BASE_SEGMENTS } from './segments';

const SETTINGS_COLLECTION = "settings";
const memoryStore = {};

function getMonthString(month) {
  if (!month) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return month;
}

function getDocId(month, segment) {
  return segment === 'dealer' ? getMonthString(month) : `${getMonthString(month)}-${segment}`;
}

async function getSegmentSettings(month, segment) {
  const docId = getDocId(month, segment);

  try {
    const docRef = doc(db, SETTINGS_COLLECTION, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      memoryStore[docId] = data;
      return data;
    }
  } catch (error) {
    console.error("Error reading settings from Firestore:", error);
  }

  if (memoryStore[docId]) {
    return memoryStore[docId];
  }
  return {
    globalTarget: 150000,
    dealerTargets: {}
  };
}

// The "all" segment has no settings document of its own: its global target is
// the sum of the per-segment targets and its dealer targets are the union.
async function getCombinedSettings(month) {
  const perSegment = await Promise.all(BASE_SEGMENTS.map(s => getSegmentSettings(month, s)));
  return perSegment.reduce((acc, s) => ({
    globalTarget: acc.globalTarget + (Number(s?.globalTarget) || 0),
    dealerTargets: { ...acc.dealerTargets, ...(s?.dealerTargets || {}) },
  }), { globalTarget: 0, dealerTargets: {} });
}

export async function getSettings(month, segment = 'dealer') {
  if (segment === ALL_SEGMENT) {
    return getCombinedSettings(month);
  }
  return getSegmentSettings(month, segment);
}

export async function saveSettings(settings, month, segment = 'dealer') {
  if (segment === ALL_SEGMENT) {
    throw new Error('Targets are configured per segment; the "all" segment is derived and cannot be saved.');
  }
  const docId = getDocId(month, segment);
  const currentSettings = await getSettings(month, segment);
  const newSettings = { ...currentSettings, ...settings };
  
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, docId);
    await setDoc(docRef, newSettings, { merge: true });
    memoryStore[docId] = newSettings;
  } catch (error) {
    console.error("Error saving settings to Firestore:", error);
  }

  memoryStore[docId] = newSettings;
  return newSettings;
}
