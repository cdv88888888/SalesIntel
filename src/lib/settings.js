import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const SETTINGS_COLLECTION = "settings";
const memoryStore = {};

function getMonthString(month) {
  if (!month) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return month;
}

export async function getSettings(month, segment = 'dealer') {
  const docId = segment === 'dealer' ? getMonthString(month) : `${getMonthString(month)}-${segment}`;
  
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

export async function saveSettings(settings, month, segment = 'dealer') {
  const docId = segment === 'dealer' ? getMonthString(month) : `${getMonthString(month)}-${segment}`;
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


