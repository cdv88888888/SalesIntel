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

const DEFAULT_GLOBAL_TARGET = 150000;

const defaultSettings = () => ({
  globalTarget: DEFAULT_GLOBAL_TARGET,
  dealerTargets: {},
});

// Reads the stored settings for one segment, or null when that segment has
// never been configured. Keeping "unconfigured" distinct from the placeholder
// default matters for the combined "all" view, which must not sum placeholders.
async function readSegmentSettings(month, segment) {
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

  return memoryStore[docId] || null;
}

async function getSegmentSettings(month, segment) {
  return (await readSegmentSettings(month, segment)) || defaultSettings();
}

// The "all" segment has no settings document of its own: its global target is
// the sum of the targets that have actually been set, and its dealer targets
// are the union of the per-segment ones (summed where a customer is
// configured in more than one segment). Segments with no saved document
// contribute nothing, so "all" never inflates the target with placeholders.
async function getCombinedSettings(month) {
  const stored = (await Promise.all(BASE_SEGMENTS.map(s => readSegmentSettings(month, s))))
    .filter(Boolean);

  if (stored.length === 0) {
    return defaultSettings();
  }

  const dealerTargets = {};
  let globalTarget = 0;
  for (const segmentSettings of stored) {
    globalTarget += Number(segmentSettings?.globalTarget) || 0;
    for (const [customerId, target] of Object.entries(segmentSettings?.dealerTargets || {})) {
      dealerTargets[customerId] = (Number(dealerTargets[customerId]) || 0) + (Number(target) || 0);
    }
  }
  return { globalTarget, dealerTargets };
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
