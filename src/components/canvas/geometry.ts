/**
 * Pure geometry for the canvas: node ports, in-card bezier connections,
 * inter-workflow routes (S-curves for neighbours, rounded orthogonal
 * routes through the gaps for everything else) and source edges.
 * All numbers are world units.
 */
import type { WfNode, Workflow } from '../../data/types';
import { NODE_COL, NODE_OFFSET_X, NODE_OFFSET_Y, NODE_ROW, NODE_SIZE, cardEntry, cardExit, type Rect, type SourceLayout } from '../../lib/layout';

export interface Pt {
  x: number;
  y: number;
}

/** Node top-left relative to its card. */
export const nodeRel = (n: WfNode): Pt => ({ x: NODE_OFFSET_X + n.col * NODE_COL, y: NODE_OFFSET_Y + n.row * NODE_ROW });

export const PORT_GAP = 30;

/** Distinct output ports of a node, in order of first appearance ('' = main output). */
export function outputKeys(wf: Workflow, nodeId: string): string[] {
  const keys: string[] = [];
  for (const c of wf.connections) {
    if (c.from !== nodeId) continue;
    const k = c.label ?? '';
    if (!keys.includes(k)) keys.push(k);
  }
  return keys.length ? keys : [''];
}

export interface PortPos {
  key: string;
  x: number;
  y: number;
}
export interface NodePorts {
  nodeId: string;
  input: Pt | null;
  outputs: PortPos[];
}

/** Port positions (relative to the card) for every node. */
export function nodePorts(wf: Workflow): Map<string, NodePorts> {
  const out = new Map<string, NodePorts>();
  for (const n of wf.nodes) {
    const p = nodeRel(n);
    const keys = outputKeys(wf, n.id);
    const outputs = keys.map((key, i) => ({ key, x: p.x + NODE_SIZE, y: p.y + NODE_SIZE / 2 + (i - (keys.length - 1) / 2) * PORT_GAP }));
    out.set(n.id, { nodeId: n.id, input: n.col === 0 ? null : { x: p.x, y: p.y + NODE_SIZE / 2 }, outputs });
  }
  return out;
}

export function cubicPath(a: Pt, b: Pt, minDx = 48, ratio = 0.5): string {
  const dx = Math.max(minDx, Math.abs(b.x - a.x) * ratio);
  return `M${r(a.x)} ${r(a.y)} C${r(a.x + dx)} ${r(a.y)}, ${r(b.x - dx)} ${r(b.y)}, ${r(b.x)} ${r(b.y)}`;
}
export function cubicMid(a: Pt, b: Pt, minDx = 48, ratio = 0.5): Pt {
  const dx = Math.max(minDx, Math.abs(b.x - a.x) * ratio);
  const c1 = { x: a.x + dx, y: a.y };
  const c2 = { x: b.x - dx, y: b.y };
  return { x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8, y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8 };
}
export function cubicLength(a: Pt, b: Pt, minDx = 48, ratio = 0.5): number {
  const dx = Math.max(minDx, Math.abs(b.x - a.x) * ratio);
  const c1 = { x: a.x + dx, y: a.y };
  const c2 = { x: b.x - dx, y: b.y };
  let len = 0;
  let prev = a;
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    const mt = 1 - t;
    const p = {
      x: mt * mt * mt * a.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * b.x,
      y: mt * mt * mt * a.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * b.y,
    };
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

export interface ConnGeom {
  id: string;
  from: string;
  to: string;
  label?: string;
  d: string;
  mid: Pt;
}

/** In-card connections with port offsets, relative to the card. */
export function connectionGeometry(wf: Workflow): ConnGeom[] {
  const ports = nodePorts(wf);
  const out: ConnGeom[] = [];
  wf.connections.forEach((c, i) => {
    const from = ports.get(c.from);
    const to = ports.get(c.to);
    if (!from || !to) return;
    const o = from.outputs.find((p) => p.key === (c.label ?? '')) ?? from.outputs[0]!;
    const target = to.input ?? { x: nodeRel(wf.nodes.find((n) => n.id === c.to)!).x, y: o.y };
    out.push({ id: `${wf.id}-c${i}`, from: c.from, to: c.to, label: c.label, d: cubicPath(o, target, 40, 0.5), mid: cubicMid(o, target, 40, 0.5) });
  });
  return out;
}

/** Polyline with rounded corners. Degenerate (zero-length) segments are dropped. */
export function roundedPolyline(points: Pt[], radius: number): string {
  const pts = points.filter((p, i) => i === 0 || Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y) > 0.5);
  // merge collinear triples so corners are real corners
  const clean: Pt[] = [];
  for (const p of pts) {
    const a = clean[clean.length - 2];
    const b = clean[clean.length - 1];
    if (a && b && ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))) clean[clean.length - 1] = p;
    else clean.push(p);
  }
  if (clean.length < 2) return '';
  let d = `M${r(clean[0]!.x)} ${r(clean[0]!.y)}`;
  for (let i = 1; i < clean.length - 1; i++) {
    const prev = clean[i - 1]!;
    const cur = clean[i]!;
    const next = clean[i + 1]!;
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const rr = Math.min(radius, inLen / 2, outLen / 2);
    const inDir = { x: (cur.x - prev.x) / inLen, y: (cur.y - prev.y) / inLen };
    const outDir = { x: (next.x - cur.x) / outLen, y: (next.y - cur.y) / outLen };
    const p1 = { x: cur.x - inDir.x * rr, y: cur.y - inDir.y * rr };
    const p2 = { x: cur.x + outDir.x * rr, y: cur.y + outDir.y * rr };
    d += ` L${r(p1.x)} ${r(p1.y)} Q${r(cur.x)} ${r(cur.y)} ${r(p2.x)} ${r(p2.y)}`;
  }
  const last = clean[clean.length - 1]!;
  d += ` L${r(last.x)} ${r(last.y)}`;
  return d;
}
export function polylineLength(points: Pt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return len;
}

export interface Route {
  d: string;
  len: number;
  a: Pt;
  b: Pt;
}

/**
 * Route an Execute Workflow edge between two cards.
 * Neighbours in the same row get an S-curve; everything else takes a rounded
 * orthogonal route through the gaps between cards, so lines never cross content.
 */
export function interWorkflowRoute(callerCard: Rect, caller: Workflow, calleeCard: Rect, callee: Workflow): Route {
  const a = cardExit(callerCard, caller, callee.id);
  const b = cardEntry(calleeCard, callee);
  // if other nodes sit to the right of the Execute Workflow node, leave through the row gap below the card
  const exec = caller.nodes.find((n) => n.type === 'executeWorkflow') ?? caller.nodes[caller.nodes.length - 1]!;
  const blocked = caller.nodes.some((n) => n.row === exec.row && n.col > exec.col);
  const sameRow = Math.abs(callerCard.y - calleeCard.y) < 1;
  if (!blocked && sameRow && b.x > a.x + 80) {
    return { d: cubicPath(a, b, 120, 0.5), len: cubicLength(a, b, 120, 0.5), a, b };
  }
  const x1 = callerCard.x + callerCard.w + 60;
  const x2 = calleeCard.x - 60;
  const yc = calleeCard.y - 60;
  const pts: Pt[] = [a];
  if (blocked) {
    const laneY = callerCard.y + callerCard.h + 60;
    pts.push({ x: a.x + 36, y: a.y }, { x: a.x + 36, y: laneY }, { x: x1, y: laneY });
  } else {
    pts.push({ x: x1, y: a.y });
  }
  if (Math.abs(x1 - x2) < 1) pts.push({ x: x1, y: b.y }, b);
  else pts.push({ x: x1, y: yc }, { x: x2, y: yc }, { x: x2, y: b.y }, b);
  return { d: roundedPolyline(pts, 44), len: polylineLength(pts), a, b };
}

/** Dashed edge from a source node to a workflow's trigger. */
export function sourceRoute(source: SourceLayout, card: Rect, wf: Workflow): Route {
  const a = { x: source.x + source.r, y: source.y };
  const b = cardEntry(card, wf);
  return { d: cubicPath(a, b, 90, 0.45), len: cubicLength(a, b, 90, 0.45), a, b };
}

export function rectCenter(rc: Rect): Pt {
  return { x: rc.x + rc.w / 2, y: rc.y + rc.h / 2 };
}
export function rectContains(rc: Rect, p: Pt): boolean {
  return p.x >= rc.x && p.x <= rc.x + rc.w && p.y >= rc.y && p.y <= rc.y + rc.h;
}
export function intersectArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
export function unionRect(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((q) => q.x));
  const y = Math.min(...rects.map((q) => q.y));
  const x2 = Math.max(...rects.map((q) => q.x + q.w));
  const y2 = Math.max(...rects.map((q) => q.y + q.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

const r = (n: number) => Math.round(n * 10) / 10;
