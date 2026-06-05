import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, createHash } from 'crypto';
import { env } from '../lib/env';
import { makeToken } from '../lib/jwt';

function verifyTelegramLogin(data: Record<string, string>): boolean {
  const { hash, ...rest } = data;
  const checkArr = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`);
  const checkString = checkArr.join('\n');
  const secretKey = createHash('sha256').update(env.TELEGRAM_TOKEN).digest() as unknown as string;
  const hmac = createHmac('sha256', secretKey).update(checkString).digest('hex');
  return hmac === hash;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const data = req.body as Record<string, string>;

  if (!verifyTelegramLogin(data)) {
    res.status(401).json({ error: 'Неверные данные Telegram' });
    return;
  }

  // Проверяем свежесть (до 24 часов)
  const authDate = parseInt(data.auth_date ?? '0');
  if (Date.now() / 1000 - authDate > 86400) {
    res.status(401).json({ error: 'Данные авторизации устарели' });
    return;
  }

  const userId = parseInt(data.id);
  const token = makeToken(userId);
  res.json({
    token,
    user: {
      id: userId,
      first_name: data.first_name ?? '',
      last_name: data.last_name ?? '',
      username: data.username ?? '',
      photo_url: data.photo_url ?? '',
    },
  });
}
