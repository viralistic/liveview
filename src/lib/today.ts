import { PROJECTS } from '../data/projects';
import { COMPANIES } from '../data/companies';
import type { Task } from '../data/planner';
import { NOW } from './format';

/**
 * "Today" for a person: what needs them now, and what is coming up.
 * Upcoming items come from client calls, agreed next steps and planned tasks.
 */
export interface Upcoming {
  title: string;
  at: string;
  companyId?: string;
  kind: 'call' | 'step' | 'task';
}

const DAY = 86_400_000;

/** The same call or step mentioned twice (a planned step and its meeting on the same day). */
function sameThing(u: Upcoming, title: string, at: string): boolean {
  if (u.at.slice(0, 10) !== at.slice(0, 10)) return false;
  const a = u.title.toLowerCase();
  const b = title.toLowerCase();
  return a === b || a.startsWith(b) || b.startsWith(a);
}

export function upcomingFor(companyIds: string[], tasks: Task[] = [], userId?: string, days = 14): Upcoming[] {
  const out: Upcoming[] = [];
  const now = NOW.getTime();
  const until = now + days * DAY;
  for (const p of PROJECTS) {
    if (!companyIds.includes(p.companyId)) continue;
    for (const c of p.communications) {
      const t = new Date(c.at).getTime();
      if ((c.type === 'call' || c.type === 'meeting' || c.type === 'workshop') && t > now && t <= until) out.push({ title: c.title, at: c.at, companyId: p.companyId, kind: 'call' });
    }
    for (const st of p.nextSteps) {
      const t = new Date(st.at).getTime();
      if (!st.done && t > now && t <= until && !out.some((u) => sameThing(u, st.title, st.at))) out.push({ title: st.title, at: st.at, companyId: p.companyId, kind: 'step' });
    }
  }
  for (const task of tasks) {
    if (task.status !== 'planned' || !task.plannedAt) continue;
    if (userId && task.assigneeId !== userId) continue;
    const t = new Date(task.plannedAt).getTime();
    if (t > now && t <= until) out.push({ title: task.title, at: task.plannedAt, companyId: task.companyId, kind: 'task' });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** "today", "tomorrow", "Thursday", or "23 Oct" */
export function whenLabel(iso: string): string {
  const d = new Date(iso);
  const start = new Date(NOW);
  start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - start.getTime()) / DAY);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Europe/Amsterdam' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' });
}

export function companyShort(id?: string): string {
  return COMPANIES.find((c) => c.id === id)?.shortName ?? '';
}
