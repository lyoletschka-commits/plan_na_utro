import type { Task } from './db';

export function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) return 'Задач на сегодня нет.';

  const lines = tasks.map((t, i) => {
    const status = t.done ? '✅' : '⬜';
    const time = t.time ? ` [${t.time}]` : '';
    return `${status} ${i + 1}.${time} ${t.text}`;
  });

  const done = tasks.filter(t => t.done).length;
  const total = tasks.length;
  return `📋 Задачи на сегодня (${done}/${total}):\n\n${lines.join('\n')}`;
}
