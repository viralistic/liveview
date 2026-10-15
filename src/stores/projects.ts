import { atom, onMount, type WritableAtom } from 'nanostores';
import { COMPANIES } from '../data/companies';
import { defaultSettings, type ProjectSettings } from '../data/settings';
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

/** Overrides per project (companyId or new project id) on top of the defaults. */
export const $projectSettings = persisted<Record<string, Partial<ProjectSettings>>>('lv.projectSettings', {});
registerInitial($projectSettings, {});

/** Projects created in the demo with the "+" wizard. They exist only here. */
export interface NewProject {
  id: string;
  slug: string;
  createdAt: string;
  createdById: string;
  settings: ProjectSettings;
}
export const $newProjects = persisted<NewProject[]>('lv.newProjects', []);
registerInitial($newProjects, []);

export function settingsFor(projectId: string, overrides: Record<string, Partial<ProjectSettings>>, newProjects: NewProject[]): ProjectSettings | null {
  const company = COMPANIES.find((c) => c.id === projectId);
  const base = company ? defaultSettings(company) : newProjects.find((p) => p.id === projectId)?.settings;
  if (!base) return null;
  return { ...base, ...(overrides[projectId] ?? {}) };
}

export function saveSettings(projectId: string, next: ProjectSettings) {
  const company = COMPANIES.find((c) => c.id === projectId);
  if (company) {
    const base = defaultSettings(company);
    const diff: Partial<ProjectSettings> = {};
    for (const k of Object.keys(next) as (keyof ProjectSettings)[]) {
      if (next[k] !== base[k]) (diff as Record<string, unknown>)[k] = next[k];
    }
    $projectSettings.set({ ...$projectSettings.get(), [projectId]: diff });
  } else {
    $newProjects.set($newProjects.get().map((p) => (p.id === projectId ? { ...p, settings: next } : p)));
    $projectSettings.set({ ...$projectSettings.get(), [projectId]: {} });
  }
  toast('Project settings saved');
}
export function resetSettings(projectId: string) {
  const cur = { ...$projectSettings.get() };
  delete cur[projectId];
  $projectSettings.set(cur);
  toast('Settings back to defaults');
}

export function createProject(settings: ProjectSettings, createdById: string): NewProject {
  const slug = settings.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'new-project';
  const project: NewProject = { id: `np-${Date.now()}`, slug, createdAt: new Date().toISOString(), createdById, settings };
  $newProjects.set([...$newProjects.get(), project]);
  return project;
}
export function removeProject(id: string) {
  $newProjects.set($newProjects.get().filter((p) => p.id !== id));
  const cur = { ...$projectSettings.get() };
  delete cur[id];
  $projectSettings.set(cur);
  toast('Project removed');
}

/** Dialog state */
export const $settingsDialog = atom<string | null>(null);
export const openProjectSettings = (projectId: string) => $settingsDialog.set(projectId);
export const closeProjectSettings = () => $settingsDialog.set(null);
export const $newProjectDialog = atom<boolean>(false);
export const openNewProject = () => $newProjectDialog.set(true);
export const closeNewProject = () => $newProjectDialog.set(false);
