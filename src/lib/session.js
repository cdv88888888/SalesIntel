// The key that signs the __session cookie. There is deliberately NO committed
// fallback: a default baked into the repo would let anyone forge a session
// cookie for any whitelisted address. When SESSION_SECRET is missing we fail
// closed instead - outside production a random per-process key keeps local
// development working, and in production signing and verification both refuse.
const DEV_SECRET = (() => {
  if (process.env.NODE_ENV === 'production') return null;
  const bytes = new Uint8Array(32);
  (globalThis.crypto || require('crypto').webcrypto).getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
})();

// Returns the signing key, or null when none is configured.
export function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (typeof secret === 'string' && secret.length > 0) return secret;
  return DEV_SECRET;
}

export function isSessionSecretConfigured() {
  return getSessionSecret() !== null;
}

const getSecret = getSessionSecret;

const getCrypto = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  return require('crypto').webcrypto;
};

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    diff |= charA ^ charB;
  }
  return diff === 0;
}

export async function signSession(email) {
  const secret = getSecret();
  if (secret === null) {
    throw new Error('SESSION_SECRET is not configured; refusing to issue a session cookie.');
  }
  const payload = JSON.stringify({ email, createdAt: Date.now() });
  const payloadBase64 = btoa(payload);
  
  const myCrypto = getCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(payload + secret);
  const hashBuffer = await myCrypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return payloadBase64 + '.' + signature;
}

export async function verifySession(token) {
  if (!token) return null;
  const secret = getSecret();
  if (secret === null) {
    console.error('SESSION_SECRET is not configured; rejecting all sessions.');
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  
  const [payloadBase64, signature] = parts;
  try {
    const payloadStr = atob(payloadBase64);
    const payloadObj = JSON.parse(payloadStr);
    
    if (!payloadObj || typeof payloadObj !== 'object' || typeof payloadObj.email !== 'string') {
      return null;
    }
    
    if (typeof payloadObj.createdAt !== 'number' || Date.now() - payloadObj.createdAt > 86400000) {
      return null;
    }
    
    const myCrypto = getCrypto();
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadStr + secret);
    const hashBuffer = await myCrypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (!timingSafeEqual(signature, expectedSignature)) {
      return null;
    }
    
    return payloadObj;
  } catch (e) {
    console.error("verifySession error:", e);
    return null;
  }
}
