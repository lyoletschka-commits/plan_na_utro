import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAuthSession, checkAuthSession } from '../lib/db';
import { makeToken } from '../lib/jwt';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'POST') {
      // Создаём pending-сессию, возвращаем токен для deep link
      const token = await createAuthSession();
      res.json({ token });

    } else if (req.method === 'GET') {
      // Проверяем, подтвердил ли пользователь вход в боте
      const token = req.query.token as string;
      if (!token) { res.status(400).json({ error: 'No token' }); return; }

      const session = await checkAuthSession(token);
      if (!session) { res.json({ pending: true }); return; }

      const jwt = makeToken(session.user_id);
      res.json({
        token: jwt,
        user: {
          id: session.user_id,
          first_name: session.first_name ?? '',
          username: session.username ?? '',
          photo_url: '',
        },
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('auth-session error:', JSON.stringify(err));
    res.status(500).json({ error: 'Internal error' });
  }
}
