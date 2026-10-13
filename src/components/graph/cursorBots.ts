/**
 * Scripted "busy" cursors for the graph. Every bot is a tiny state machine:
 * travel to a node → hover it (the graph highlights it) → sometimes drag it a
 * little and let go → wander off → pause → next node. Deterministic per user.
 */
import type { User } from '../../data/types';
import { seeded } from '../../lib/rng';
import type { GraphNode } from './model';

export interface Pt {
  x: number;
  y: number;
}

export interface BotSpec {
  user: User;
  /** nodes this user may touch (must be visible to them) */
  targets: string[];
  /** nodes they are "viewing" per presence; visited more often */
  preferred: string[];
  /** label for the hover card */
  viewingLabel: string;
}

type Phase = 'pause' | 'travel' | 'hover' | 'drag' | 'wander';

export interface Bot {
  spec: BotSpec;
  rand: () => number;
  pos: Pt;
  phase: Phase;
  t0: number;
  dur: number;
  from: Pt;
  to: Pt;
  nodeId: string | null;
  recent: string[];
  seed: number;
  dragging: boolean;
}

export interface BotEnv {
  now: number;
  node: (id: string) => GraphNode | undefined;
  /** may this bot start a drag on this node right now? */
  canDrag: (id: string) => boolean;
  startDrag: (n: GraphNode) => void;
  moveDrag: (n: GraphNode, p: Pt) => void;
  endDrag: (n: GraphNode) => void;
  setHover: (userId: string, nodeId: string | null) => void;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export function createBot(spec: BotSpec, now: number, nodeOf: (id: string) => GraphNode | undefined): Bot {
  const rand = seeded(`graphbot:${spec.user.id}`);
  const first = spec.preferred[0] ?? spec.targets[Math.floor(rand() * spec.targets.length)];
  const n = first ? nodeOf(first) : undefined;
  const pos = n ? { x: n.x + (rand() - 0.5) * 160, y: n.y + 60 + rand() * 80 } : { x: (rand() - 0.5) * 300, y: (rand() - 0.5) * 300 };
  return {
    spec,
    rand,
    pos,
    phase: 'pause',
    t0: now,
    dur: 1.2 + rand() * 2.6,
    from: pos,
    to: pos,
    nodeId: null,
    recent: [],
    seed: rand() * 100,
    dragging: false,
  };
}

function pickTarget(bot: Bot): string | null {
  const { targets, preferred } = bot.spec;
  if (!targets.length) return null;
  const pool = preferred.length && bot.rand() < 0.45 ? preferred : targets;
  const fresh = pool.filter((id) => !bot.recent.includes(id));
  const from = fresh.length ? fresh : pool;
  const id = from[Math.floor(bot.rand() * from.length)]!;
  bot.recent = [...bot.recent.slice(-2), id];
  return id;
}

function begin(bot: Bot, phase: Phase, now: number, dur: number) {
  bot.phase = phase;
  bot.t0 = now;
  bot.dur = dur;
}

/** Advance one bot to `env.now` (seconds). Mutates bot.pos and, while dragging, the node. */
export function stepBot(bot: Bot, env: BotEnv) {
  const now = env.now;
  const t = clamp01((now - bot.t0) / bot.dur);
  const nodeId = bot.nodeId;
  const node = nodeId ? env.node(nodeId) : undefined;
  // the node left the graph (filter, user switch): let go and move on
  if (nodeId && !node && bot.phase !== 'pause' && bot.phase !== 'wander') {
    if (bot.dragging) bot.dragging = false;
    env.setHover(bot.spec.user.id, null);
    bot.nodeId = null;
    begin(bot, 'pause', now, 0.6);
    return;
  }

  switch (bot.phase) {
    case 'pause': {
      // idle micro-movement
      bot.pos = { x: bot.from.x + Math.sin(now * 1.3 + bot.seed) * 1.5, y: bot.from.y + Math.cos(now * 1.1 + bot.seed) * 1.5 };
      if (t >= 1) {
        const id = pickTarget(bot);
        const target = id ? env.node(id) : undefined;
        if (!id || !target) {
          begin(bot, 'pause', now, 1 + bot.rand());
          return;
        }
        bot.nodeId = id;
        bot.from = { ...bot.pos };
        const dist = Math.hypot(target.x - bot.pos.x, target.y - bot.pos.y);
        begin(bot, 'travel', now, Math.min(2.4, Math.max(0.55, dist / 230)));
      }
      return;
    }
    case 'travel': {
      const k = easeInOut(t);
      // aim slightly off-centre so the arrow tip lands on the dot
      const aim = { x: node!.x + 2, y: node!.y + 2 };
      bot.pos = { x: bot.from.x + (aim.x - bot.from.x) * k, y: bot.from.y + (aim.y - bot.from.y) * k };
      if (t >= 1) {
        env.setHover(bot.spec.user.id, nodeId);
        begin(bot, 'hover', now, 0.9 + bot.rand() * 1.5);
      }
      return;
    }
    case 'hover': {
      bot.pos = { x: node!.x + 2 + Math.sin(now * 2.2 + bot.seed) * 1.2, y: node!.y + 2 + Math.cos(now * 1.9 + bot.seed) * 1.2 };
      if (t >= 1) {
        if (env.canDrag(nodeId!) && bot.rand() < 0.55) {
          env.startDrag(node!);
          bot.dragging = true;
          bot.from = { x: node!.x, y: node!.y };
          const a = bot.rand() * Math.PI * 2;
          const d = 36 + bot.rand() * 50;
          bot.to = { x: bot.from.x + Math.cos(a) * d, y: bot.from.y + Math.sin(a) * d };
          begin(bot, 'drag', now, 0.7 + bot.rand() * 0.6);
        } else {
          env.setHover(bot.spec.user.id, null);
          leave(bot, now);
        }
      }
      return;
    }
    case 'drag': {
      const k = easeOut(t);
      const p = { x: bot.from.x + (bot.to.x - bot.from.x) * k, y: bot.from.y + (bot.to.y - bot.from.y) * k };
      bot.pos = { x: p.x + 2, y: p.y + 2 };
      env.moveDrag(node!, p);
      if (t >= 1) {
        env.endDrag(node!);
        bot.dragging = false;
        env.setHover(bot.spec.user.id, null);
        leave(bot, now);
      }
      return;
    }
    case 'wander': {
      const k = easeInOut(t);
      bot.pos = { x: bot.from.x + (bot.to.x - bot.from.x) * k, y: bot.from.y + (bot.to.y - bot.from.y) * k };
      if (t >= 1) {
        bot.from = { ...bot.pos };
        begin(bot, 'pause', now, 0.4 + bot.rand() * 1.4);
      }
      return;
    }
  }
}

function leave(bot: Bot, now: number) {
  bot.nodeId = null;
  bot.from = { ...bot.pos };
  bot.to = { x: bot.pos.x + (bot.rand() - 0.5) * 220, y: bot.pos.y + 30 + (bot.rand() - 0.3) * 160 };
  begin(bot, 'wander', now, 0.5 + bot.rand() * 0.9);
}

/** Release anything a bot holds (used when bots are rebuilt). */
export function releaseBot(bot: Bot, env: Pick<BotEnv, 'node' | 'endDrag' | 'setHover'>) {
  if (bot.dragging && bot.nodeId) {
    const n = env.node(bot.nodeId);
    if (n) env.endDrag(n);
    bot.dragging = false;
  }
  env.setHover(bot.spec.user.id, null);
}
