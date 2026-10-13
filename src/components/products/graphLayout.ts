/**
 * Pure geometry for the live product graph: node positions in "world units",
 * bezier connections with sampled arc length (so a travelling dot moves at a
 * constant speed) and BFS depth per node (the order in which a run lights up).
 * One world unit maps to one CSS pixel at natural size; the component scales
 * the whole world with container-query units when the card is narrower.
 */
import type { WfConnection, WfNode } from '../../data/types';

export interface GraphPreset {
  /** node square size */
  node: number;
  colPitch: number;
  rowPitch: number;
  /** world padding */
  pad: number;
  labelSize: number;
  labelW: number;
  /** vertical spacing between distinct outputs of one node (if/switch) */
  portGap: number;
  /** stroke width in CSS px (non-scaling) */
  stroke: number;
  /** dot radius in world units */
  dotR: number;
  /** show connection labels (true/false, North…) */
  connLabels: boolean;
}

export const CARD_PRESET: GraphPreset = { node: 34, colPitch: 56, rowPitch: 66, pad: 14, labelSize: 10.5, labelW: 54, portGap: 7, stroke: 1.25, dotR: 3, connLabels: false };
export const LARGE_PRESET: GraphPreset = { node: 56, colPitch: 128, rowPitch: 108, pad: 40, labelSize: 12.5, labelW: 116, portGap: 14, stroke: 1.5, dotR: 4.5, connLabels: true };

export interface Pt {
  x: number;
  y: number;
}
export interface LaidNode {
  node: WfNode;
  x: number;
  y: number;
  depth: number;
  isTrigger: boolean;
}
export interface LaidConn {
  id: string;
  from: string;
  to: string;
  label?: string;
  d: string;
  mid: Pt;
  /** depth of the source node: dots on connections of the same depth travel together */
  depth: number;
  /** sampled points along the curve and their cumulative length */
  samples: Pt[];
  cum: number[];
  length: number;
}
export interface GraphLayout {
  w: number;
  h: number;
  nodes: LaidNode[];
  conns: LaidConn[];
  depthMax: number;
  preset: GraphPreset;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function cubicAt(a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * a.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * b.x,
    y: mt * mt * mt * a.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * b.y,
  };
}

/** Shortest hop count from a start node (no incoming connections) to every node. */
function depths(nodes: WfNode[], conns: WfConnection[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const incoming = new Set(conns.filter((c) => ids.has(c.from) && ids.has(c.to)).map((c) => c.to));
  let starts = nodes.filter((n) => !incoming.has(n.id));
  if (starts.length === 0) {
    const minCol = Math.min(...nodes.map((n) => n.col));
    starts = nodes.filter((n) => n.col === minCol);
  }
  const out = new Map<string, number>();
  const queue: string[] = [];
  for (const s of starts) {
    out.set(s.id, 0);
    queue.push(s.id);
  }
  while (queue.length) {
    const id = queue.shift()!;
    const d = out.get(id)!;
    for (const c of conns) {
      if (c.from !== id || out.has(c.to) || !ids.has(c.to)) continue;
      out.set(c.to, d + 1);
      queue.push(c.to);
    }
  }
  for (const n of nodes) if (!out.has(n.id)) out.set(n.id, Math.max(0, n.col));
  return out;
}

export function layoutGraph(nodes: WfNode[], connections: WfConnection[], preset: GraphPreset): GraphLayout {
  const { node, colPitch, rowPitch, pad, labelSize, portGap } = preset;
  const maxCol = Math.max(0, ...nodes.map((n) => n.col));
  const maxRow = Math.max(0, ...nodes.map((n) => n.row));
  const labelH = Math.ceil(labelSize * 1.2 * 2);
  const w = pad * 2 + maxCol * colPitch + node;
  const h = pad + maxRow * rowPitch + node + 5 + labelH + Math.round(pad * 0.6);
  const depth = depths(nodes, connections);

  const laid: LaidNode[] = nodes.map((n) => ({
    node: n,
    x: pad + n.col * colPitch,
    y: pad + n.row * rowPitch,
    depth: depth.get(n.id) ?? 0,
    isTrigger: n.col === 0,
  }));
  const byId = new Map(laid.map((l) => [l.node.id, l] as const));

  // distinct outputs per node, in order of first appearance ('' = main output)
  const outputs = new Map<string, string[]>();
  for (const c of connections) {
    const keys = outputs.get(c.from) ?? [];
    const k = c.label ?? '';
    if (!keys.includes(k)) keys.push(k);
    outputs.set(c.from, keys);
  }

  const conns: LaidConn[] = [];
  connections.forEach((c, i) => {
    const from = byId.get(c.from);
    const to = byId.get(c.to);
    if (!from || !to) return;
    const keys = outputs.get(c.from) ?? [''];
    const ki = Math.max(0, keys.indexOf(c.label ?? ''));
    const a: Pt = { x: from.x + node, y: from.y + node / 2 + (ki - (keys.length - 1) / 2) * portGap };
    const b: Pt = { x: to.x, y: to.y + node / 2 };
    const dx = Math.max(colPitch * 0.3, Math.abs(b.x - a.x) * 0.5);
    const c1: Pt = { x: a.x + dx, y: a.y };
    const c2: Pt = { x: b.x - dx, y: b.y };
    const d = `M${r1(a.x)} ${r1(a.y)} C${r1(c1.x)} ${r1(c1.y)}, ${r1(c2.x)} ${r1(c2.y)}, ${r1(b.x)} ${r1(b.y)}`;
    const N = 24;
    const samples: Pt[] = [];
    const cum: number[] = [];
    let len = 0;
    for (let k = 0; k <= N; k++) {
      const p = cubicAt(a, c1, c2, b, k / N);
      if (k > 0) len += Math.hypot(p.x - samples[k - 1]!.x, p.y - samples[k - 1]!.y);
      samples.push(p);
      cum.push(len);
    }
    conns.push({ id: `c${i}`, from: c.from, to: c.to, label: c.label, d, mid: cubicAt(a, c1, c2, b, 0.5), depth: from.depth, samples, cum, length: len });
  });

  return { w, h, nodes: laid, conns, depthMax: Math.max(0, ...laid.map((l) => l.depth)), preset };
}

/** Point at a fraction (0..1) of the arc length. */
export function pointAt(conn: LaidConn, f: number): Pt {
  const target = Math.max(0, Math.min(1, f)) * conn.length;
  const { samples, cum } = conn;
  let i = 1;
  while (i < cum.length - 1 && cum[i]! < target) i++;
  const s0 = cum[i - 1]!;
  const s1 = cum[i]!;
  const t = s1 > s0 ? (target - s0) / (s1 - s0) : 0;
  const p0 = samples[i - 1]!;
  const p1 = samples[i]!;
  return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
}

/** Relative luminance check so near-black brand icons stay visible on dark surfaces. */
export function isDarkColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1]!, 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum < 0.22;
}
