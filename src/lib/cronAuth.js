import { timingSafeEqual } from 'node:crypto';

// Checks the shared secret a scheduler sends as "Authorization: Bearer ...".
// Returns null when CRON_SECRET is not configured (refuse everything), else
// whether the request carries it.
export function cronAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
