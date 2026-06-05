import { createClient } from '@supabase/supabase-js';
import { env } from './env';
import type { ParsedTask } from './llm';

export interface Task {
  id: number;
  user_id: number;
  text: string;
  time: string | null;
  day: string;
  done: boolean;
  created_at: string;
}

function getClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function saveTasks(userId: number, tasks: ParsedTask[]): Promise<void> {
  const supabase = getClient();
  const day = todayDate();
  const rows = tasks.map(t => ({ user_id: userId, text: t.text, time: t.time ?? null, day, done: false }));
  const { error } = await supabase.from('tasks').insert(rows);
  if (error) throw new Error(`saveTasks: ${JSON.stringify(error)}`);
}

export async function getTodayTasks(userId: number): Promise<Task[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('day', todayDate())
    .order('time', { ascending: true, nullsFirst: false });
  if (error) throw new Error(`getTodayTasks: ${JSON.stringify(error)}`);
  return (data ?? []) as Task[];
}

export async function markDone(userId: number, taskNum: number): Promise<boolean> {
  const tasks = await getTodayTasks(userId);
  const task = tasks[taskNum - 1];
  if (!task) return false;
  const supabase = getClient();
  const { error } = await supabase.from('tasks').update({ done: true }).eq('id', task.id);
  if (error) throw new Error(`markDone: ${JSON.stringify(error)}`);
  return true;
}

export async function clearTodayTasks(userId: number): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId)
    .eq('day', todayDate());
  if (error) throw new Error(`clearTodayTasks: ${JSON.stringify(error)}`);
}
