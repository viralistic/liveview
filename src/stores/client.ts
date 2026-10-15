/**
 * Client experience state: the tile layout of a dashboard (per person) and
 * the result of an AI scan (per company, or per vertical). Both persist in
 * localStorage so a reload keeps them. Same `persisted()` pattern as the
 * planner store, plus a hydration-safe hook for SSR'd islands.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { atom, onMount, type WritableAtom } from 'nanostores';

const STORES = new Map<string, WritableAtom<unknown>>();
/** Values the server rendered with; React's server snapshot so hydration never mismatches. */
const INITIALS = new WeakMap<object, unknown>();

function persisted<T>(key: string, initial: T): WritableAtom<T> {
  const store = atom<T>(initial);
  INITIALS.set(store, initial);
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

/** One persisted atom per key, created on first use (keys carry a user or company id). */
export function persistedFor<T>(key: string, initial: T): WritableAtom<T> {
  let store = STORES.get(key);
  if (!store) {
    store = persisted(key, initial) as WritableAtom<unknown>;
    STORES.set(key, store);
  }
  return store as WritableAtom<T>;
}

/** Hydration-safe: the server snapshot is the initial value, the persisted value follows after mount. */
export function usePersisted<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const store = persistedFor(key, initial);
  const value = useSyncExternalStore(
    (cb) => store.listen(cb),
    () => store.get(),
    () => INITIALS.get(store) as T,
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => store.set(typeof next === 'function' ? (next as (prev: T) => T)(store.get()) : next),
    [store],
  );
  return [value, set];
}

/* ------------------------------------------------------------------ */
/* Tile layout: the order of the tiles on a dashboard, per person.      */
/* ------------------------------------------------------------------ */
export const tilesKey = (userId: string) => `lv.tiles.${userId}`;
/** Saved tile order, or null for the default layout. */
export function useTileOrder(userId: string) {
  return usePersisted<string[] | null>(tilesKey(userId), null);
}
/** Merge a saved order with the tiles that exist today: unknown ids drop, new tiles append in default order. */
export function resolveOrder(saved: string[] | null, defaults: string[]): string[] {
  if (!saved) return defaults;
  const known = saved.filter((id) => defaults.includes(id));
  for (const id of defaults) if (!known.includes(id)) known.push(id);
  return known;
}

/* ------------------------------------------------------------------ */
/* AI scan: when it last ran and how many findings it produced.         */
/* Findings themselves are derived from the data, so they need no store.*/
/* ------------------------------------------------------------------ */
export interface ScanState {
  at: string;
  findings: number;
}
export const scanKey = (companyId: string, verticalId?: string) => (verticalId ? `lv.scan.${companyId}.${verticalId}` : `lv.scan.${companyId}`);
export function useScanState(companyId: string, verticalId?: string) {
  return usePersisted<ScanState | null>(scanKey(companyId, verticalId), null);
}
