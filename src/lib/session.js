const FALLBACK_SECRET = 'production-super-secret-key-1234567890';
const getSecret = () => process.env.SESSION_SECRET || FALLBACK_SECRET;

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
  const payload = JSON.stringify({ email, createdAt: Date.now() });
  const payloadBase64 = btoa(payload);
  
  const myCrypto = getCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(payload + getSecret());
  const hashBuffer = await myCrypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return payloadBase64 + '.' + signature;
}

export async function verifySession(token) {
  if (!token) return null;
  if (process.env.NODE_ENV === 'production' && getSecret() === FALLBACK_SECRET) {
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
    const data = encoder.encode(payloadStr + getSecret());
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
