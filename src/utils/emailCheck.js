import dns from 'node:dns/promises';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function isPlausibleEmail(email) {
  if (!EMAIL_REGEX.test(email)) return false;

  try {
    const mx = await dns.resolveMx(email.split('@')[1]);
    return mx && mx.length > 0;
  } catch {
    return false;
  }
}
