/**
 * Firebase App Hosting injects FIREBASE_WEBAPP_CONFIG (a JSON string with the
 * associated web app's config) at build and run time. Map it onto the
 * NEXT_PUBLIC_FIREBASE_* variables the app reads, unless those are already
 * set explicitly (as they are on Vercel and in local .env files).
 */
function firebaseEnvFromWebappConfig() {
  let cfg = {};
  try {
    cfg = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG || '{}');
  } catch {
    cfg = {};
  }
  const map = {
    NEXT_PUBLIC_FIREBASE_API_KEY: cfg.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: cfg.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: cfg.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: cfg.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: cfg.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: cfg.appId,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: cfg.measurementId,
  };
  const env = {};
  for (const [key, fallback] of Object.entries(map)) {
    const value = process.env[key] || fallback;
    if (value) env[key] = String(value);
  }
  return env;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  env: firebaseEnvFromWebappConfig(),
};

export default nextConfig;
