/**
 * Obsidian-style graph view: every workflow the current user may see is a
 * node, every "Execute Workflow" relation a directed edge, and the outside
 * world (Internet, Schedules, App events, Errors) shows up as hollow source
 * nodes. Force layout by d3-force, rendered as SVG in world coordinates.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useStore } from '../../stores/session';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type ForceLink, type ForceManyBody, type Simulation } from 'd3-force';
import { Clock, Globe, Maximize2, Minus, Plus, TriangleAlert, Waypoints, Zap, type LucideIcon } from 'lucide-react';
import { $heatmap, $visibleCompanies, $visibleWorkflows, toast } from '../../stores/session';
import { SEVERITY_HEX } from '../../lib/health';
import type { SourceKind } from '../../lib/layout';
import { WorkflowPanel } from '../pages/WorkflowPanel';
import { Tooltip } from '../ui/Tooltip';
import { buildGraph, matchesQuery, nodeColor, type GraphLink, type GraphNode } from './model';
import { forceCluster, type ClusterForce } from './forces';
import { Controls, DEFAULT_SETTINGS, type Settings } from './Controls';
import { Legend } from './Legend';
import s from './graph.module.css';

const SOURCE_ICON: Record<SourceKind, LucideIcon> = { internet: Globe, schedule: Clock, app: Zap, error: TriangleAlert };
const MIN_K = 0.25;
const MAX_K = 3;
const PANEL_W = 360;
const LABEL_FADE_START = 0.6;
const LABEL_FADE_END = 0.78;

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
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const readFocus = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('focus'));
const intersects = (a: Box, b: Box) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
/** rough text width for 12px Geist medium, used for label occlusion */
const estWidth = (n: GraphNode) => (n.kind === 'source' ? n.label.length * 7.2 : n.label.length * 6.4);

export function Graph() {
  const workflows = useStore($visibleWorkflows);
  const companies = useStore($visibleCompanies);
  const heatmap = useStore($heatmap);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [selectedId, setSelectedId] = useState<string | null>(readFocus);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [view, setViewState] = useState<View>({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [, setFrame] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const linkRef = useRef<ForceLink<GraphNode, GraphLink> | null>(null);
  const clusterRef = useRef<ClusterForce | null>(null);
  const nodeMapRef = useRef(new Map<string, GraphNode>());
  const viewRef = useRef(view);
  const sizeRef = useRef(size);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const userMovedRef = useRef(false);
  const startedRef = useRef(false);
  const rafRef = useRef(0);
  const animRef = useRef(0);
  const dragRef = useRef<string | null>(null);
  const appliedForcesRef = useRef({ linkDistance: DEFAULT_SETTINGS.linkDistance, repulsion: DEFAULT_SETTINGS.repulsion });

  /* ---------------- model ---------------- */
  const hidden = useMemo(() => new Set(settings.hiddenCompanies), [settings.hiddenCompanies]);
  const graph = useMemo(
    () => buildGraph(workflows, companies, { showSources: settings.showSources, showIsolated: settings.showIsolated, hidden, prev: nodeMapRef.current }),
    [workflows, companies, settings.showSources, settings.showIsolated, hidden],
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

  const selectedWf = selectedId ? workflows.find((w) => w.id === selectedId) ?? null : null;
  const panelOpen = !!selectedWf;
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;

  /* ---------------- viewport helpers ---------------- */
  const setView = useCallback((v: View) => {
    viewRef.current = v;
    setViewState(v);
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
    const pad = { l: 88, r: 88, t: 64, b: 110 };
    const availW = Math.max(120, w - (panelOpenRef.current ? PANEL_W : 0) - pad.l - pad.r);
    const availH = Math.max(120, h - pad.t - pad.b);
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY + 22);
    const k = clamp(Math.min(availW / bw, availH / bh), MIN_K, 1.35);
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
      userMovedRef.current = true;
      animateTo({ k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r }, 200);
    },
    [animateTo],
  );

  /* ---------------- simulation ---------------- */
  const ensureSim = useCallback(() => {
    if (simRef.current) return simRef.current;
    const link = forceLink<GraphNode, GraphLink>([])
      .distance((l) => (l.kind === 'source' ? settingsRef.current.linkDistance * 1.8 : settingsRef.current.linkDistance))
      .strength((l) => (l.kind === 'source' ? 0.12 : 0.6) / Math.max(1, Math.min(l.source.degree, l.target.degree)));
    const cluster = forceCluster().strength(0.09);
    const sim = forceSimulation<GraphNode, GraphLink>([])
      .alphaDecay(0.035)
      .velocityDecay(0.42)
      .force('link', link)
      .force('charge', forceManyBody<GraphNode>().strength((d) => -settingsRef.current.repulsion * (d.kind === 'source' ? 2 : 1)).distanceMax(700))
      .force('collide', forceCollide<GraphNode>().radius((d) => d.r + 6).strength(0.9).iterations(2))
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
      if (!userMovedRef.current) fitRef.current(true);
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
    for (const n of graph.nodes) nodeMapRef.current.set(n.id, n);
    clusterRef.current!.anchors(graph.anchors);
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
    link.distance((l) => (l.kind === 'source' ? settings.linkDistance * 1.8 : settings.linkDistance));
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
      const k = clamp(v.k * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0018)), MIN_K, MAX_K);
      const r = k / v.k;
      cancelAnimationFrame(animRef.current);
      userMovedRef.current = true;
      setView({ k, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setView]);

  // keyboard: Esc closes the panel, F fits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === 'Escape') {
        if (typing) return;
        setSelectedId(null);
      } else if ((e.key === 'f' || e.key === 'F') && !typing && !e.metaKey && !e.ctrlKey) {
        userMovedRef.current = true;
        fitRef.current(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // keep ?focus= in the URL so the view is shareable
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set('focus', selectedId);
    else url.searchParams.delete('focus');
    window.history.replaceState(null, '', url);
  }, [selectedId]);

  /* ---------------- pointer interactions ---------------- */
  const select = useCallback(
    (n: GraphNode) => {
      if (n.kind !== 'workflow') return;
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
      }
      if (start.moved) {
        userMovedRef.current = true;
        setView({ ...viewRef.current, x: start.vx + dx, y: start.vy + dy });
      }
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
        userMovedRef.current = true;
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

  const isDim = (n: GraphNode) => (hoverSet ? !hoverSet.has(n.id) : matched ? !matched.has(n.id) : false);
  const isLinkDim = (l: GraphLink) =>
    hoverSet ? !(l.source.id === hoverId || l.target.id === hoverId) : matched ? !(matched.has(l.source.id) && matched.has(l.target.id)) : false;
  const isLinkHi = (l: GraphLink) =>
    (!!hoverId && (l.source.id === hoverId || l.target.id === hoverId)) || (!!selectedId && (l.source.id === selectedId || l.target.id === selectedId));

  // which labels to draw: zoom fade, hubs always, hovered neighbourhood always, greedy occlusion for the rest
  const labelVisible = useMemo(() => {
    const out = new Set<string>();
    if (!settings.showLabels) return out;
    const prio = (n: GraphNode) =>
      (n.id === selectedId ? 1000 : 0) + (n.id === hoverId ? 900 : 0) + (hoverSet?.has(n.id) ? 800 : 0) + (n.kind === 'source' ? 200 : 0) + (n.hub ? 100 : 0) + n.r;
    const order = [...graph.nodes].sort((a, b) => prio(b) - prio(a));
    const boxes: Box[] = [];
    for (const n of order) {
      const forced = n.id === selectedId || n.id === hoverId || (hoverSet?.has(n.id) ?? false);
      if (hoverSet && !forced) continue;
      if (matched && !matched.has(n.id) && !forced) continue;
      if (!forced && !n.hub && k < LABEL_FADE_START) continue;
      const w = estWidth(n);
      const cx = n.x * k + view.x;
      const top = (n.y + n.r) * k + view.y + 5;
      const box = { x1: cx - w / 2 - 4, x2: cx + w / 2 + 4, y1: top, y2: top + 15 };
      if (!forced && boxes.some((b) => intersects(b, box))) continue;
      boxes.push(box);
      out.add(n.id);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, settings.showLabels, selectedId, hoverId, hoverSet, matched, view.x, view.y, k, draggingId, size.w]);
  const fade = clamp((k - LABEL_FADE_START) / (LABEL_FADE_END - LABEL_FADE_START), 0, 1);

  const dotSpacing = (() => {
    let sp = 24 * k;
    while (sp < 14) sp *= 2;
    while (sp > 36) sp /= 2;
    return sp;
  })();

  const hasFailing = graph.nodes.some((n) => n.failing);
  const hasIssues = graph.nodes.some((n) => n.severity);
  const empty = graph.nodes.length === 0;
  const defaultControlsOpen = typeof window === 'undefined' ? true : window.innerWidth >= 1100;

  return (
    <div
      ref={rootRef}
      className={s.root}
      data-panel={panelOpen}
      data-panning={panning}
      style={{ backgroundSize: `${dotSpacing}px ${dotSpacing}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
    >
      <svg ref={svgRef} className={s.svg} role="img" aria-label="Workflow graph">
        <defs>
          <marker id="lv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={9 / k} markerHeight={9 / k} markerUnits="userSpaceOnUse" orient="auto">
            <path d="M2 1.5 L9 5 L2 8.5" fill="none" stroke="rgba(0,0,0,0.32)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
          <marker id="lv-arrow-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={9 / k} markerHeight={9 / k} markerUnits="userSpaceOnUse" orient="auto">
            <path d="M2 1.5 L9 5 L2 8.5" fill="none" stroke="rgba(0,0,0,0.65)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
          <filter id="lv-halo" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <rect className={s.bg} x="0" y="0" width="100%" height="100%" onPointerDown={onBgPointerDown} />
        <g transform={`translate(${view.x} ${view.y}) scale(${k})`}>
          {/* halos sit under the edges so blur never muddies them */}
          {heatmap && (
            <g>
              {graph.nodes.map((n) =>
                n.severity && !isDim(n) ? (
                  <circle key={n.id} className={s.halo} cx={n.x} cy={n.y} r={n.r + 9} fill={SEVERITY_HEX[n.severity]} opacity={0.42} filter="url(#lv-halo)" />
                ) : null,
              )}
            </g>
          )}
          <g>
            {graph.links.map((l) => {
              const dx = l.target.x - l.source.x;
              const dy = l.target.y - l.source.y;
              const d = Math.hypot(dx, dy) || 1;
              const ux = dx / d;
              const uy = dy / d;
              const endGap = l.kind === 'call' ? l.target.r + 7 / k : l.target.r + 1;
              if (d <= l.source.r + endGap + 2) return null;
              const hi = isLinkHi(l);
              return (
                <line
                  key={l.id}
                  className={[s.link, l.kind === 'source' ? s.linkSource : '', hi ? s.linkHi : '', isLinkDim(l) ? s.dim : ''].join(' ')}
                  x1={l.source.x + ux * l.source.r}
                  y1={l.source.y + uy * l.source.r}
                  x2={l.target.x - ux * endGap}
                  y2={l.target.y - uy * endGap}
                  vectorEffect="non-scaling-stroke"
                  markerEnd={l.kind === 'call' ? `url(#${hi ? 'lv-arrow-hi' : 'lv-arrow'})` : undefined}
                />
              );
            })}
          </g>
          <g>
            {graph.nodes.map((n) => {
              const color = nodeColor(n, settings.colorBy, companyMap);
              const dim = isDim(n);
              const isSelected = n.id === selectedId;
              const active = isSelected || n.id === hoverId;
              const Icon = n.sourceKind ? SOURCE_ICON[n.sourceKind] : null;
              const showLabel = labelVisible.has(n.id);
              const forcedLabel = isSelected || n.id === hoverId || (hoverSet?.has(n.id) ?? false) || n.hub;
              const labelOpacity = showLabel ? (forcedLabel ? 1 : fade) : 0;
              const fontSize = (n.kind === 'source' ? 10.5 : 12) / k;
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
                  <title>{title}</title>
                  <circle className={s.hit} r={Math.max(n.r + 6, 14)} />
                  {isSelected && <circle className={s.ring} r={n.r + 4.5} style={{ stroke: color }} vectorEffect="non-scaling-stroke" />}
                  {n.kind === 'source' ? (
                    <>
                      <circle className={s.sourceCircle} r={n.r} vectorEffect="non-scaling-stroke" />
                      {Icon && <Icon className={s.sourceIcon} x={-n.r * 0.42} y={-n.r * 0.42} width={n.r * 0.84} height={n.r * 0.84} strokeWidth={1.75} aria-hidden="true" />}
                    </>
                  ) : (
                    <circle className={s.circle} r={n.r} fill={color} fillOpacity={n.inactive ? 0.45 : 1} vectorEffect="non-scaling-stroke" />
                  )}
                  {n.failing && <circle className={s.statusDot} cx={n.r * 0.72} cy={-n.r * 0.72} r={3.2 / Math.min(1, k)} vectorEffect="non-scaling-stroke" />}
                  <text
                    className={[s.label, n.kind === 'source' ? s.labelSource : '', active ? s.labelActive : ''].join(' ')}
                    y={n.r + (n.kind === 'source' ? 16 : 17) / k}
                    fontSize={fontSize}
                    textAnchor="middle"
                    strokeWidth={3 / k}
                    style={{ opacity: labelOpacity }}
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
        defaultOpen={defaultControlsOpen}
      />

      <Legend
        mode={settings.colorBy}
        companies={companies}
        hidden={hidden}
        stats={graph.stats}
        triggerKinds={graph.triggerKinds}
        sourceKinds={graph.sourceKinds}
        hasFailing={hasFailing}
        hasIssues={hasIssues}
        heatmap={heatmap}
      />

      <div className={s.zoom}>
        <Tooltip label="Zoom in">
          <button type="button" className={s.zoomBtn} onClick={() => zoomBy(1.25)} aria-label="Zoom in">
            <Plus />
          </button>
        </Tooltip>
        <Tooltip label="Zoom out">
          <button type="button" className={s.zoomBtn} onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">
            <Minus />
          </button>
        </Tooltip>
        <Tooltip label="Reset zoom">
          <button type="button" className={s.zoomPct} onClick={() => zoomBy(1 / k)} aria-label="Reset zoom to 100%">
            {Math.round(k * 100)}%
          </button>
        </Tooltip>
        <Tooltip label="Fit to view" kbd="F">
          <button
            type="button"
            className={s.zoomBtn}
            onClick={() => {
              userMovedRef.current = true;
              fitRef.current(true);
            }}
            aria-label="Fit to view"
          >
            <Maximize2 />
          </button>
        </Tooltip>
      </div>

      {selectedWf && (
        <aside className={s.panel} aria-label="Workflow details">
          <WorkflowPanel workflowId={selectedWf.id} onClose={() => setSelectedId(null)} onFocus={(id) => focusRef.current(id, true)} showOpenCanvas />
        </aside>
      )}
    </div>
  );
}
