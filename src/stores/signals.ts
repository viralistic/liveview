import { useSyncExternalStore } from 'react';
import { atom, onMount, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { Company, Issue, Workflow } from '../data/types';
import type { Importance, Task } from '../data/planner';
import { projectFor } from '../data/projects';
import { createTask } from './planner';

/**
 * Signals: n8n (the vendor) sees an incident on an instance it is involved in
 * and signals the allocated partner. A signal creates a planner task for the
 * project's technical owner and leaves a trail that the partner's overview and
 * the incident list show.
 */
export type SignalStatus = 'signalled' | 'acknowledged';
export interface Signal {
  id: string;
  issueId: string;
  workflowId: string;
  companyId: string;
  /** who signalled (an n8n person) */
  byId: string;
  at: string;
  note: string;
  importance: Importance;
  status: SignalStatus;
  /** the planner task the signal created, and where it landed */
  taskId?: string;
  assigneeId?: string;
  plannedAt?: string;
  acknowledgedAt?: string;
  acknowledgedById?: string;
  /** a client contact who was notified as well (local host instances) */
  notifiedId?: string;
}

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

export const $signals = persisted<Signal[]>('lv.signals', []);

/**
 * Hydration-safe read of a persisted store inside a server-rendered island:
 * the server snapshot is the given value, so the HTML never depends on
 * localStorage; React re-renders with the persisted value right after hydration.
 */
export function useClientStore<T>(store: ReadableAtom<T>, serverValue: T): T {
  return useSyncExternalStore(
    (cb) => store.listen(cb),
    () => store.get(),
    () => serverValue,
  );
}
const NONE: Signal[] = [];
export const useSignals = (): Signal[] => useClientStore($signals, NONE);

/** The most recent signal for a finding, if any. */
export function latestSignal(issueId: string, signals: Signal[]): Signal | undefined {
  for (let i = signals.length - 1; i >= 0; i--) if (signals[i]!.issueId === issueId) return signals[i];
  return undefined;
}
export function signalsForCompany(companyId: string, signals: Signal[]): Signal[] {
  return signals.filter((s) => s.companyId === companyId).sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Signal the partner: a planner task for the project's technical owner
 * (high importance lands in their calendar within a day) plus the signal record.
 */
export function sendSignal(input: { issue: Issue; wf: Workflow; company: Company; byId: string; note: string; importance: Importance; notifiedId?: string }): { signal: Signal; task: Task } {
  const project = projectFor(input.company.id);
  const assigneeId = project?.technicalOwnerId ?? 'u-mirza';
  const task = createTask({
    title: input.issue.action,
    body: input.note,
    assigneeId,
    createdById: input.byId,
    importance: input.importance,
    reason: 'Signalled by n8n Partner Success',
    workflowId: input.wf.id,
    companyId: input.company.id,
  });
  const signal: Signal = {
    id: `sig-${Date.now()}-${input.issue.id}`,
    issueId: input.issue.id,
    workflowId: input.wf.id,
    companyId: input.company.id,
    byId: input.byId,
    at: new Date().toISOString(),
    note: input.note,
    importance: input.importance,
    status: 'signalled',
    taskId: task.id,
    assigneeId,
    plannedAt: task.plannedAt,
    notifiedId: input.notifiedId,
  };
  $signals.set([...$signals.get(), signal]);
  return { signal, task };
}

export function acknowledgeSignal(id: string, byId: string) {
  $signals.set($signals.get().map((s) => (s.id === id ? { ...s, status: 'acknowledged', acknowledgedAt: new Date().toISOString(), acknowledgedById: byId } : s)));
}
export function resetSignals() {
  $signals.set([]);
}
