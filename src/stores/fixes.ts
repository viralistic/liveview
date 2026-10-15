import { atom, onMount, type WritableAtom } from 'nanostores';
import type { Issue } from '../data/types';
import { proposeFix, type FixProposal } from '../data/fixes';
import { registerInitial, toast } from './session';

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

export const $proposals = persisted<FixProposal[]>('lv.fixes', []);
registerInitial($proposals, []);

export function proposalFor(issueId: string, proposals: FixProposal[]): FixProposal | undefined {
  return proposals.find((p) => p.issueId === issueId && p.status !== 'rejected');
}

/** Ask the model for a fix. Returns the proposal (existing one if already requested). */
export function requestFix(issue: Issue, requestedById: string): FixProposal {
  const existing = proposalFor(issue.id, $proposals.get());
  if (existing) return existing;
  const p: FixProposal = { ...proposeFix(issue, requestedById), id: `fix-${Date.now()}`, createdAt: new Date().toISOString(), status: 'proposed' };
  $proposals.set([...$proposals.get(), p]);
  return p;
}
export function reviewFix(id: string, decision: 'accepted' | 'rejected') {
  $proposals.set($proposals.get().map((p) => (p.id === id ? { ...p, status: decision } : p)));
  toast(decision === 'accepted' ? 'Fix accepted. Applying in the staging container…' : 'Fix rejected');
  if (decision === 'accepted') setTimeout(() => $proposals.set($proposals.get().map((p) => (p.id === id ? { ...p, status: 'applied' } : p))), 2200);
}
export function resetFixes() {
  $proposals.set([]);
}
