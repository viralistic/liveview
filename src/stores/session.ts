/**
 * Client session state shared across Astro islands.
 * Persisted to localStorage so the demo remembers who you are,
 * which companies you pinned, and any access changes you made.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { atom, computed, onMount, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { Grant, Role, Scope } from '../data/types';
import { INITIAL_GRANTS, USERS, userById } from '../data/users';
import { COMPANIES } from '../data/companies';
import { sameScope, visibleCompanies, visibleWorkflows } from '../lib/access';
import { personaOf } from '../lib/persona';
import { orgOfUser } from '../data/orgs';
import type { Capability } from '../data/personas';

/** Values the server rendered with; used as React's server snapshot so hydration never mismatches. */
const INITIALS = new WeakMap<object, unknown>();

/** Register the server-rendered value of a store created elsewhere, so useStore hydrates without a mismatch. */
export function registerInitial<T>(store: ReadableAtom<T>, initial: T) {
  INITIALS.set(store, initial);
}

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
    const unsub = store.listen((v) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    });
    return unsub;
  });
  return store;
}

export const $currentUserId = persisted<string>('lv.user', 'u-marrallisa');
export const $pinned = persisted<string[]>('lv.pinned', COMPANIES.filter((c) => c.defaultPinned).map((c) => c.id));
export const $grants = persisted<Grant[]>('lv.grants', INITIAL_GRANTS);
export const $sidebarCollapsed = persisted<boolean>('lv.sidebar', false);
export const $heatmap = persisted<boolean>('lv.heatmap', true);

export const $currentUser = computed($currentUserId, (id) => userById(id) ?? USERS[0]!);
export const $visibleWorkflows = computed([$currentUserId, $grants], (uid, grants) => visibleWorkflows(uid, grants));
export const $visibleCompanies = computed([$currentUserId, $grants], (uid, grants) => visibleCompanies(uid, grants));

/**
 * Hydration-safe store hook for SSR'd islands. During hydration React uses the
 * server snapshot (the store's initial value), then re-renders with the
 * persisted client value. Use this instead of @nanostores/react in components
 * that are server-rendered (client:load). client:only components may use either.
 */
export function useStore<T>(store: ReadableAtom<T>): T {
  return useSyncExternalStore(
    (cb) => store.listen(cb),
    () => store.get(),
    () => (INITIALS.has(store) ? (INITIALS.get(store) as T) : store.get()),
  );
}

/** Everything a component needs to know about "who is looking", derived from base atoms. */
export function useSession() {
  const userId = useStore($currentUserId);
  const grants = useStore($grants);
  return useMemo(() => {
    const user = userById(userId) ?? USERS[0]!;
    const persona = personaOf(user);
    return {
      userId,
      user,
      grants,
      persona,
      org: orgOfUser(user),
      /** persona capability check: what this kind of person may do in LiveView */
      can: (cap: Capability) => persona.capabilities.includes(cap),
      visibleWorkflows: visibleWorkflows(userId, grants),
      visibleCompanies: visibleCompanies(userId, grants),
    };
  }, [userId, grants]);
}

/** Mobile: the sidebar becomes a drawer, opened from the topbar or the tab bar. */
export const $mobileNav = atom<boolean>(false);
export const openMobileNav = () => $mobileNav.set(true);
export const closeMobileNav = () => $mobileNav.set(false);

/** True under the mobile breakpoint; false on the server and during hydration. */
export function useIsMobile(query = '(max-width: 900px)'): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined') return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
    () => false,
  );
}

/** Appearance: follows the OS unless the person picks one. */
export type ThemeChoice = 'system' | 'light' | 'dark';
export const $theme = persisted<ThemeChoice>('lv.theme', 'system');
export function applyTheme(choice: ThemeChoice) {
  if (typeof document === 'undefined') return;
  if (choice === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', choice);
}
export function cycleTheme() {
  const order: ThemeChoice[] = ['system', 'light', 'dark'];
  const next = order[(order.indexOf($theme.get()) + 1) % order.length]!;
  $theme.set(next);
  applyTheme(next);
  toast(next === 'system' ? 'Theme follows your system' : `${next === 'dark' ? 'Dark' : 'Light'} theme`);
}

/** Video modal (the avatar easter egg). */
export const $video = atom<{ url: string; title: string } | null>(null);
export const openVideo = (url: string, title: string) => $video.set({ url, title });
export const closeVideo = () => $video.set(null);

/** Share dialog: which scope is being shared (null = closed). */
export const $shareDialog = atom<Scope | null>(null);
export const openShare = (scope: Scope) => $shareDialog.set(scope);
export const closeShare = () => $shareDialog.set(null);

/** Tiny toast */
export const $toast = atom<{ id: number; text: string } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string) {
  $toast.set({ id: Date.now(), text });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.set(null), 2400);
}

export function switchUser(id: string) {
  $currentUserId.set(id);
  toast(`Now viewing as ${userById(id).name}`);
}

export function togglePin(companyId: string) {
  const cur = $pinned.get();
  $pinned.set(cur.includes(companyId) ? cur.filter((c) => c !== companyId) : [...cur, companyId]);
}

export function setGrant(userId: string, scope: Scope, role: Role | null, grantedById = $currentUserId.get()) {
  const cur = $grants.get();
  const rest = cur.filter((g) => !(g.userId === userId && sameScope(g.scope, scope)));
  if (role) {
    rest.push({ id: `g-${Date.now()}-${userId}`, userId, scope, role, grantedById, grantedAt: new Date().toISOString() });
  }
  $grants.set(rest);
}

export function resetDemo() {
  $grants.set(INITIAL_GRANTS);
  $pinned.set(COMPANIES.filter((c) => c.defaultPinned).map((c) => c.id));
  $currentUserId.set('u-marrallisa');
  toast('Demo data reset');
  // every other store (planner, fixes, signals, projects, forks, tiles) lives under lv.*; wipe and reload
  if (typeof window !== 'undefined') {
    try {
      const keep = new Set(['lv.theme', 'lv.sidebar']);
      for (const k of Object.keys(window.localStorage)) if (k.startsWith('lv.') && !keep.has(k)) window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
    setTimeout(() => window.location.assign('/'), 350);
  }
}
