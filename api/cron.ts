import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUsersWithTasksToday, getTodayTasks } from '../lib/db';
import { sendMessage } from '../lib/telegram';

// UTC часы → текст напоминания (Испания UTC+2 летом, UTC+1 зимой)
const GREETINGS: Record<number, string> = {
  7:  '🌅 Доброе утро! Задачи на сегодня:',
  8:  '🌅 Доброе утро! Задачи на сегодня:',  // зимнее время
  10: '☀️ Уже полдень! Как идут дела?',
  11: '☀️ Уже полдень! Как идут дела?',       // зимнее
  13: '🕒 Послеобеденная сводка:',
  14: '🕒 Послеобеденная сводка:',            // зимнее
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const hour = new Date().getUTCHours();
  const greeting = GREETINGS[hour] ?? '📋 Напоминание о задачах:';

  try {
    const userIds = await getUsersWithTasksToday();
    let sent = 0;
    await Promise.all(userIds.map(async uid => {
      const tasks = await getTodayTasks(uid);
      if (!tasks.length) return;
      const lines = tasks.map((t, i) => {
        const st = t.done ? '✅' : '⬜';
        const time = t.time ? `${t.time} ` : '';
        return `${st} ${time}${t.text}`;
      });
      const done = tasks.filter(t => t.done).length;
      const msg = `${greeting}\n\n${lines.join('\n')}\n\n${done}/${tasks.length} выполнено`;
      // Обрезаем безопасно (max 1000 символов)
      await sendMessage(uid, msg.length > 900 ? msg.slice(0, 897) + '...' : msg);
      sent++;
    }));
    res.json({ ok: true, hour, users: sent });
  } catch (err) {
    console.error('cron error:', JSON.stringify(err));
    res.status(500).json({ error: 'cron failed' });
  }
}
