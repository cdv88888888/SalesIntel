// Accounts that are always administrators, whatever the whitelist says.
//
// These two cannot be demoted or removed from the Settings screen - the
// safeguard that stops the app being locked out of its own user management.
// Because their row is locked, their stored role can never be corrected from
// the UI either, so the role must be derived from this list rather than read
// from the whitelist document.
export const PERMANENT_ADMINS = [
  'cdv@masaganagas.com',
  'janalbert.santos@masaganagas.com',
];

export function isPermanentAdmin(email) {
  if (!email || typeof email !== 'string') return false;
  return PERMANENT_ADMINS.includes(email.trim().toLowerCase());
}
