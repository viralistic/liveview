/**
 * Scripted multiplayer cursors: each online user wanders between a few
 * waypoints inside the thing they are viewing. Deterministic per user.
 */
import type { User } from '../../data/types';
import { seeded } from '../../lib/rng';
import type { Rect } from '../../lib/layout';
import type { Pt } from './geometry';

export interface CursorScript {
  user: User;
  targetId: string;
  targetLabel: string;
  pts: Pt[];
  /** per segment i: travel from pts[i] to pts[i+1] then pause */
  segs: { travel: number; pause: number; start: number }[];
  total: number;
  seed: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function buildScript(user: User, targetId: string, targetLabel: string, rect: Rect, anchors: Pt[] = []): CursorScript {
  const rand = seeded(`cursor:${user.id}:${targetId}`);
  const n = 6 + Math.floor(rand() * 5); // 6..10
  const pts: Pt[] = [];
  const inset = { x: rect.w * 0.08, y: rect.h * 0.12 };
  for (let i = 0; i < n; i++) {
    if (anchors.length && rand() < 0.7) {
      const a = anchors[Math.floor(rand() * anchors.length)]!;
      pts.push({ x: a.x + (rand() - 0.5) * 90, y: a.y + (rand() - 0.5) * 70 });
    } else {
      pts.push({ x: rect.x + inset.x + rand() * (rect.w - inset.x * 2), y: rect.y + inset.y + rand() * (rect.h - inset.y * 2) });
    }
  }
  const segs: CursorScript['segs'] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const travel = Math.min(2.4, Math.max(0.7, dist / 420));
    const pause = 0.5 + rand() * 1.5;
    segs.push({ travel, pause, start: t });
    t += travel + pause;
  }
  return { user, targetId, targetLabel, pts, segs, total: t, seed: rand() * 100 };
}

export function scriptPos(s: CursorScript, time: number): Pt {
  const t = ((time % s.total) + s.total) % s.total;
  let i = s.segs.length - 1;
  for (let k = 0; k < s.segs.length; k++) {
    const seg = s.segs[k]!;
    if (t >= seg.start && t < seg.start + seg.travel + seg.pause) {
      i = k;
      break;
    }
  }
  const seg = s.segs[i]!;
  const a = s.pts[i]!;
  const b = s.pts[(i + 1) % s.pts.length]!;
  const local = t - seg.start;
  const k = local >= seg.travel ? 1 : easeInOut(local / seg.travel);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}
