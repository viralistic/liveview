/**
 * Multiplayer cursors for the graph, in screen space (rAF, refs only).
 * Each online user other than the viewer gets a scripted bot that visits
 * nodes, hovers them, sometimes drags one a little, then moves on.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Eye } from 'lucide-react';
import type { Simulation } from 'd3-force';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { createBot, releaseBot, stepBot, type Bot, type BotEnv, type BotSpec, type Pt } from './cursorBots';
import type { GraphLink, GraphNode } from './model';
import s from './graph.module.css';

export interface CursorHost {
  view: RefObject<{ x: number; y: number; k: number }>;
  nodes: RefObject<Map<string, GraphNode>>;
  sim: RefObject<Simulation<GraphNode, GraphLink> | null>;
  /** node the viewer is dragging right now */
  viewerDrag: RefObject<string | null>;
  onBotHover: (userId: string, nodeId: string | null) => void;
  onBotTouched: () => void;
  followPoint: (p: Pt) => void;
}

const START_DELAY = 2.2;

export function GraphCursors({ specs, host, followId, onFollow }: { specs: BotSpec[]; host: CursorHost; followId: string | null; onFollow: (userId: string | null) => void }) {
  const els = useRef(new Map<string, HTMLDivElement>());
  const botsRef = useRef(new Map<string, Bot>());
  const frozenAt = useRef(new Map<string, number>());
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredRef = useRef(hovered);
  hoveredRef.current = hovered;
  const followRef = useRef(followId);
  followRef.current = followId;
  const hostRef = useRef(host);
  hostRef.current = host;
  const envRef = useRef<BotEnv | null>(null);

  useEffect(() => {
    const draggingBy = new Set<string>();
    const env: BotEnv = {
      now: 0,
      node: (id) => hostRef.current.nodes.current.get(id),
      canDrag: (id) => !hostRef.current.viewerDrag.current && !draggingBy.has(id) && !!hostRef.current.sim.current,
      startDrag: (n) => {
        draggingBy.add(n.id);
        n.fx = n.x;
        n.fy = n.y;
        hostRef.current.sim.current?.alphaTarget(0.2).restart();
        hostRef.current.onBotTouched();
      },
      moveDrag: (n, p) => {
        n.fx = p.x;
        n.fy = p.y;
      },
      endDrag: (n) => {
        n.fx = null;
        n.fy = null;
        draggingBy.delete(n.id);
        if (!draggingBy.size && !hostRef.current.viewerDrag.current) hostRef.current.sim.current?.alphaTarget(0);
      },
      setHover: (uid, nid) => hostRef.current.onBotHover(uid, nid),
    };
    envRef.current = env;
    const bots = botsRef.current;
    const now = performance.now() / 1000;
    const ids = new Set(specs.map((sp) => sp.user.id));
    for (const [id, bot] of bots) {
      if (ids.has(id)) continue;
      releaseBot(bot, env);
      bots.delete(id);
    }
    for (const sp of specs) {
      const existing = bots.get(sp.user.id);
      if (existing) {
        existing.spec = sp;
        continue;
      }
      bots.set(sp.user.id, createBot(sp, now + START_DELAY, env.node));
    }

    let raf = 0;
    const loop = (nowMs: number) => {
      env.now = nowMs / 1000;
      const v = hostRef.current.view.current;
      for (const bot of bots.values()) {
        const id = bot.spec.user.id;
        if (hoveredRef.current === id) {
          // the viewer is reading the hover card: freeze this cursor in place
          if (!frozenAt.current.has(id)) frozenAt.current.set(id, env.now);
        } else {
          const f = frozenAt.current.get(id);
          if (f != null) {
            bot.t0 += env.now - f;
            frozenAt.current.delete(id);
          }
          stepBot(bot, env);
        }
        const el = els.current.get(id);
        if (el) {
          const sx = bot.pos.x * v.k + v.x;
          const sy = bot.pos.y * v.k + v.y;
          el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
        }
        if (followRef.current === id) hostRef.current.followPoint(bot.pos);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [specs]);

  // let go of everything when the graph unmounts
  useEffect(
    () => () => {
      const env = envRef.current;
      if (!env) return;
      for (const bot of botsRef.current.values()) releaseBot(bot, env);
      botsRef.current.clear();
    },
    [],
  );

  return (
    <div className={s.cursors} aria-hidden="true">
      {specs.map((sp) => {
        const u = sp.user;
        const first = u.name.split(' ')[0];
        const following = followId === u.id;
        return (
          <div
            key={u.id}
            className={s.cursor}
            ref={(el) => {
              if (el) els.current.set(u.id, el);
              else els.current.delete(u.id);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M5.5 3.2v17.6c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z" fill={u.color} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <span className={s.cursorLabel} style={{ background: u.color }} onPointerEnter={() => setHovered(u.id)} onPointerLeave={() => setHovered((v) => (v === u.id ? null : v))}>
              {following ? `Following ${first}` : first}
              {hovered === u.id && (
                <div className={s.cursorCard} data-ui onPointerDown={(e) => e.stopPropagation()}>
                  <div className={s.cursorCardHead}>
                    <Avatar user={u} size={30} ring />
                    <div style={{ minWidth: 0 }}>
                      <div className={s.cursorCardName}>{u.name}</div>
                      <div className={s.cursorCardTitle}>{u.title}</div>
                    </div>
                  </div>
                  <div className={s.cursorCardViewing}>
                    <Eye size={12} style={{ color: 'var(--text-subtle)', flex: 'none' }} />
                    Viewing <b>{sp.viewingLabel}</b>
                  </div>
                  <div className={s.cursorCardFoot}>
                    <Button size="sm" variant={following ? 'secondary' : 'brand'} onClick={() => onFollow(following ? null : u.id)} style={{ flex: 1 }}>
                      {following ? 'Stop following' : 'Follow'}
                    </Button>
                  </div>
                </div>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
