import { sendMessage, getFile } from './telegram';
import { transcribeAudio } from './transcribe';
import { parseTasks } from './llm';
import { saveTasks, getTodayTasks, markDone, clearTodayTasks } from './db';
import { formatTaskList } from './format';

interface TelegramMessage {
  chat: { id: number };
  from?: { id: number };
  text?: string;
  voice?: { file_id: string };
  audio?: { file_id: string };
}

export async function handleMessage(msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id ?? chatId;

  try {
    const text = msg.text ?? '';

    if (text === '/start') {
      await sendMessage(chatId,
        'Привет! Я бот утреннего планирования 🌅\n\n' +
        'Расскажи мне голосом или текстом, что планируешь на сегодня — я разберу задачи и сохраню их.\n\n' +
        'Команды:\n' +
        '/today — список задач на сегодня\n' +
        '/done <номер> — отметить задачу выполненной\n' +
        '/clear — очистить список на сегодня'
      );
      return;
    }

    if (text === '/today') {
      const tasks = await getTodayTasks(userId);
      await sendMessage(chatId, formatTaskList(tasks));
      return;
    }

    if (text.startsWith('/done')) {
      const num = parseInt(text.split(' ')[1] ?? '', 10);
      if (isNaN(num) || num < 1) {
        await sendMessage(chatId, 'Укажи номер задачи: /done 2');
        return;
      }
      const ok = await markDone(userId, num);
      if (ok) {
        const tasks = await getTodayTasks(userId);
        await sendMessage(chatId, `Отлично! Задача ${num} выполнена ✅\n\n${formatTaskList(tasks)}`);
      } else {
        await sendMessage(chatId, `Задача ${num} не найдена.`);
      }
      return;
    }

    if (text === '/clear') {
      await clearTodayTasks(userId);
      await sendMessage(chatId, 'Список задач на сегодня очищен 🗑');
      return;
    }

    // Голосовое сообщение
    let userInput = text;
    if (msg.voice || msg.audio) {
      const fileId = msg.voice?.file_id ?? msg.audio?.file_id ?? '';
      await sendMessage(chatId, '🎧 Распознаю голосовое сообщение...');
      const fileUrl = await getFile(fileId);
      userInput = await transcribeAudio(fileUrl);
      await sendMessage(chatId, `📝 Распознано: ${userInput}`);
    }

    if (!userInput.trim()) {
      await sendMessage(chatId, 'Отправь мне текст или голосовое сообщение с планами на день.');
      return;
    }

    await sendMessage(chatId, '🤔 Разбираю задачи...');
    const tasks = await parseTasks(userInput);

    if (tasks.length === 0) {
      await sendMessage(chatId, 'Не удалось найти задачи в сообщении. Попробуй описать планы подробнее.');
      return;
    }

    await saveTasks(userId, tasks);
    const allTasks = await getTodayTasks(userId);
    await sendMessage(chatId, `Добавлено задач: ${tasks.length} 🎯\n\n${formatTaskList(allTasks)}`);

  } catch (err) {
    console.error('handleMessage error:', JSON.stringify(err));
    await sendMessage(chatId, 'Произошла ошибка. Попробуй ещё раз позже.');
  }
}
