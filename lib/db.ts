import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
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

// ── Auth sessions (deep-link вход) ───────────────────────────────────────────

export async function createAuthSession(): Promise<string> {
  const token = randomBytes(16).toString('hex');
  const supabase = getClient();
  const { error } = await supabase.from('auth_sessions').insert({ token });
  if (error) throw new Error(`createAuthSession: ${JSON.stringify(error)}`);
  return token;
}

export async function claimAuthSession(
  token: string,
  userId: number,
  firstName: string,
  username: string,
): Promise<boolean> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('auth_sessions')
    .update({ user_id: userId, first_name: firstName, username })
    .eq('token', token)
    .is('user_id', null)
    .gt('expires_at', new Date().toISOString())
    .select()
    .single();
  if (error || !data) return false;
  return true;
}

export interface AuthSessionResult {
  user_id: number;
  first_name: string;
  username: string;
}

export async function checkAuthSession(token: string): Promise<AuthSessionResult | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('user_id, first_name, username')
    .eq('token', token)
    .not('user_id', 'is', null)
    .gt('expires_at', new Date().toISOString())
    .single();
  if (error || !data?.user_id) return null;
  // Удаляем сессию после использования
  await supabase.from('auth_sessions').delete().eq('token', token);
  return data as AuthSessionResult;
}
