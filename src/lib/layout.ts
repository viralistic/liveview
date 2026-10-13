/**
 * World layout for the Figma-style canvas.
 * Every company is a "section"; every workflow is a card inside it whose
 * footprint is big enough to hold its real node graph (so zooming in
 * reveals the editor instead of opening a new view).
 * All numbers are world units (= CSS px at zoom 1).
 */
import type { Company, TriggerKind, WfNode, Workflow } from '../data/types';

export const CARD_W = 1280;
export const CARD_H = 440;
export const CARD_GAP = 120;
export const SECTION_PAD = 120;
export const SECTION_HEADER = 160;
export const SOURCE_COL_W = 340;
export const SECTION_GAP = 480;

/** node graph inside a card */
export const NODE_SIZE = 96; // n8n nodes are ~96px squares
export const NODE_COL = 176;
export const NODE_ROW = 136;
export const NODE_OFFSET_X = 96;
export const NODE_OFFSET_Y = 128;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface CardLayout extends Rect {
  workflowId: string;
  companyId: string;
}
export type SourceKind = 'internet' | 'schedule' | 'app' | 'error';
export interface SourceLayout {
  id: string;
  kind: SourceKind;
  label: string;
  x: number; // center
  y: number;
  r: number;
  workflowIds: string[];
  companyId: string;
}
export interface SectionLayout extends Rect {
  companyId: string;
  cards: CardLayout[];
  sources: SourceLayout[];
}
export interface WorldLayout {
  sections: SectionLayout[];
  cards: Record<string, CardLayout>;
  sources: SourceLayout[];
  bounds: Rect;
}

export const sourceKindFor = (t: TriggerKind): SourceKind | null =>
  t === 'webhook' ? 'internet' : t === 'schedule' ? 'schedule' : t === 'app' || t === 'chat' ? 'app' : t === 'error' ? 'error' : null;

export const SOURCE_LABEL: Record<SourceKind, string> = {
  internet: 'Internet',
  schedule: 'Schedules',
  app: 'App events',
  error: 'Errors',
};

export function sectionSize(count: number): { w: number; h: number } {
  const cols = 2;
  const rows = Math.max(1, Math.ceil(count / cols));
  return {
    w: SECTION_PAD + SOURCE_COL_W + cols * CARD_W + (cols - 1) * CARD_GAP + SECTION_PAD,
    h: SECTION_HEADER + rows * CARD_H + (rows - 1) * CARD_GAP + SECTION_PAD,
  };
}

/** Position of a node's top-left corner in world space. */
export function nodeWorldPos(card: Rect, node: WfNode): { x: number; y: number } {
  return { x: card.x + NODE_OFFSET_X + node.col * NODE_COL, y: card.y + NODE_OFFSET_Y + node.row * NODE_ROW };
}
export function nodeCenter(card: Rect, node: WfNode): { x: number; y: number } {
  const p = nodeWorldPos(card, node);
  return { x: p.x + NODE_SIZE / 2, y: p.y + NODE_SIZE / 2 };
}
/** Where an edge enters a workflow: left side of its trigger node. */
export function cardEntry(card: Rect, wf: Workflow): { x: number; y: number } {
  const trig = wf.nodes.find((n) => n.col === 0) ?? wf.nodes[0]!;
  const p = nodeWorldPos(card, trig);
  return { x: p.x, y: p.y + NODE_SIZE / 2 };
}
/** Where an Execute Workflow edge leaves: right side of the calling node (or the card's right edge). */
export function cardExit(card: Rect, wf: Workflow, calleeId: string): { x: number; y: number } {
  const node = wf.nodes.find((n) => n.type === 'executeWorkflow') ?? wf.nodes[wf.nodes.length - 1]!;
  const p = nodeWorldPos(card, node);
  void calleeId;
  return { x: p.x + NODE_SIZE, y: p.y + NODE_SIZE / 2 };
}

/**
 * Build the world. Sections are placed in a 2-column grid in company order.
 * The result is deterministic so share links stay stable.
 */
export function buildLayout(companies: Company[], workflows: Workflow[]): WorldLayout {
  const sections: SectionLayout[] = [];
  const cards: Record<string, CardLayout> = {};
  const sources: SourceLayout[] = [];

  const sizes = companies.map((c) => sectionSize(workflows.filter((w) => w.companyId === c.id).length));
  const colW = Math.max(...sizes.map((s) => s.w));
  let y = 0;
  for (let i = 0; i < companies.length; i += 2) {
    const rowH = Math.max(sizes[i]!.h, sizes[i + 1]?.h ?? 0);
    for (let j = i; j < Math.min(i + 2, companies.length); j++) {
      const company = companies[j]!;
      const size = sizes[j]!;
      const x = (j - i) * (colW + SECTION_GAP);
      const wfs = workflows.filter((w) => w.companyId === company.id);
      const sectionCards: CardLayout[] = wfs.map((w, k) => {
        const col = k % 2;
        const row = Math.floor(k / 2);
        const card: CardLayout = {
          workflowId: w.id,
          companyId: company.id,
          x: x + SECTION_PAD + SOURCE_COL_W + col * (CARD_W + CARD_GAP),
          y: y + SECTION_HEADER + row * (CARD_H + CARD_GAP),
          w: CARD_W,
          h: CARD_H,
        };
        cards[w.id] = card;
        return card;
      });
      // sources: one per kind present, placed in the left column at the mean y of the flows they feed
      const byKind = new Map<SourceKind, string[]>();
      for (const w of wfs) {
        const k = sourceKindFor(w.trigger.kind);
        if (!k) continue;
        if (!byKind.has(k)) byKind.set(k, []);
        byKind.get(k)!.push(w.id);
      }
      const order: SourceKind[] = ['internet', 'schedule', 'app', 'error'];
      const kinds = order.filter((k) => byKind.has(k));
      const sectionSources: SourceLayout[] = [];
      const minY = y + SECTION_HEADER + 80;
      const maxY = y + size.h - SECTION_PAD - 80;
      kinds.forEach((k, idx) => {
        const ids = byKind.get(k)!;
        const meanY = ids.reduce((a, id) => a + cardEntry(cards[id]!, wfs.find((w) => w.id === id)!).y, 0) / ids.length;
        // keep sources apart vertically
        const slotY = minY + ((idx + 0.5) * (maxY - minY)) / kinds.length;
        const sy = kinds.length === 1 ? meanY : meanY * 0.55 + slotY * 0.45;
        const s: SourceLayout = {
          id: `${company.id}:${k}`,
          kind: k,
          label: SOURCE_LABEL[k],
          x: x + SECTION_PAD + SOURCE_COL_W / 2 - 20,
          y: sy,
          r: k === 'internet' ? 64 : 52,
          workflowIds: ids,
          companyId: company.id,
        };
        sectionSources.push(s);
        sources.push(s);
      });
      sections.push({ companyId: company.id, x, y, w: colW, h: rowH, cards: sectionCards, sources: sectionSources });
    }
    y += rowH + SECTION_GAP;
  }
  const bounds: Rect = {
    x: 0,
    y: 0,
    w: Math.max(...sections.map((s) => s.x + s.w)),
    h: Math.max(...sections.map((s) => s.y + s.h)),
  };
  return { sections, cards, sources, bounds };
}

/** Viewport helpers shared by canvas + share links. */
export interface Viewport {
  x: number; // world coordinate at the viewport's left edge
  y: number;
  z: number; // zoom
}
export function fitRect(rect: Rect, vw: number, vh: number, padding = 80, maxZoom = 1.5): Viewport {
  const z = Math.min(maxZoom, (vw - padding * 2) / rect.w, (vh - padding * 2) / rect.h);
  const x = rect.x + rect.w / 2 - vw / 2 / z;
  const y = rect.y + rect.h / 2 - vh / 2 / z;
  return { x, y, z };
}
export function encodeViewport(v: Viewport): string {
  return `${Math.round(v.x)},${Math.round(v.y)},${v.z.toFixed(3)}`;
}
export function decodeViewport(s: string | null): Viewport | null {
  if (!s) return null;
  const [x, y, z] = s.split(',').map(Number);
  if ([x, y, z].some((n) => n === undefined || Number.isNaN(n))) return null;
  return { x: x!, y: y!, z: z! };
}
