import { env } from './env';

export interface ParsedTask {
  text: string;
  time: string | null;
}

const SYSTEM_PROMPT = `Ты помощник утреннего планирования. Пользователь описывает свои планы на день — голосом или текстом.
Твоя задача: извлечь список задач и вернуть JSON-массив объектов {text, time}.
- text: краткое описание задачи (на русском, повелительное наклонение или инфинитив)
- time: время в формате HH:MM или null если не указано
Верни ТОЛЬКО JSON-массив без пояснений. Пример: [{"text":"Позвонить врачу","time":"10:00"},{"text":"Купить продукты","time":null}]`;

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
        { role: 'system', content: SYSTEM_PROMPT },
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
    return JSON.parse(match ? match[0] : content) as ParsedTask[];
  } catch {
    throw new Error(`Не удалось разобрать ответ LLM: ${content}`);
  }
}
