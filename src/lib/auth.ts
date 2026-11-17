import { createHmac, timingSafeEqual } from 'node:crypto';

// Session token = "<user_id>.<expiry ms>.<HMAC-SHA256 signature>".
// The signature uses SESSION_SECRET from .env, so a user cannot edit the cookie
// to become someone else: any change makes the signature invalid.

const MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('Set SESSION_SECRET (16+ characters) in .env');
  return s;
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function createSessionToken(userId: number): { token: string; maxAge: number } {
  const payload = `${userId}.${Date.now() + MAX_AGE_SECONDS * 1000}`;
  return { token: `${payload}.${sign(payload)}`, maxAge: MAX_AGE_SECONDS };
}

/** Returns the user id if the token is genuine and not expired, else null. */
export function verifySessionToken(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const expected = Buffer.from(sign(`${id}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) < Date.now()) return null;
  return Number(id) || null;
}
