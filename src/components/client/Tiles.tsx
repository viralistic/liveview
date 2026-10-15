import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { Sparkline } from '../ui/Sparkline';
import s from './client.module.css';

/* ------------------------------------------------------------------ */
/* Tile grid with pointer drag and drop. The dragged tile follows the  */
/* pointer, a pink bar marks where it will land, and on drop every     */
/* tile glides to its new place (FLIP). Order is controlled by the     */
/* parent, which persists it.                                           */
/* ------------------------------------------------------------------ */
export interface TileDef {
  id: string;
  /** columns on desktop (4 = full width) */
  span?: 1 | 2 | 4;
  label: string;
  node: ReactNode;
}

interface Drag {
  id: string;
  el: HTMLElement;
  grabDx: number;
  grabDy: number;
  startX: number;
  startY: number;
  moved: boolean;
  rects: Map<string, DOMRect>;
}
type Drop = { id: string; side: 'before' | 'after'; axis: 'x' | 'y' } | null;

const INTERACTIVE = 'a,button,input,select,textarea,[data-grip]';

export function TileGrid({ tiles, order, onReorder, customize = false }: { tiles: TileDef[]; order: string[]; /** without it the grid is static: no handles, no dragging */ onReorder?: (ids: string[]) => void; customize?: boolean }) {
  const reorderable = !!onReorder;
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const dropRef = useRef<Drop>(null);
  /** rects captured right before an order change, for the FLIP animation */
  const prevRects = useRef<Map<string, DOMRect> | null>(null);
  const lastRects = useRef<Map<string, DOMRect> | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const [flip, setFlip] = useState(0);

  const ordered = order.map((id) => tiles.find((t) => t.id === id)).filter((t): t is TileDef => !!t);
  const orderKey = ordered.map((t) => t.id).join('|');

  const snapshot = useCallback(() => {
    const map = new Map<string, DOMRect>();
    gridRef.current?.querySelectorAll<HTMLElement>('[data-tile]').forEach((el) => map.set(el.dataset.tile!, el.getBoundingClientRect()));
    return map;
  }, []);

  // FLIP: tiles glide from where they were to where they are now.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const before = prevRects.current ?? lastRects.current;
    prevRects.current = null;
    if (!grid) return;
    const els = [...grid.querySelectorAll<HTMLElement>('[data-tile]')];
    for (const el of els) {
      el.style.transition = 'none';
      el.style.transform = '';
      el.style.zIndex = '';
    }
    const moves: HTMLElement[] = [];
    if (before) {
      for (const el of els) {
        const was = before.get(el.dataset.tile!);
        if (!was) continue;
        const now = el.getBoundingClientRect();
        const dx = was.left - now.left;
        const dy = was.top - now.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          moves.push(el);
        }
      }
    }
    lastRects.current = snapshot();
    if (!moves.length) return;
    void grid.offsetWidth; // flush styles before releasing to the transition
    const raf = requestAnimationFrame(() => {
      for (const el of moves) {
        el.style.transition = 'transform 380ms var(--ease-out)';
        el.style.transform = '';
      }
    });
    const t = setTimeout(() => {
      for (const el of moves) el.style.transition = '';
    }, 420);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [orderKey, flip, snapshot]);

  // keep the "last known" rects fresh when the viewport changes
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!drag.current) lastRects.current = snapshot();
    });
    ro.observe(grid);
    return () => ro.disconnect();
  }, [snapshot]);

  const begin = (e: PointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0 || drag.current) return;
    const el = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-tile]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { id, el, grabDx: e.clientX - r.left, grabDy: e.clientY - r.top, startX: e.clientX, startY: e.clientY, moved: false, rects: snapshot() };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    e.preventDefault();
  };

  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const grid = gridRef.current;
    if (!d || !grid) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
      d.moved = true;
      d.el.style.transition = 'none';
      d.el.style.zIndex = '10';
      setDragging(d.id);
    }
    const g = grid.getBoundingClientRect();
    // offsetLeft/Top are layout positions, unaffected by the transform we set
    const x = e.clientX - d.grabDx - (g.left + d.el.offsetLeft);
    const y = e.clientY - d.grabDy - (g.top + d.el.offsetTop);
    d.el.style.transform = `translate(${x}px, ${y}px) scale(1.02)`;
    let next: Drop = null;
    for (const [id, r] of d.rects) {
      if (id === d.id) continue;
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
      const axis: 'x' | 'y' = r.width >= g.width - 2 ? 'y' : 'x';
      const side: 'before' | 'after' = axis === 'x' ? (e.clientX < r.left + r.width / 2 ? 'before' : 'after') : e.clientY < r.top + r.height / 2 ? 'before' : 'after';
      next = { id, side, axis };
      break;
    }
    const cur = dropRef.current;
    if (next?.id !== cur?.id || next?.side !== cur?.side) {
      dropRef.current = next;
      setDrop(next);
    }
  };

  const end = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!d.moved) return;
    const target = dropRef.current;
    dropRef.current = null;
    setDragging(null);
    setDrop(null);
    prevRects.current = snapshot();
    if (target && target.id !== d.id) {
      const rest = ordered.map((t) => t.id).filter((id) => id !== d.id);
      const at = rest.indexOf(target.id) + (target.side === 'after' ? 1 : 0);
      rest.splice(at, 0, d.id);
      if (rest.join('|') !== orderKey) onReorder?.(rest);
    }
    setFlip((n) => n + 1); // one layout pass: glide into the new place, or back
  };

  const nudge = (id: string, dir: -1 | 1) => {
    const ids = ordered.map((t) => t.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    prevRects.current = snapshot();
    ids.splice(i, 1);
    ids.splice(j, 0, id);
    onReorder?.(ids);
  };
  const onGripKey = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nudge(id, -1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nudge(id, 1);
    }
  };

  return (
    <div ref={gridRef} className={s.grid} data-customize={customize && reorderable ? 'true' : undefined}>
      {ordered.map((t) => (
        <section
          key={t.id}
          id={`tile-${t.id}`}
          data-tile={t.id}
          className={[s.tile, t.span === 2 ? s.span2 : t.span === 4 ? s.span4 : ''].join(' ')}
          data-dragging={dragging === t.id ? 'true' : undefined}
          aria-label={t.label}
          onPointerDown={
            customize && reorderable
              ? (e) => {
                  if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
                  begin(e, t.id);
                }
              : undefined
          }
          onPointerMove={reorderable ? move : undefined}
          onPointerUp={reorderable ? end : undefined}
          onPointerCancel={reorderable ? end : undefined}
        >
          {reorderable && (
            <button
              type="button"
              data-grip="true"
              className={s.grip}
              aria-label={`Move ${t.label}`}
              title="Drag to reorder"
              onPointerDown={(e) => {
                e.stopPropagation();
                begin(e, t.id);
              }}
              onKeyDown={(e) => onGripKey(e, t.id)}
            >
              <GripVertical />
            </button>
          )}
          {t.node}
          {drop?.id === t.id && <span className={s.drop} data-side={drop.side} data-axis={drop.axis} aria-hidden="true" />}
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tile chrome: a small header, a body, a big number.                   */
/* ------------------------------------------------------------------ */
export function TileHead({ title, sub, icon, action }: { title: ReactNode; sub?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.head} data-grip="true">
      <div style={{ minWidth: 0 }}>
        <div className={s.title}>
          {icon}
          {title}
        </div>
        {sub && <div className={s.titleSub}>{sub}</div>}
      </div>
      {action && <div className={s.headAction}>{action}</div>}
    </div>
  );
}

export function TileBody({ children, flush, style }: { children: ReactNode; flush?: boolean; style?: React.CSSProperties }) {
  return (
    <div className={s.body} data-flush={flush ? 'true' : undefined} style={style}>
      {children}
    </div>
  );
}

/** A number tile: label, big value, one line under it, optional sparkline and hover details. */
export function Stat({ label, icon, value, unit, sub, spark, sparkColor = 'var(--text-subtle)', hover, good }: { label: ReactNode; icon?: ReactNode; value: ReactNode; unit?: string; sub?: ReactNode; spark?: number[]; sparkColor?: string; hover?: ReactNode; good?: boolean }) {
  return (
    <>
      <TileHead title={label} icon={icon} />
      <TileBody>
        <div className={s.big} data-good={good ? 'true' : undefined}>
          {value}
          {unit && <small>{unit}</small>}
        </div>
        <div className={s.foot}>
          <div className={s.sub} style={{ marginTop: 0 }}>
            {sub}
          </div>
          {spark && <Sparkline data={spark} width={84} height={24} color={sparkColor} />}
        </div>
      </TileBody>
      {hover && <div className={s.hover}>{hover}</div>}
    </>
  );
}

/** Thin horizontal bar, 0..1. */
export function Bar({ value, tone, height }: { value: number; tone?: 'good' | 'accent' | 'muted' | 'soft'; height?: number }) {
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span className={s.track} style={height ? { height } : undefined} aria-hidden="true">
      <span className={s.fill} data-tone={tone} style={{ width: `${w}%`, minWidth: w > 0 ? 3 : 0 }} />
    </span>
  );
}
