/**
 * Fork state for the demo: forks the person creates, stars, pull requests
 * they open and merges they make. Persisted to localStorage so the product
 * pages remember them; seeded forks live in data/forks.ts.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { atom, onMount, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { Fork, ForkStatus, MergeRecord, NodeSwap, Product, WfConnection, WfNode } from '../data/types';
import { FORKS, commitsWithMerges, forkSlug, forksOf, nextPrNumber, nowIso, productVersion, shortSha } from '../data/forks';
import { productById } from '../data/products';
import { toast } from './session';

/** Values the server rendered with; the server snapshot for hydration. */
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

/** Hydration-safe read of a persisted fork store (SSR renders the seed, the client re-renders with localStorage). */
export function useForkStore<T>(store: ReadableAtom<T>): T {
  return useSyncExternalStore(
    (cb) => store.listen(cb),
    () => store.get(),
    () => (INITIALS.has(store) ? (INITIALS.get(store) as T) : store.get()),
  );
}

/** Status changes to seeded forks (a pull request opened, a merge). */
export interface ForkOverride {
  status: ForkStatus;
  prNumber?: number;
  updatedAt: string;
}

export const $userForks = persisted<Fork[]>('lv.forks', []);
export const $forkStars = persisted<string[]>('lv.forkStars', []);
export const $forkOverrides = persisted<Record<string, ForkOverride>>('lv.forkStatus', {});
export const $merges = persisted<MergeRecord[]>('lv.forkMerges', []);

/** Star keys: 'product:<id>' or 'fork:<id>'. */
export const starKey = (kind: 'product' | 'fork', id: string) => `${kind}:${id}`;

/** Everything a product page needs about forks and versions, derived from the stores. */
export function useProductForks(product: Product) {
  const userForks = useForkStore($userForks);
  const overrides = useForkStore($forkOverrides);
  const merges = useForkStore($merges);
  const stars = useForkStore($forkStars);
  return useMemo(() => {
    const forks = forksOf(product.id, userForks, overrides);
    const all = [...FORKS, ...userForks].map((f) => (overrides[f.id] ? { ...f, ...overrides[f.id] } : f));
    return {
      forks,
      /** every fork of every product, for lineage lookups */
      all,
      merges,
      version: productVersion(product, merges),
      commits: commitsWithMerges(product, merges, all),
      isStarred: (key: string) => stars.includes(key),
      starCount: (base: number, key: string) => base + (stars.includes(key) ? 1 : 0),
    };
  }, [product, userForks, overrides, merges, stars]);
}

/** What a product card shows: fork count and names, version after merges, stars. */
export function useProductSummary(product: Product): { forkCount: number; forkNames: string[]; version: number; stars: number } {
  const userForks = useForkStore($userForks);
  const merges = useForkStore($merges);
  const stars = useForkStore($forkStars);
  return useMemo(() => {
    const forks = forksOf(product.id, userForks);
    return { forkCount: forks.length, forkNames: forks.map((f) => f.name), version: productVersion(product, merges), stars: product.repo.stars + (stars.includes(starKey('product', product.id)) ? 1 : 0) };
  }, [product, userForks, merges, stars]);
}

export function toggleStar(key: string) {
  const cur = $forkStars.get();
  $forkStars.set(cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]);
}

export interface CreateForkInput {
  productId: string;
  parentForkId?: string;
  name: string;
  description: string;
  swaps: NodeSwap[];
  addedNodes?: WfNode[];
  addedConnections?: WfConnection[];
  authorId: string;
  companyId: string;
}

/** Fork a product (or another fork) into a variant owned by the current person. */
export function createFork(input: CreateForkInput): Fork {
  const existing = $userForks.get();
  const id = `f-u-${Date.now().toString(36)}`;
  const f: Fork = {
    id,
    slug: forkSlug(input.name) || id,
    productId: input.productId,
    ...(input.parentForkId ? { parentForkId: input.parentForkId } : {}),
    name: input.name.trim(),
    description: input.description.trim(),
    authorId: input.authorId,
    companyId: input.companyId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    swaps: input.swaps,
    ...(input.addedNodes?.length ? { addedNodes: input.addedNodes } : {}),
    ...(input.addedConnections?.length ? { addedConnections: input.addedConnections } : {}),
    commitsAhead: 0,
    commitsBehind: 0,
    status: 'diverged',
    stars: 0,
    usedByCompanyIds: [],
  };
  $userForks.set([...existing, f]);
  toast(`Forked as ${f.name} (demo, versioned like code)`);
  return f;
}

const allForks = () => [...FORKS, ...$userForks.get()];

/** Open a pull request from a fork towards the product: status becomes pr-open. */
export function openPullRequest(fork: Fork): number {
  const prNumber = fork.prNumber ?? nextPrNumber(allForks().map((f) => ({ ...f, ...$forkOverrides.get()[f.id] })), $merges.get());
  $forkOverrides.set({ ...$forkOverrides.get(), [fork.id]: { status: 'pr-open', prNumber, updatedAt: nowIso() } });
  toast(`Pull request #${prNumber} opened for ${fork.name} (demo)`);
  return prNumber;
}

/** Merge a fork into its product: a merge commit, a version bump, status merged. */
export function mergeFork(fork: Fork, byId: string): number {
  const product = productById(fork.productId);
  if (!product) return 0;
  const merges = $merges.get();
  const prNumber = fork.prNumber ?? nextPrNumber(allForks().map((f) => ({ ...f, ...$forkOverrides.get()[f.id] })), merges);
  const version = productVersion(product, merges) + 1;
  const at = nowIso();
  $merges.set([...merges, { forkId: fork.id, productId: product.id, prNumber, byId, at, version, sha: shortSha(`merge:${fork.id}:${version}`) }]);
  $forkOverrides.set({ ...$forkOverrides.get(), [fork.id]: { status: 'merged', prNumber, updatedAt: at } });
  toast(`Merged #${prNumber} into ${product.name}: now v${version} (demo)`);
  return version;
}

/** Archive a fork the person made (seeded forks keep their history). */
export function archiveFork(fork: Fork) {
  $forkOverrides.set({ ...$forkOverrides.get(), [fork.id]: { status: 'archived', ...(fork.prNumber ? { prNumber: fork.prNumber } : {}), updatedAt: nowIso() } });
  toast(`Archived ${fork.name}`);
}

export function resetForks() {
  $userForks.set([]);
  $forkStars.set([]);
  $forkOverrides.set({});
  $merges.set([]);
}
