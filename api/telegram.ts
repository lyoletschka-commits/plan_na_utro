import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleMessage } from '../lib/handlers';
import { env } from '../lib/env';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Всегда возвращаем 200 чтобы Telegram не ретраил
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true });
    return;
  }

  // Проверяем секрет webhook
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(200).json({ ok: true });
    return;
  }

  try {
    const update = req.body as { message?: unknown };
    if (update.message) {
      await handleMessage(update.message as Parameters<typeof handleMessage>[0]);
    }
  } catch (err) {
    console.error('webhook error:', JSON.stringify(err));
  }

  res.status(200).json({ ok: true });
}
