/**
 * Graph model for the Obsidian-style view: workflows are nodes, every
 * `wf.calls` pair is a directed link, optional "source" nodes stand for
 * the outside world (Internet, Schedules, App events, Errors).
 * Pure functions, no DOM.
 */
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { Company, Severity, TriggerKind, Workflow } from '../../data/types';
import { SOURCE_LABEL, sourceKindFor, type SourceKind } from '../../lib/layout';
import { healthTone, workflowHealth, worstSeverity } from '../../lib/health';
import { seeded } from '../../lib/rng';

export type ColorMode = 'company' | 'health' | 'trigger';

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  kind: 'workflow' | 'source';
  label: string;
  /** full name for tooltips / search */
  name: string;
  r: number;
  companyId: string | null;
  wf: Workflow | null;
  sourceKind: SourceKind | null;
  /** links of any kind */
  degree: number;
  /** workflow-to-workflow links only */
  callDegree: number;
  isolated: boolean;
  /** labels of hubs stay visible when zoomed out */
  hub: boolean;
  failing: boolean;
  inactive: boolean;
  severity: Severity | null;
  health: number;
  x: number;
  y: number;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
  kind: 'call' | 'source';
  source: GraphNode;
  target: GraphNode;
}

export interface GraphStats {
  workflows: number;
  connections: number;
  isolated: number;
  hiddenByFilter: number;
}

export interface GraphModel {
  nodes: GraphNode[];
  links: GraphLink[];
  anchors: Map<string, { x: number; y: number }>;
  stats: GraphStats;
  /** trigger kinds present among the shown workflows */
  triggerKinds: TriggerKind[];
  sourceKinds: SourceKind[];
}

export interface BuildOptions {
  showSources: boolean;
  showIsolated: boolean;
  hidden: Set<string>;
  /** previous nodes by id: positions are carried over so the graph morphs instead of exploding */
  prev: Map<string, GraphNode>;
}

export const SOURCE_ORDER: SourceKind[] = ['internet', 'schedule', 'app', 'error'];
export const sourceId = (k: SourceKind) => `src:${k}`;

/** 7–18px, scaled by sqrt(runs in the last 7 days); fixed scale so sizes mean the same for every user. */
export function radiusFor(runs7d: number): number {
  return 7 + 11 * Math.min(1, Math.sqrt(Math.max(0, runs7d)) / 45);
}
export const SOURCE_RADIUS: Record<SourceKind, number> = { internet: 24, schedule: 22, app: 20, error: 20 };

export function shortLabel(name: string, max = 26): string {
  return name.length > max ? name.slice(0, max - 1).trimEnd() + '…' : name;
}

/** Company anchor points on a circle; one company sits in the middle. */
export function companyAnchors(companyIds: string[], workflowCount: number): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const n = companyIds.length;
  if (n === 0) return out;
  if (n === 1) {
    out.set(companyIds[0]!, { x: 0, y: 0 });
    return out;
  }
  const R = Math.max(170, Math.min(360, 52 * Math.sqrt(workflowCount)));
  const offset = n === 4 ? Math.PI / 4 : n === 2 ? Math.PI / 2 : 0;
  companyIds.forEach((id, i) => {
    const a = -Math.PI / 2 + offset + (i / n) * Math.PI * 2;
    out.set(id, { x: Math.cos(a) * R, y: Math.sin(a) * R });
  });
  return out;
}

export function buildGraph(workflows: Workflow[], companies: Company[], opts: BuildOptions): GraphModel {
  const shown = workflows.filter((w) => !opts.hidden.has(w.companyId));
  const shownIds = new Set(shown.map((w) => w.id));

  // workflow → workflow links (both ends must be visible to this user and not filtered)
  const callDegree = new Map<string, number>();
  const callPairs: [string, string][] = [];
  for (const w of shown) {
    for (const target of w.calls) {
      if (!shownIds.has(target) || target === w.id) continue;
      callPairs.push([w.id, target]);
      callDegree.set(w.id, (callDegree.get(w.id) ?? 0) + 1);
      callDegree.set(target, (callDegree.get(target) ?? 0) + 1);
    }
  }
  const isolatedCount = shown.filter((w) => !(callDegree.get(w.id) ?? 0)).length;
  const kept = opts.showIsolated ? shown : shown.filter((w) => (callDegree.get(w.id) ?? 0) > 0);

  const companyIds = companies.map((c) => c.id).filter((id) => kept.some((w) => w.companyId === id));
  const anchors = companyAnchors(companyIds, kept.length);

  const nodes: GraphNode[] = [];
  const byId = new Map<string, GraphNode>();

  for (const w of kept) {
    const rand = seeded(`graph:${w.id}`);
    const anchor = anchors.get(w.companyId) ?? { x: 0, y: 0 };
    const prev = opts.prev.get(w.id);
    const a = rand() * Math.PI * 2;
    const d = 24 + rand() * 80;
    const n: GraphNode = prev ?? ({ id: w.id, x: anchor.x + Math.cos(a) * d, y: anchor.y + Math.sin(a) * d } as GraphNode);
    n.kind = 'workflow';
    n.name = w.name;
    n.label = shortLabel(w.name);
    n.r = radiusFor(w.stats.runs7d);
    n.companyId = w.companyId;
    n.wf = w;
    n.sourceKind = null;
    n.callDegree = callDegree.get(w.id) ?? 0;
    n.isolated = n.callDegree === 0;
    n.failing = w.active && w.stats.lastStatus === 'error';
    n.inactive = !w.active;
    n.severity = worstSeverity(w);
    n.health = workflowHealth(w);
    n.degree = 0;
    n.hub = false;
    nodes.push(n);
    byId.set(n.id, n);
  }

  const links: GraphLink[] = [];
  for (const [from, to] of callPairs) {
    const source = byId.get(from);
    const target = byId.get(to);
    if (!source || !target) continue;
    links.push({ id: `${from}->${to}`, kind: 'call', source, target });
  }

  const sourceKinds: SourceKind[] = [];
  if (opts.showSources) {
    const byKind = new Map<SourceKind, GraphNode[]>();
    for (const n of nodes) {
      const k = n.wf ? sourceKindFor(n.wf.trigger.kind) : null;
      if (!k) continue;
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k)!.push(n);
    }
    for (const k of SOURCE_ORDER) {
      const targets = byKind.get(k);
      if (!targets?.length) continue;
      sourceKinds.push(k);
      const id = sourceId(k);
      const rand = seeded(`graph:${id}`);
      const prev = opts.prev.get(id);
      const n: GraphNode = prev ?? ({ id, x: (rand() - 0.5) * 60, y: (rand() - 0.5) * 60 } as GraphNode);
      n.kind = 'source';
      n.name = SOURCE_LABEL[k];
      n.label = `${SOURCE_LABEL[k]} · ${targets.length}`;
      n.r = SOURCE_RADIUS[k];
      n.companyId = null;
      n.wf = null;
      n.sourceKind = k;
      n.callDegree = 0;
      n.isolated = false;
      n.failing = false;
      n.inactive = false;
      n.severity = null;
      n.health = 100;
      n.degree = 0;
      n.hub = true;
      nodes.push(n);
      byId.set(id, n);
      for (const t of targets) links.push({ id: `${id}->${t.id}`, kind: 'source', source: n, target: t });
    }
  }

  for (const l of links) {
    l.source.degree++;
    l.target.degree++;
  }
  for (const n of nodes) if (n.kind === 'workflow') n.hub = n.callDegree >= 2 || n.degree >= 4;

  const triggerKinds = Array.from(new Set(kept.map((w) => w.trigger.kind)));

  return {
    nodes,
    links,
    anchors,
    stats: { workflows: kept.length, connections: callPairs.length, isolated: isolatedCount, hiddenByFilter: workflows.length - kept.length },
    triggerKinds,
    sourceKinds,
  };
}

/* ------------------------------------------------------------------ */
/* colors                                                              */
/* ------------------------------------------------------------------ */

export const HEALTH_COLOR = { good: '#1fa463', warn: '#f2a21b', bad: '#ef4444' } as const;
export const HEALTH_LABEL = { good: 'Healthy · 85+', warn: 'Needs attention · 60 to 84', bad: 'Unhealthy · below 60' } as const;

export const TRIGGER_COLOR: Record<TriggerKind, string> = {
  webhook: '#ff6d5a',
  schedule: '#31c4ab',
  app: '#7b61ff',
  called: '#3a42e9',
  error: '#e44d26',
  manual: '#7d7d87',
  chat: '#7b61ff',
};
export const TRIGGER_LABEL: Record<TriggerKind, string> = {
  webhook: 'Webhook',
  schedule: 'Schedule',
  app: 'App event',
  called: 'Called by a workflow',
  error: 'Error trigger',
  manual: 'Manual',
  chat: 'Chat',
};

export const SOURCE_NEUTRAL = '#8a8a8a';

export function nodeColor(n: GraphNode, mode: ColorMode, companies: Map<string, Company>): string {
  if (n.kind === 'source' || !n.wf) return SOURCE_NEUTRAL;
  if (mode === 'health') return HEALTH_COLOR[healthTone(n.health)];
  if (mode === 'trigger') return TRIGGER_COLOR[n.wf.trigger.kind];
  return companies.get(n.companyId ?? '')?.color ?? SOURCE_NEUTRAL;
}

export function matchesQuery(n: GraphNode, q: string, companies: Map<string, Company>): boolean {
  if (!q) return true;
  const hay = [n.name, n.wf?.trigger.label ?? '', n.wf?.tags.join(' ') ?? '', companies.get(n.companyId ?? '')?.shortName ?? ''].join(' ').toLowerCase();
  return hay.includes(q);
}
