import { createHmac } from 'crypto';
import { env } from './env';

export function makeToken(userId: number): string {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 дней
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString('base64url');
  const sig = createHmac('sha256', env.TELEGRAM_WEBHOOK_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac('sha256', env.TELEGRAM_WEBHOOK_SECRET).update(payload).digest('base64url');
  if (expected !== sig) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return uid as number;
  } catch {
    return null;
  }
}
