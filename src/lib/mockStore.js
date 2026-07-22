import fs from 'fs';
import path from 'path';

const defaultEmails = [
  'maclaire.jabines@masaganagas.com',
  'janalbert.santos@masaganagas.com',
  'cdv@masaganagas.com',
  'anton.antonio@masaganagas.com',
  'melroziene.dorio@masaganagas.com',
  'patrick.yao@masaganagas.com',
  'marialourdes.jordan@masaganagas.com',
  'nora.sulit@masaganagas.com',
  'anna.neri@masaganagas.com',
  'hanes.llamas@masaganagas.com'
];
const getInitialWhitelist = () => {
  if (process.env.AUTH_WHITELIST) {
    return process.env.AUTH_WHITELIST.split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0)
      .map(email => ({ email, role: email === 'cdv@masaganagas.com' ? 'admin' : 'viewer' }));
  }
  return defaultEmails.map(email => ({ email, role: email === 'cdv@masaganagas.com' ? 'admin' : 'viewer' }));
};
const defaultWhitelist = getInitialWhitelist();

const storePath = process.env.NODE_ENV === 'production' 
  ? '/tmp/mock-store.json'
  : path.join(process.cwd(), 'data', 'mock-store.json');

// Memory variables
let whitelist = new Map(defaultWhitelist.map(u => [u.email, u.role]));
let mockConfig = {
  mode: 'correct',
  brokenType: null
};
let activeSessions = new Set();

function ensureDir() {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadStore() {
  try {
    ensureDir();
    if (fs.existsSync(storePath)) {
      const data = fs.readFileSync(storePath, 'utf8');
      const json = JSON.parse(data);
      
      if (json.whitelist) {
        whitelist.clear();
        json.whitelist.forEach(item => {
          if (typeof item === 'string') {
            whitelist.set(item, item === 'cdv@masaganagas.com' ? 'admin' : 'viewer');
          } else {
            whitelist.set(item.email, item.role);
          }
        });
      }
      if (json.mockConfig) {
        mockConfig = json.mockConfig;
      }
      if (json.activeSessions) {
        activeSessions = new Set(json.activeSessions);
      }
    } else {
      saveStore();
    }
  } catch (err) {
    console.error('Failed to load mock store, using default state:', err);
  }
}

function saveStore() {
  try {
    ensureDir();
    const data = JSON.stringify({
      whitelist: Array.from(whitelist.entries()).map(([email, role]) => ({ email, role })),
      mockConfig: mockConfig,
      activeSessions: Array.from(activeSessions)
    }, null, 2);
    fs.writeFileSync(storePath, data, 'utf8');
  } catch (err) {
    console.error('Failed to save mock store:', err);
  }
}

// Initial load on module execution
loadStore();

export function getWhitelist() {
  loadStore();
  return Array.from(whitelist.entries()).map(([email, role]) => ({ email, role }));
}

export function isWhitelisted(email) {
  if (!email || typeof email !== 'string') return false;
  loadStore();
  const cleanEmail = email.trim().toLowerCase();
  return whitelist.has(cleanEmail);
}

export function getUserRole(email) {
  if (!email || typeof email !== 'string') return 'viewer';
  loadStore();
  const cleanEmail = email.trim().toLowerCase();
  return whitelist.get(cleanEmail) || 'viewer';
}

export function addToWhitelist(email, role = 'viewer') {
  if (email && typeof email === 'string') {
    loadStore();
    whitelist.set(email.trim().toLowerCase(), role);
    saveStore();
  }
}

export function removeFromWhitelist(email) {
  if (email && typeof email === 'string') {
    loadStore();
    whitelist.delete(email.trim().toLowerCase());
    saveStore();
  }
}

export function resetWhitelist() {
  loadStore();
  whitelist.clear();
  defaultWhitelist.forEach(u => whitelist.set(u.email, u.role));
  saveStore();
}

export function getMockConfig() {
  loadStore();
  return mockConfig;
}

export function updateMockConfig(newConfig) {
  loadStore();
  if (newConfig.mode) mockConfig.mode = newConfig.mode;
  mockConfig.brokenType = newConfig.brokenType || null;
  saveStore();
}

export function addActiveSession(token) {
  loadStore();
  activeSessions.add(token);
  saveStore();
}

export function removeActiveSession(token) {
  loadStore();
  activeSessions.delete(token);
  saveStore();
}

export function getActiveSessions() {
  loadStore();
  return Array.from(activeSessions);
}


