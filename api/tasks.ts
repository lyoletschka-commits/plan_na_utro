import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../lib/jwt';
import { getTasksByDay, getWeekTasks, saveTasks, markDone, clearTodayTasks, todayDate } from '../lib/db';
import { parseTasks } from '../lib/llm';
import { transcribeBuffer } from '../lib/transcribe';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function validateDay(d: unknown): string {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return todayDate();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const authHeader = req.headers.authorization as string | undefined;
  const token = authHeader?.replace('Bearer ', '') ?? '';
  const userId = verifyToken(token);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    if (req.method === 'GET') {
      // ?week=true — задачи за неделю, иначе за конкретный день
      if (req.query.week === 'true') {
        const weekDays = (req.query.days as string ?? '').split(',').filter(Boolean);
        const tasks = weekDays.length ? await getWeekTasks(userId, weekDays) : [];
        res.json({ tasks });
      } else {
        const day = validateDay(req.query.day);
        const tasks = await getTasksByDay(userId, day);
        res.json({ tasks });
      }

    } else if (req.method === 'POST') {
      const body = req.body as { text?: string; audioBase64?: string; mimeType?: string; day?: string };
      const day = validateDay(body.day);
      let input = body.text ?? '';

      if (body.audioBase64) {
        const buffer = Buffer.from(body.audioBase64, 'base64');
        input = await transcribeBuffer(buffer, body.mimeType ?? 'audio/webm');
      }

      if (!input.trim()) { res.status(400).json({ error: 'Нет данных' }); return; }

      const parsed = await parseTasks(input);
      if (parsed.length === 0) { res.status(422).json({ error: 'Задачи не найдены' }); return; }
      await saveTasks(userId, parsed, day);
      const tasks = await getTasksByDay(userId, day);
      res.json({ tasks, transcribed: body.audioBase64 ? input : undefined });

    } else if (req.method === 'PATCH') {
      const { taskNum, day } = req.body as { taskNum: number; day?: string };
      await markDone(userId, taskNum, validateDay(day));
      const tasks = await getTasksByDay(userId, validateDay(day));
      res.json({ tasks });

    } else if (req.method === 'DELETE') {
      const day = validateDay(req.query.day);
      await clearTodayTasks(userId, day);
      res.json({ tasks: [] });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('tasks api error:', JSON.stringify(err));
    res.status(500).json({ error: 'Внутренняя ошибка' });
  }
}
