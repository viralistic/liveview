/**
 * Obsidian-style graph view: every workflow the current user may see is a
 * node, every "Execute Workflow" relation a directed thread with data
 * travelling along it, and the outside world (Internet, Schedules, App
 * events, Errors) shows up as hollow source nodes. Force layout by d3-force,
 * rendered as SVG in world coordinates. Other people's cursors wander
 * around the graph and poke at nodes.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type ForceLink, type ForceManyBody, type Simulation } from 'd3-force';
import { Clock, Globe, Maximize2, Minus, Plus, TriangleAlert, Waypoints, Zap, type LucideIcon } from 'lucide-react';
import { USERS } from '../../data/users';
import { workflowById } from '../../data/workflows';
import type { Workflow } from '../../data/types';
import { $currentUser, $grants, $heatmap, $visibleCompanies, $visibleWorkflows, toast, useStore } from '../../stores/session';
import { canSeeWorkflow, highestRole } from '../../lib/access';
import { SEVERITY_HEX } from '../../lib/health';
import type { SourceKind } from '../../lib/layout';
import { Avatar } from '../ui/Avatar';
import { WorkflowPanel } from '../pages/WorkflowPanel';
import { NewWorkflowButton, draftWorkflow } from '../canvas/NewWorkflow';
import { buildGraph, matchesQuery, nodeColor, type GraphLink, type GraphNode } from './model';
import { forceCluster, type ClusterForce } from './forces';
import { Controls, DEFAULT_SETTINGS, type Settings } from './Controls';
import { Legend } from './Legend';
import { GraphCursors, type CursorHost } from './GraphCursors';
import type { BotSpec, Pt } from './cursorBots';
import s from './graph.module.css';

const SOURCE_ICON: Record<SourceKind, LucideIcon> = { internet: Globe, schedule: Clock, app: Zap, error: TriangleAlert };
const MIN_K = 0.25;
const MAX_K = 3;
/** floating glass rail: 380px wide, inset 16px */
const PANEL_W = 380 + 16;
const LABEL_PX = 12.5;
const SOURCE_LABEL_PX = 10.5;

interface View {
  x: number;
  y: number;
  k: number;
}
interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  id?: string;
}
type Placement = 'b' | 't' | 'r' | 'l';
const PLACEMENTS: Placement[] = ['b', 't', 'r', 'l'];

/** A curved thread between two nodes: quadratic bezier, trimmed at the node edges. */
interface Thread {
  link: GraphLink;
  d: string;
  p0: Pt;
  c: Pt;
  p1: Pt;
  len: number;
  phase: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const readFocus = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('focus'));
const intersects = (a: Box, b: Box) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
/** rough text width for 12.5px Geist medium, used for label occlusion */
const estWidth = (n: GraphNode) => (n.kind === 'source' ? n.label.length * 7.2 : n.label.length * 6.7);
/** screen-space box a label would occupy at a given placement around a node */
function labelBox(p: Placement, sx: number, sy: number, rr: number, w: number): Box {
  if (p === 'b') return { x1: sx - w / 2 - 3, y1: sy + rr + 5, x2: sx + w / 2 + 3, y2: sy + rr + 21 };
  if (p === 't') return { x1: sx - w / 2 - 3, y1: sy - rr - 21, x2: sx + w / 2 + 3, y2: sy - rr - 5 };
  if (p === 'r') return { x1: sx + rr + 6, y1: sy - 8.5, x2: sx + rr + 10 + w, y2: sy + 8.5 };
  return { x1: sx - rr - 10 - w, y1: sy - 8.5, x2: sx - rr - 6, y2: sy + 8.5 };
}
const hash01 = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};
function threadFor(l: GraphLink, k: number): Thread | null {
  const sx = l.source.x;
  const sy = l.source.y;
  const tx = l.target.x;
  const ty = l.target.y;
  const dx = tx - sx;
  const dy = ty - sy;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const endGap = l.kind === 'call' ? l.target.r + 9 / k : l.target.r + 2;
  if (d <= l.source.r + endGap + 6) return null;
  // bulge to the left of the direction of travel, so reciprocal threads curve apart
  const bulge = Math.min(72, d * 0.17) * (l.kind === 'source' ? 0.55 : 1);
  const c = { x: (sx + tx) / 2 - uy * bulge, y: (sy + ty) / 2 + ux * bulge };
  const a0 = Math.hypot(c.x - sx, c.y - sy) || 1;
  const a1 = Math.hypot(c.x - tx, c.y - ty) || 1;
  const p0 = { x: sx + ((c.x - sx) / a0) * (l.source.r + 1), y: sy + ((c.y - sy) / a0) * (l.source.r + 1) };
  const p1 = { x: tx + ((c.x - tx) / a1) * endGap, y: ty + ((c.y - ty) / a1) * endGap };
  return { link: l, d: `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`, p0, c, p1, len: d + bulge * 0.35, phase: hash01(l.id) };
}
const quadPoint = (p0: Pt, c: Pt, p1: Pt, t: number): Pt => {
  const mt = 1 - t;
  return { x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x, y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y };
};

export function Graph() {
  const me = useStore($currentUser);
  const grants = useStore($grants);
  const workflows = useStore($visibleWorkflows);
  const companies = useStore($visibleCompanies);
  const heatmap = useStore($heatmap);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [selectedId, setSelectedId] = useState<string | null>(readFocus);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [botHover, setBotHover] = useState<Record<string, string | null>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [legendPinned, setLegendPinned] = useState(false);
  const [followId, setFollowId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Workflow[]>([]);
  const [view, setViewState] = useState<View>({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [, setFrame] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const linkRef = useRef<ForceLink<GraphNode, GraphLink> | null>(null);
  const clusterRef = useRef<ClusterForce | null>(null);
  /** every node ever seen (positions carry over when a node comes back) */
  const nodeMapRef = useRef(new Map<string, GraphNode>());
  /** nodes currently in the graph */
  const liveNodesRef = useRef(new Map<string, GraphNode>());
  const viewRef = useRef(view);
  const sizeRef = useRef(size);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const userMovedRef = useRef(false);
  const botTouchedRef = useRef(false);
  const startedRef = useRef(false);
  const rafRef = useRef(0);
  const animRef = useRef(0);
  const dragRef = useRef<string | null>(null);
  const followRef = useRef(followId);
  followRef.current = followId;
  const appliedForcesRef = useRef({ linkDistance: DEFAULT_SETTINGS.linkDistance, repulsion: DEFAULT_SETTINGS.repulsion });
  const lastPlacementRef = useRef(new Map<string, Placement>());
  const threadsRef = useRef(new Map<string, Thread>());
  const blobEls = useRef(new Map<string, SVGCircleElement>());

  /* ---------------- model ---------------- */
  const hidden = useMemo(() => new Set(settings.hiddenCompanies), [settings.hiddenCompanies]);
  const allWorkflows = useMemo(() => (drafts.length ? [...workflows, ...drafts] : workflows), [workflows, drafts]);
  const graph = useMemo(
    () => buildGraph(allWorkflows, companies, { showSources: settings.showSources, showIsolated: settings.showIsolated, hidden, prev: nodeMapRef.current }),
    [allWorkflows, companies, settings.showSources, settings.showIsolated, hidden],
  );
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of workflows) m.set(w.companyId, (m.get(w.companyId) ?? 0) + 1);
    return m;
  }, [workflows]);
  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Set());
      m.get(a)!.add(b);
    };
    for (const l of graph.links) {
      add(l.source.id, l.target.id);
      add(l.target.id, l.source.id);
    }
    return m;
  }, [graph]);

  // other people's cursors: every online user but the viewer, limited to nodes they may see
  const botSpecs = useMemo<BotSpec[]>(() => {
    const out: BotSpec[] = [];
    const nodeIds = graph.nodes.filter((n) => n.kind === 'workflow' && !n.draft).map((n) => n.id);
    for (const u of USERS) {
      if (!u.online || u.id === me.id) continue;
      const targets = nodeIds.filter((id) => {
        const wf = workflowById(id);
        return !!wf && canSeeWorkflow(u.id, wf, grants);
      });
      if (!targets.length) continue;
      const viewing = u.presence?.viewing;
      const preferred = viewing ? targets.filter((id) => id === viewing || workflowById(id)?.companyId === viewing) : [];
      const viewingWf = viewing ? workflowById(viewing) : undefined;
      const viewingLabel = viewingWf ? viewingWf.name : viewing ? (companyMap.get(viewing)?.shortName ?? 'the graph') : 'the graph';
      out.push({ user: u, targets, preferred, viewingLabel });
    }
    return out;
  }, [graph, grants, me.id, companyMap]);

  const selectedWf = selectedId ? workflows.find((w) => w.id === selectedId) ?? null : null;
  const panelOpen = !!selectedWf;
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;
  const controlsOpenRef = useRef(controlsOpen);
  controlsOpenRef.current = controlsOpen;
  const myRole = highestRole(me.id, grants);
  const viewOnly = myRole === 'viewer' || myRole === 'commenter';

  /* ---------------- viewport helpers ---------------- */
  const setView = useCallback((v: View) => {
    viewRef.current = v;
    setViewState(v);
  }, []);
  /** the person moved the camera themselves: no auto-fit, no follow */
  const userInteracted = useCallback(() => {
    userMovedRef.current = true;
    if (followRef.current) setFollowId(null);
  }, []);

  const animateTo = useCallback(
    (target: View, duration = 320) => {
      cancelAnimationFrame(animRef.current);
      const from = viewRef.current;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = easeOut(t);
        setView({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e });
        if (t < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    },
    [setView],
  );

  const fitRef = useRef<(animate: boolean) => void>(() => {});
  fitRef.current = (animate) => {
    const nodes = graph.nodes;
    const { w, h } = sizeRef.current;
    if (!nodes.length || !w || !h) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r);
      maxY = Math.max(maxY, n.y + n.r);
    }
    const pad = { l: 110, r: 110 + (controlsOpenRef.current ? 272 : 56), t: 70, b: 110 };
    const availW = Math.max(120, w - (panelOpenRef.current ? PANEL_W : 0) - pad.l - pad.r);
    const availH = Math.max(120, h - pad.t - pad.b);
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY + 22);
    const k = clamp(Math.min(availW / bw, availH / bh), MIN_K, 1.15);
    const cx = pad.l + availW / 2;
    const cy = pad.t + availH / 2;
    const target = { k, x: cx - ((minX + maxX) / 2) * k, y: cy - ((minY + maxY + 22) / 2) * k };
    if (animate) animateTo(target);
    else setView(target);
  };

  const focusRef = useRef<(id: string, animate: boolean) => void>(() => {});
  focusRef.current = (id, animate) => {
    const n = graph.nodes.find((x) => x.id === id);
    if (!n || n.kind !== 'workflow') {
      toast(workflows.some((w) => w.id === id) ? 'That workflow is filtered out of the graph' : 'That workflow is not visible to you');
      return;
    }
    setSelectedId(id);
    const { w, h } = sizeRef.current;
    const k = clamp(viewRef.current.k, 1.15, 1.6);
    const cx = (w - PANEL_W) / 2;
    const cy = h / 2;
    userMovedRef.current = true;
    const target = { k, x: cx - n.x * k, y: cy - n.y * k };
    if (animate) animateTo(target);
    else setView(target);
  };

  const zoomBy = useCallback(
    (factor: number) => {
      const v = viewRef.current;
      const { w, h } = sizeRef.current;
      const cx = (w - (panelOpenRef.current ? PANEL_W : 0)) / 2;
      const cy = h / 2;
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      const r = k / v.k;
      userInteracted();
      animateTo({ k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r }, 200);
    },
    [animateTo, userInteracted],
  );

  /** follow mode: ease the camera towards a world point every frame */
  const followPoint = useCallback(
    (p: Pt) => {
      const v = viewRef.current;
      const { w, h } = sizeRef.current;
      const cx = (w - (panelOpenRef.current ? PANEL_W : 0)) / 2;
      const tx = cx - p.x * v.k;
      const ty = h / 2 - p.y * v.k;
      const nx = v.x + (tx - v.x) * 0.1;
      const ny = v.y + (ty - v.y) * 0.1;
      if (Math.abs(nx - v.x) < 0.08 && Math.abs(ny - v.y) < 0.08) return;
      setView({ k: v.k, x: nx, y: ny });
    },
    [setView],
  );

  /* ---------------- simulation ---------------- */
  const ensureSim = useCallback(() => {
    if (simRef.current) return simRef.current;
    const link = forceLink<GraphNode, GraphLink>([])
      .distance((l) => (l.kind === 'source' ? settingsRef.current.linkDistance * 1.4 : settingsRef.current.linkDistance))
      .strength((l) => (l.kind === 'source' ? 0.25 / Math.sqrt(Math.max(1, l.source.degree)) : 0.7 / Math.max(1, Math.min(l.source.degree, l.target.degree))));
    const cluster = forceCluster().strength(0.22);
    const sim = forceSimulation<GraphNode, GraphLink>([])
      .alphaDecay(0.035)
      .velocityDecay(0.42)
      .force('link', link)
      .force('charge', forceManyBody<GraphNode>().strength((d) => -settingsRef.current.repulsion * (d.kind === 'source' ? 2 : 1)).distanceMax(460))
      .force('collide', forceCollide<GraphNode>().radius((d) => d.r + 8).strength(0.9).iterations(2))
      .force('center', forceCenter(0, 0).strength(0.04))
      .force('x', forceX<GraphNode>(0).strength(0.012))
      .force('y', forceY<GraphNode>(0).strength(0.012))
      .force('cluster', cluster)
      .stop();
    sim.on('tick', () => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          setFrame((f) => f + 1);
        });
      }
    });
    sim.on('end', () => {
      if (!userMovedRef.current && !botTouchedRef.current) fitRef.current(true);
    });
    simRef.current = sim;
    linkRef.current = link;
    clusterRef.current = cluster;
    return sim;
  }, []);

  useEffect(
    () => () => {
      simRef.current?.stop();
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(animRef.current);
    },
    [],
  );

  // measure the container before the first layout pass so fit/focus have a size
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      sizeRef.current = { w: r.width, h: r.height };
      setSize(sizeRef.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // (re)load nodes + links into the simulation whenever the model changes
  useEffect(() => {
    const sim = ensureSim();
    const link = linkRef.current!;
    liveNodesRef.current = new Map(graph.nodes.map((n) => [n.id, n] as const));
    for (const n of graph.nodes) nodeMapRef.current.set(n.id, n);
    clusterRef.current!.anchors(graph.anchors).strength(graph.anchors.size <= 1 ? 0.05 : 0.22);
    sim.nodes(graph.nodes);
    link.links(graph.links);
    userMovedRef.current = false;
    if (!startedRef.current) {
      startedRef.current = true;
      // settle most of the layout synchronously so the first frame is already a graph
      sim.alpha(1).tick(160);
      const focus = readFocus();
      if (focus && graph.nodes.some((n) => n.id === focus)) focusRef.current(focus, false);
      else {
        if (focus) {
          setSelectedId(null);
          toast('That workflow is not visible to you');
        }
        fitRef.current(false);
      }
      sim.alpha(0.1).restart();
    } else {
      sim.alpha(0.6).restart();
    }
    setFrame((f) => f + 1);
  }, [graph, ensureSim]);

  // live re-tuning from the sliders
  useEffect(() => {
    const sim = simRef.current;
    const link = linkRef.current;
    if (!sim || !link) return;
    const applied = appliedForcesRef.current;
    if (applied.linkDistance === settings.linkDistance && applied.repulsion === settings.repulsion) return;
    appliedForcesRef.current = { linkDistance: settings.linkDistance, repulsion: settings.repulsion };
    link.distance((l) => (l.kind === 'source' ? settings.linkDistance * 1.4 : settings.linkDistance));
    (sim.force('charge') as ForceManyBody<GraphNode>).strength((d) => -settings.repulsion * (d.kind === 'source' ? 2 : 1));
    sim.alpha(0.5).restart();
  }, [settings.linkDistance, settings.repulsion]);

  // wheel zoom at the cursor (native listener so preventDefault works)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
      const k = clamp(v.k * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0014)), MIN_K, MAX_K);
      const r = k / v.k;
      cancelAnimationFrame(animRef.current);
      userInteracted();
      setView({ k, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setView, userInteracted]);

  // keyboard: Esc closes the panel, F fits, ? pins the legend
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'Escape') {
        if (followRef.current) return setFollowId(null);
        setSelectedId(null);
      } else if (e.key === 'f' || e.key === 'F') {
        userInteracted();
        fitRef.current(true);
      } else if (e.key === '?') {
        setLegendPinned((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userInteracted]);

  // a selection that the current user can no longer see closes the panel
  useEffect(() => {
    if (selectedId && !workflows.some((w) => w.id === selectedId)) setSelectedId(null);
  }, [workflows, selectedId]);

  // keep ?focus= in the URL so the view is shareable
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set('focus', selectedId);
    else url.searchParams.delete('focus');
    window.history.replaceState(null, '', url);
  }, [selectedId]);

  // data blobs travelling along the threads (rAF, refs only)
  useEffect(() => {
    let raf = 0;
    const loop = (nowMs: number) => {
      const t = nowMs / 1000;
      const threads = threadsRef.current;
      for (const [key, el] of blobEls.current) {
        const hashAt = key.lastIndexOf('#');
        const th = threads.get(key.slice(0, hashAt));
        if (!th) {
          el.setAttribute('visibility', 'hidden');
          continue;
        }
        const i = Number(key.slice(hashAt + 1));
        const period = clamp(th.len / 48, 2.8, 7.5);
        const u = (t / period + th.phase + i * 0.5) % 1;
        const p = quadPoint(th.p0, th.c, th.p1, u);
        el.setAttribute('cx', p.x.toFixed(1));
        el.setAttribute('cy', p.y.toFixed(1));
        el.style.opacity = String(clamp(Math.sin(Math.PI * u) * 1.8, 0, 1));
        el.removeAttribute('visibility');
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---------------- pointer interactions ---------------- */
  const select = useCallback(
    (n: GraphNode) => {
      if (n.kind !== 'workflow') return;
      if (n.draft) return toast('Draft workflow: build it in n8n first (demo)');
      setSelectedId(n.id);
      // nudge the view if the panel would cover the node
      const v = viewRef.current;
      const { w } = sizeRef.current;
      const sx = n.x * v.k + v.x;
      const limit = w - PANEL_W - 48;
      if (sx > limit) {
        userMovedRef.current = true;
        animateTo({ ...v, x: v.x - (sx - limit) - 40 }, 260);
      }
    },
    [animateTo],
  );

  const onBgPointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    if (e.button !== 0) return;
    cancelAnimationFrame(animRef.current);
    const start = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, moved: false };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) > 3) {
        start.moved = true;
        setPanning(true);
        userInteracted();
      }
      if (start.moved) setView({ ...viewRef.current, x: start.vx + dx, y: start.vy + dy });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setPanning(false);
      if (!start.moved) setSelectedId(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onNodePointerDown = (e: ReactPointerEvent<SVGGElement>, n: GraphNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const sim = simRef.current;
    const svg = svgRef.current;
    if (!sim || !svg) return;
    const rect = svg.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, moved: false };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!start.moved) {
        if (Math.hypot(dx, dy) < 3) return;
        start.moved = true;
        dragRef.current = n.id;
        setDraggingId(n.id);
        userInteracted();
        sim.alphaTarget(0.3).restart();
      }
      const v = viewRef.current;
      n.fx = (ev.clientX - rect.left - v.x) / v.k;
      n.fy = (ev.clientY - rect.top - v.y) / v.k;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (start.moved) {
        n.fx = null;
        n.fy = null;
        dragRef.current = null;
        setDraggingId(null);
        sim.alphaTarget(0);
      } else {
        select(n);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const cursorHost = useMemo<CursorHost>(
    () => ({
      view: viewRef,
      nodes: liveNodesRef,
      sim: simRef,
      viewerDrag: dragRef,
      onBotHover: (uid, nid) => setBotHover((prev) => (prev[uid] === nid ? prev : { ...prev, [uid]: nid })),
      onBotTouched: () => {
        botTouchedRef.current = true;
      },
      followPoint,
    }),
    [followPoint],
  );

  const onFollow = useCallback((id: string | null) => setFollowId(id), []);

  /* ---------------- derived render state ---------------- */
  const k = view.k;
  const q = settings.query.trim().toLowerCase();
  const matched = useMemo(() => (q ? new Set(graph.nodes.filter((n) => matchesQuery(n, q, companyMap)).map((n) => n.id)) : null), [graph, q, companyMap]);
  const hoverSet = useMemo(() => {
    if (!hoverId) return null;
    const set = new Set<string>([hoverId]);
    for (const id of adjacency.get(hoverId) ?? []) set.add(id);
    return set;
  }, [hoverId, adjacency]);
  const botHoverIds = useMemo(() => new Set(Object.values(botHover).filter((v): v is string => !!v)), [botHover]);

  const isDim = (n: GraphNode) => (hoverSet ? !hoverSet.has(n.id) : matched ? !matched.has(n.id) : false);
  const isLinkDim = (l: GraphLink) =>
    hoverSet ? !(l.source.id === hoverId || l.target.id === hoverId) : matched ? !(matched.has(l.source.id) && matched.has(l.target.id)) : false;
  const touches = (l: GraphLink, id: string | null) => !!id && (l.source.id === id || l.target.id === id);
  const isLinkHi = (l: GraphLink) => touches(l, hoverId) || touches(l, selectedId) || [...botHoverIds].some((id) => touches(l, id));

  // labels are hidden by default: shown for the hovered / selected node and its neighbours,
  // for nodes other people's cursors are on, for drafts, and as a tiny caption on sources.
  const activeIds = new Set<string>();
  const labelIds = new Set<string>();
  const reveal = (id: string | null) => {
    if (!id) return;
    activeIds.add(id);
    labelIds.add(id);
    for (const nb of adjacency.get(id) ?? []) labelIds.add(nb);
  };
  reveal(selectedId);
  reveal(hoverId);
  for (const id of botHoverIds) reveal(id);
  for (const n of graph.nodes) if (n.kind === 'source' || n.draft) labelIds.add(n.id);

  // greedy placement (below, above, right, left) avoiding other labels and nodes; the previous placement is tried first
  const labelPlacement = new Map<string, Placement>();
  {
    const prio = (n: GraphNode) => (n.id === selectedId ? 1000 : 0) + (n.id === hoverId ? 900 : 0) + (activeIds.has(n.id) ? 800 : 0) + (n.kind === 'source' ? 200 : 0) + n.r;
    const order = graph.nodes.filter((n) => labelIds.has(n.id)).sort((a, b) => prio(b) - prio(a));
    const nodeBoxes: Box[] = graph.nodes.map((n) => {
      const sx = n.x * k + view.x;
      const sy = n.y * k + view.y;
      const rr = n.r * k + 2;
      return { x1: sx - rr, y1: sy - rr, x2: sx + rr, y2: sy + rr, id: n.id };
    });
    const labelBoxes: Box[] = [];
    for (const n of order) {
      if (matched && !matched.has(n.id) && !activeIds.has(n.id)) continue;
      const w = estWidth(n);
      const sx = n.x * k + view.x;
      const sy = n.y * k + view.y;
      const rr = n.r * k;
      const last = lastPlacementRef.current.get(n.id);
      const candidates = last ? [last, ...PLACEMENTS.filter((p) => p !== last)] : PLACEMENTS;
      let chosen: Placement | null = null;
      for (const p of candidates) {
        const box = labelBox(p, sx, sy, rr, w);
        const clash = labelBoxes.some((b) => intersects(b, box)) || nodeBoxes.some((b) => b.id !== n.id && intersects(b, box));
        if (!clash) {
          chosen = p;
          labelBoxes.push(box);
          break;
        }
      }
      if (!chosen) {
        chosen = last ?? 'b';
        labelBoxes.push(labelBox(chosen, sx, sy, rr, w));
      }
      labelPlacement.set(n.id, chosen);
      lastPlacementRef.current.set(n.id, chosen);
    }
  }

  // threads (curved) for this frame; the blob loop reads them from the ref
  const threads: Thread[] = [];
  const threadMap = new Map<string, Thread>();
  for (const l of graph.links) {
    const th = threadFor(l, k);
    if (!th) continue;
    threads.push(th);
    threadMap.set(l.id, th);
  }
  threadsRef.current = threadMap;

  const dotSpacing = (() => {
    let sp = 24 * k;
    while (sp < 14) sp *= 2;
    while (sp > 36) sp /= 2;
    return sp;
  })();
  const haloScale = Math.pow(1 / Math.min(1, k), 0.45);

  const hasFailing = graph.nodes.some((n) => n.failing);
  const hasBreaking = graph.nodes.some((n) => n.severity === 'critical');
  const hasWasteful = graph.nodes.some((n) => n.severity === 'inefficient');
  const hasProducts = graph.nodes.some((n) => n.product);
  const empty = graph.nodes.length === 0;
  const followUser = followId ? USERS.find((u) => u.id === followId) : undefined;
  const blobColor = (l: GraphLink) => (settings.colorBy === 'company' ? (companyMap.get(l.source.companyId ?? '')?.color ?? 'var(--accent)') : 'var(--accent)');

  return (
    <div
      ref={rootRef}
      className={s.root}
      data-panel={panelOpen}
      data-panning={panning}
      data-dragging={draggingId !== null}
      style={{ backgroundSize: `${dotSpacing}px ${dotSpacing}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
    >
      <svg ref={svgRef} className={s.svg} role="img" aria-label="Workflow graph">
        <defs>
          <marker id="lv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={9 / k} markerHeight={9 / k} markerUnits="userSpaceOnUse" orient="auto">
            <path className={s.arrow} d="M2 1.5 L9 5 L2 8.5" />
          </marker>
          <marker id="lv-arrow-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={9 / k} markerHeight={9 / k} markerUnits="userSpaceOnUse" orient="auto">
            <path className={[s.arrow, s.arrowHi].join(' ')} d="M2 1.5 L9 5 L2 8.5" />
          </marker>
          <radialGradient id="lv-halo-critical">
            <stop offset="0%" stopColor={SEVERITY_HEX.critical} stopOpacity={0.5} />
            <stop offset="28%" stopColor={SEVERITY_HEX.critical} stopOpacity={0.3} />
            <stop offset="60%" stopColor={SEVERITY_HEX.critical} stopOpacity={0.1} />
            <stop offset="100%" stopColor={SEVERITY_HEX.critical} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="lv-halo-inefficient">
            <stop offset="0%" stopColor={SEVERITY_HEX.inefficient} stopOpacity={0.44} />
            <stop offset="28%" stopColor={SEVERITY_HEX.inefficient} stopOpacity={0.25} />
            <stop offset="60%" stopColor={SEVERITY_HEX.inefficient} stopOpacity={0.08} />
            <stop offset="100%" stopColor={SEVERITY_HEX.inefficient} stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect className={s.bg} x="0" y="0" width="100%" height="100%" onPointerDown={onBgPointerDown} />
        <g transform={`translate(${view.x} ${view.y}) scale(${k})`}>
          {/* halos sit under the threads: breaking is red, wasteful is orange, minor gets nothing */}
          {heatmap && (
            <g>
              {graph.nodes.map((n) =>
                (n.severity === 'critical' || n.severity === 'inefficient') && !isDim(n) ? (
                  <circle key={n.id} className={s.halo} cx={n.x} cy={n.y} r={(3 * n.r + 27) * haloScale} fill={`url(#lv-halo-${n.severity})`} />
                ) : null,
              )}
            </g>
          )}
          <g>
            {threads.map((th) => {
              const l = th.link;
              const hi = isLinkHi(l);
              return (
                <path
                  key={l.id}
                  className={[s.link, l.kind === 'source' ? s.linkSource : '', hi ? s.linkHi : '', isLinkDim(l) ? s.dim : ''].join(' ')}
                  d={th.d}
                  vectorEffect="non-scaling-stroke"
                  markerEnd={l.kind === 'call' ? `url(#${hi ? 'lv-arrow-hi' : 'lv-arrow'})` : undefined}
                />
              );
            })}
          </g>
          <g>
            {threads
              .filter((th) => th.link.kind === 'call')
              .flatMap((th) => {
                const l = th.link;
                const n = l.source.wf && l.source.wf.stats.runs24h > 150 ? 2 : 1;
                const dim = isLinkDim(l);
                return Array.from({ length: n }, (_, i) => {
                  const key = `${l.id}#${i}`;
                  return (
                    <circle
                      key={key}
                      className={[s.blob, dim ? s.dim : ''].join(' ')}
                      r={2.5 / k}
                      style={{ fill: blobColor(l) }}
                      ref={(el) => {
                        if (el) blobEls.current.set(key, el);
                        else blobEls.current.delete(key);
                      }}
                    />
                  );
                });
              })}
          </g>
          <g>
            {graph.nodes.map((n) => {
              const color = nodeColor(n, settings.colorBy, companyMap);
              const dim = isDim(n);
              const isSelected = n.id === selectedId;
              const active = activeIds.has(n.id);
              const Icon = n.sourceKind ? SOURCE_ICON[n.sourceKind] : null;
              const place = labelPlacement.get(n.id);
              const labelOn = !!place;
              const fontSize = (n.kind === 'source' ? SOURCE_LABEL_PX : LABEL_PX) / k;
              const lx = place === 'r' ? n.r + 8 / k : place === 'l' ? -(n.r + 8 / k) : 0;
              const ly = place === 't' ? -(n.r + 9 / k) : place === 'r' || place === 'l' ? 4.4 / k : n.r + (n.kind === 'source' ? 16 : 18) / k;
              const anchor = place === 'r' ? 'start' : place === 'l' ? 'end' : 'middle';
              const title = n.wf ? `${n.name} · ${companyMap.get(n.companyId ?? '')?.shortName ?? ''} · ${n.wf.trigger.label}` : `${n.name} · triggers ${n.degree} ${n.degree === 1 ? 'workflow' : 'workflows'}`;
              return (
                <g
                  key={n.id}
                  className={[s.node, dim ? s.dim : ''].join(' ')}
                  transform={`translate(${n.x} ${n.y})`}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onPointerEnter={() => {
                    if (!dragRef.current) setHoverId(n.id);
                  }}
                  onPointerLeave={() => setHoverId((h) => (h === n.id ? null : h))}
                  tabIndex={n.kind === 'workflow' ? 0 : -1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      select(n);
                    }
                  }}
                  onFocus={() => setHoverId(n.id)}
                  onBlur={() => setHoverId((h) => (h === n.id ? null : h))}
                  aria-label={title}
                >
                  <circle className={s.hit} r={Math.max(n.r + 8, 16)} />
                  <g className={s.body} data-active={active}>
                    {n.kind === 'source' ? (
                      <>
                        <circle className={s.sourceCircle} r={n.r} vectorEffect="non-scaling-stroke" />
                        {Icon && <Icon className={s.sourceIcon} x={-n.r * 0.42} y={-n.r * 0.42} width={n.r * 0.84} height={n.r * 0.84} strokeWidth={1.75} aria-hidden="true" />}
                      </>
                    ) : (
                      <>
                        <circle className={s.glow} r={n.r + 6} style={{ fill: color }} />
                        {isSelected && <circle className={s.ring} r={n.r + (n.product ? 8 : 5)} style={{ stroke: color }} vectorEffect="non-scaling-stroke" />}
                        <circle className={[s.circle, n.draft ? s.circleDraft : ''].join(' ')} r={n.r} style={{ fill: color }} fillOpacity={n.inactive && !n.draft ? 0.45 : 1} vectorEffect="non-scaling-stroke" />
                        {n.product && <circle className={s.productRing} r={n.r + 4} vectorEffect="non-scaling-stroke" />}
                        {n.failing && <circle className={s.statusDot} cx={n.r * 0.72} cy={-n.r * 0.72} r={3.2 / Math.min(1, k)} vectorEffect="non-scaling-stroke" />}
                      </>
                    )}
                  </g>
                  <text
                    className={[s.label, n.kind === 'source' ? s.labelSource : '', active ? s.labelActive : ''].join(' ')}
                    data-on={labelOn}
                    x={lx}
                    y={ly}
                    fontSize={fontSize}
                    textAnchor={anchor}
                    strokeWidth={3 / k}
                    aria-hidden="true"
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {!empty && <GraphCursors specs={botSpecs} host={cursorHost} followId={followId} onFollow={onFollow} />}

      {empty && (
        <div className={s.empty}>
          <div className={s.emptyCard}>
            <span className={s.emptyIcon}>
              <Waypoints />
            </span>
            <div className={s.emptyTitle}>{workflows.length === 0 ? 'Nothing to show yet' : 'Everything is filtered out'}</div>
            <div className={s.emptySub}>
              {workflows.length === 0 ? 'You do not have access to any workflows. Ask an admin to share a company or a workflow with you.' : 'Turn a company back on or show isolated workflows to see the graph again.'}
            </div>
          </div>
        </div>
      )}

      <Controls
        settings={settings}
        onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
        companies={companies}
        counts={counts}
        heatmap={heatmap}
        onHeatmap={(v) => $heatmap.set(v)}
        open={controlsOpen}
        onOpenChange={setControlsOpen}
      />

      <Legend
        mode={settings.colorBy}
        companies={companies}
        hidden={hidden}
        stats={graph.stats}
        triggerKinds={graph.triggerKinds}
        sourceKinds={graph.sourceKinds}
        hasFailing={hasFailing}
        hasBreaking={hasBreaking}
        hasWasteful={hasWasteful}
        hasProducts={hasProducts}
        heatmap={heatmap}
        pinned={legendPinned}
        onPin={setLegendPinned}
      />

      {followUser && (
        <div className={s.followPill}>
          <Avatar user={followUser} size={22} />
          Following {followUser.name.split(' ')[0]}
          <button type="button" onClick={() => setFollowId(null)}>
            Stop
          </button>
        </div>
      )}

      <div className={s.brStack}>
        {!viewOnly && (
          <NewWorkflowButton
            companies={companies}
            defaultCompanyId={selectedWf?.companyId ?? null}
            onCreate={(d) => {
              botTouchedRef.current = true; // keep the camera where it is while the new node settles in
              setDrafts((prev) => [...prev, draftWorkflow(d, me.id)]);
            }}
          />
        )}
        <div className={s.zoom}>
          <button type="button" className={s.zoomBtn} data-tip="Zoom in" onClick={() => zoomBy(1.25)} aria-label="Zoom in">
            <Plus />
          </button>
          <button type="button" className={s.zoomBtn} data-tip="Zoom out" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">
            <Minus />
          </button>
          <button type="button" className={s.zoomPct} data-tip="Reset to 100%" onClick={() => zoomBy(1 / k)} aria-label="Reset zoom to 100%">
            {Math.round(k * 100)}%
          </button>
          <button
            type="button"
            className={s.zoomBtn}
            data-tip="Fit to view · F"
            onClick={() => {
              userInteracted();
              fitRef.current(true);
            }}
            aria-label="Fit to view"
          >
            <Maximize2 />
          </button>
        </div>
      </div>

      {selectedWf && (
        <aside className={s.panel} aria-label="Workflow details">
          <WorkflowPanel workflowId={selectedWf.id} onClose={() => setSelectedId(null)} onFocus={(id) => focusRef.current(id, true)} showOpenCanvas />
        </aside>
      )}
    </div>
  );
}
