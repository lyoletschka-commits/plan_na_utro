import { env } from './env';

// Транскрибирование из буфера (для Web API)
export async function transcribeBuffer(buffer: Buffer, mimeType = 'audio/webm'): Promise<string> {
  const blob = new Blob([buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer], { type: mimeType });
  return transcribeBlob(blob);
}

// Транскрибирование по URL (для Telegram voice)
export async function transcribeAudio(fileUrl: string): Promise<string> {
  const audioRes = await fetch(fileUrl);
  const audioBlob = await audioRes.blob();

  return transcribeBlob(audioBlob);
}

async function transcribeBlob(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', blob, 'voice.ogg');
  form.append('model', 'whisper-large-v3');
  form.append('language', 'ru');
  form.append('response_format', 'text');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Transcription failed: ${err}`);
  }

  return (await res.text()).trim();
}
