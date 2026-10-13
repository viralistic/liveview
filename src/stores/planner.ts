import { atom, onMount, type WritableAtom } from 'nanostores';
import { PROJECTS } from '../data/projects';
import { SEED_TASKS, WORK_END, WORK_START, type Importance, type Task } from '../data/planner';
import { NOW } from '../lib/format';
import { toast } from './session';

function persisted<T>(key: string, initial: T): WritableAtom<T> {
  const store = atom<T>(initial);
  onMount(store, () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) store.set(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    return store.listen((v) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    });
  });
  return store;
}

export const $tasks = persisted<Task[]>('lv.tasks', SEED_TASKS);
export const SEED_TASK_IDS = SEED_TASKS.map((t) => t.id);

/** Busy slots for a person: planned tasks + client calls they attend. */
export function busySlots(userId: string, tasks: Task[]): { start: number; end: number }[] {
  const slots: { start: number; end: number }[] = [];
  for (const t of tasks) if (t.assigneeId === userId && t.status === 'planned' && t.plannedAt) {
    const s = new Date(t.plannedAt).getTime();
    slots.push({ start: s, end: s + t.durationMin * 60_000 });
  }
  for (const p of PROJECTS) for (const c of p.communications) if ((c.type === 'call' || c.type === 'meeting') && c.participantIds.includes(userId)) {
    const s = new Date(c.at).getTime();
    if (s > NOW.getTime()) slots.push({ start: s, end: s + 60 * 60_000 });
  }
  return slots.sort((a, b) => a.start - b.start);
}

/**
 * Find the first free slot for a person. High: from the next full hour, today
 * or tomorrow morning. Medium: from the day after tomorrow. Working hours only,
 * weekends skipped.
 */
export function firstFreeSlot(userId: string, importance: Importance, durationMin: number, tasks: Task[]): Date | null {
  if (importance === 'low') return null;
  const busy = busySlots(userId, tasks);
  const cursor = new Date(NOW);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(cursor.getHours() + 1);
  if (importance === 'medium') {
    cursor.setDate(cursor.getDate() + 2);
    cursor.setHours(WORK_START, 0, 0, 0);
  }
  for (let guard = 0; guard < 24 * 14; guard++) {
    const day = cursor.getDay();
    if (day === 0 || day === 6 || cursor.getHours() < WORK_START || cursor.getHours() + durationMin / 60 > WORK_END) {
      // jump to next working morning
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_START, 0, 0, 0);
      continue;
    }
    const start = cursor.getTime();
    const end = start + durationMin * 60_000;
    const clash = busy.find((b) => start < b.end && end > b.start);
    if (!clash) return new Date(cursor);
    cursor.setTime(clash.end);
    cursor.setMinutes(Math.ceil(cursor.getMinutes() / 30) * 30, 0, 0);
  }
  return null;
}

export function createTask(input: { title: string; body: string; assigneeId: string; createdById: string; importance: Importance; reason: string; workflowId?: string; companyId?: string; durationMin?: number }): Task {
  const tasks = $tasks.get();
  const durationMin = input.durationMin ?? (input.importance === 'high' ? 60 : input.importance === 'medium' ? 60 : 30);
  const slot = firstFreeSlot(input.assigneeId, input.importance, durationMin, tasks);
  const task: Task = {
    id: `t-${Date.now()}-${input.assigneeId}`,
    title: input.title,
    body: input.body,
    assigneeId: input.assigneeId,
    createdById: input.createdById,
    createdAt: new Date().toISOString(),
    importance: input.importance,
    status: slot ? 'planned' : 'inbox',
    plannedAt: slot?.toISOString(),
    durationMin,
    workflowId: input.workflowId,
    companyId: input.companyId,
    reason: input.reason,
  };
  $tasks.set([...tasks, task]);
  return task;
}

export function planTask(id: string, importance: Importance = 'medium') {
  const tasks = $tasks.get();
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  const slot = firstFreeSlot(t.assigneeId, importance === 'low' ? 'medium' : importance, t.durationMin, tasks);
  $tasks.set(tasks.map((x) => (x.id === id ? { ...x, status: slot ? 'planned' : 'inbox', plannedAt: slot?.toISOString(), importance } : x)));
  toast(slot ? `Planned for ${slot.toLocaleDateString('en-GB', { weekday: 'short' })} ${slot.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'No free slot found this week');
}
export function completeTask(id: string) {
  $tasks.set($tasks.get().map((x) => (x.id === id ? { ...x, status: 'done' } : x)));
  toast('Done');
}
export function resetTasks() {
  $tasks.set(SEED_TASKS);
}

/** Open the "ask someone" composer from anywhere, optionally prefilled. */
export const $ask = atom<{ workflowId?: string; companyId?: string; assigneeId?: string } | null>(null);
export const openAsk = (prefill: { workflowId?: string; companyId?: string; assigneeId?: string } = {}) => $ask.set(prefill);
export const closeAsk = () => $ask.set(null);
