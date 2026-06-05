import { env } from './env';

export interface ParsedTask {
  text: string;
  time: string | null;
  date: string | null; // YYYY-MM-DD если указан конкретный день, иначе null
}

function buildSystemPrompt(): string {
  const now = new Date();
  // Дата в локальном времени сервера (UTC)
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const wd = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'][now.getUTCDay()];

  return `Сегодня ${todayStr} (${wd}).
Ты помощник планирования. Пользователь описывает задачи — голосом или текстом.
Извлеки список задач и верни JSON-массив объектов {text, time, date}.
- text: краткое описание задачи (русский, инфинитив или повелительное)
- time: время HH:MM или null
- date: если пользователь указал день («в пятницу», «завтра», «послезавтра», «15 июня», «на следующей неделе в среду» и т.д.) — вычисли точную дату YYYY-MM-DD относительно сегодня. Если день не указан — null.
Верни ТОЛЬКО JSON-массив без пояснений.
Пример: [{"text":"Купить продукты","time":null,"date":null},{"text":"Встреча с врачом","time":"15:00","date":"2026-06-13"}]`;
}

export async function parseTasks(userMessage: string): Promise<ParsedTask[]> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM failed: ${err}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  const content = data.choices[0].message.content.trim();

  try {
    const match = content.match(/\[[\s\S]*\]/);
    const tasks = JSON.parse(match ? match[0] : content) as ParsedTask[];
    // Валидация date: должна быть YYYY-MM-DD или null
    return tasks.map(t => ({
      text: t.text,
      time: t.time ?? null,
      date: (typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) ? t.date : null,
    }));
  } catch {
    throw new Error(`Не удалось разобрать ответ LLM: ${content}`);
  }
}
