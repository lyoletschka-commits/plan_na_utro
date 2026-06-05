import { env } from './env';

const BASE = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}`;

export async function sendMessage(chatId: number, text: string, parseMode?: string): Promise<void> {
  // Обрезаем длинные сообщения и снимаем parse_mode во избежание HTML-ошибок
  const safeText = text.length > 1000 ? text.slice(0, 997) + '...' : text;
  const body: Record<string, unknown> = { chat_id: chatId, text: safeText };
  if (parseMode && safeText.length <= 1000) body.parse_mode = parseMode;

  const res = await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('sendMessage error:', err);
  }
}

export async function getFile(fileId: string): Promise<string> {
  const res = await fetch(`${BASE}/getFile?file_id=${fileId}`);
  const data = await res.json() as { ok: boolean; result: { file_path: string } };
  if (!data.ok) throw new Error('getFile failed');
  return `https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${data.result.file_path}`;
}
