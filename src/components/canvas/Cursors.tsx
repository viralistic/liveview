/** Multiplayer cursors in screen space, following scripted world paths (rAF, refs only). */
import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { scriptPos, type CursorScript } from './cursorPaths';
import type { ViewportController } from './viewport';
import s from './canvas.module.css';

export function Cursors({ ctrl, scripts, followId, onFollow }: { ctrl: ViewportController; scripts: CursorScript[]; followId: string | null; onFollow: (userId: string | null) => void }) {
  const els = useRef(new Map<string, HTMLDivElement>());
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  hoveredRef.current = hovered;
  const followRef = useRef(followId);
  followRef.current = followId;

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const offsets = new Map<string, number>();
    const frozen = new Map<string, number>();
    const loop = (now: number) => {
      const vp = ctrl.vp;
      for (const sc of scripts) {
        const el = els.current.get(sc.user.id);
        if (!el) continue;
        const id = sc.user.id;
        let t: number;
        if (hoveredRef.current === id) {
          if (!frozen.has(id)) frozen.set(id, now);
          t = (frozen.get(id)! - t0) / 1000 - (offsets.get(id) ?? 0);
        } else {
          const f = frozen.get(id);
          if (f != null) {
            offsets.set(id, (offsets.get(id) ?? 0) + (now - f) / 1000);
            frozen.delete(id);
          }
          t = (now - t0) / 1000 - (offsets.get(id) ?? 0);
        }
        const p = scriptPos(sc, t + sc.seed);
        const sx = (p.x - vp.x) * vp.z + Math.sin(t * 2.3 + sc.seed) * 1.2;
        const sy = (p.y - vp.y) * vp.z + Math.cos(t * 1.7 + sc.seed) * 1.2;
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
        if (followRef.current === id) ctrl.followPoint(p);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ctrl, scripts]);

  return (
    <div className={s.cursors} aria-hidden="true">
      {scripts.map((sc) => {
        const u = sc.user;
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
            <span className={s.cursorLabel} style={{ background: u.color }} data-ui onPointerEnter={() => setHovered(u.id)} onPointerLeave={() => setHovered((v) => (v === u.id ? null : v))}>
              {following ? `Following ${first}` : first}
              {hovered === u.id && (
                <div className={s.cursorCard} onPointerDown={(e) => e.stopPropagation()}>
                  <div className={s.cursorCardHead}>
                    <Avatar user={u} size={30} ring />
                    <div style={{ minWidth: 0 }}>
                      <div className={s.cursorCardName}>{u.name}</div>
                      <div className={s.cursorCardTitle}>{u.title}</div>
                    </div>
                  </div>
                  <div className={s.cursorCardViewing}>
                    <Eye size={12} style={{ color: 'var(--text-subtle)', flex: 'none' }} />
                    Viewing <b>{sc.targetLabel}</b>
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
