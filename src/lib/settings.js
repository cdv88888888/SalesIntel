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
  
  memoryStore[docId] = newSettings;
  return newSettings;
}

