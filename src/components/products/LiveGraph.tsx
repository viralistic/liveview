/**
 * A product's node graph, rendered "live": the trigger fires, a purple dot
 * travels along every connection in sequence, each node pulses as it is
 * reached, then the run pauses and starts again. Phase is randomised per
 * instance so a wall of cards never moves in lockstep.
 *
 * Nodes are HTML (so NodeIcon is reused), connections are SVG. The world has a
 * fixed size in world units and scales with container-query units, so the same
 * graph renders at natural size on wide cards and shrinks on narrow ones with
 * no measuring and no hydration flash. prefers-reduced-motion shows the static
 * graph.
 */
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { WfConnection, WfNode } from '../../data/types';
import { nodeType } from '../../data/nodeTypes';
import { NodeIcon } from '../ui/NodeIcon';
import { CARD_PRESET, LARGE_PRESET, isDarkColor, layoutGraph, pointAt, type GraphPreset } from './graphLayout';
import { subscribe } from './ticker';
import s from './products.module.css';

/* timeline, in seconds */
const HOP = 0.62; // a node lights HOP after the previous depth
const DEPART = 0.12; // dots leave a node this long after it lights
const TRAVEL = HOP - DEPART;
const RING = 0.7; // node pulse
const FADE = 0.55; // purple trail fading back to grey
const PAUSE = 1.7; // rest between runs

export function LiveGraph({ nodes, connections, variant = 'card', maxHeight, preset: presetProp, className }: { nodes: WfNode[]; connections: WfConnection[]; variant?: 'card' | 'large'; maxHeight?: number; preset?: GraphPreset; className?: string }) {
  const preset = presetProp ?? (variant === 'large' ? LARGE_PRESET : CARD_PRESET);
  const layout = useMemo(() => layoutGraph(nodes, connections, preset), [nodes, connections, preset]);
  const rootRef = useRef<HTMLDivElement>(null);
  const cycle = layout.depthMax * HOP + RING + PAUSE;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const nodeEls = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>('[data-node]').forEach((el) => nodeEls.set(el.dataset.node!, el));
    const connEls = layout.conns.map((c) => ({
      c,
      trail: root.querySelector<SVGPathElement>(`[data-trail="${c.id}"]`),
      dot: root.querySelector<SVGGElement>(`[data-dot="${c.id}"]`),
      lastOpacity: -1,
    }));
    // when every node lights: its own depth, plus arrivals of skip connections
    const lightTimes = new Map<string, number[]>();
    for (const n of layout.nodes) lightTimes.set(n.node.id, [n.depth * HOP]);
    for (const c of layout.conns) {
      const t = c.depth * HOP + DEPART + TRAVEL;
      const arr = lightTimes.get(c.to);
      if (arr && !arr.some((x) => Math.abs(x - t) < 0.01)) arr.push(t);
    }
    const lit = new Set<string>();
    const phase = Math.random() * cycle;
    let visible = true;

    const reset = () => {
      for (const id of lit) delete nodeEls.get(id)?.dataset.lit;
      lit.clear();
      for (const e of connEls) {
        if (e.dot) e.dot.style.opacity = '0';
        if (e.trail) e.trail.style.opacity = '0';
        e.lastOpacity = 0;
      }
    };

    const tick = (nowMs: number) => {
      if (!visible || document.hidden) return;
      const t = (nowMs / 1000 + phase) % cycle;
      for (const [id, times] of lightTimes) {
        const on = times.some((lt) => t >= lt && t < lt + RING);
        const was = lit.has(id);
        if (on && !was) {
          lit.add(id);
          const el = nodeEls.get(id);
          if (el) el.dataset.lit = '1';
        } else if (!on && was) {
          lit.delete(id);
          const el = nodeEls.get(id);
          if (el) delete el.dataset.lit;
        }
      }
      for (const e of connEls) {
        const start = e.c.depth * HOP + DEPART;
        const p = (t - start) / TRAVEL;
        let trailOpacity = 0;
        if (p >= 0 && p < 1) {
          const pt = pointAt(e.c, p);
          if (e.dot) {
            e.dot.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
            e.dot.style.opacity = '1';
          }
          e.trail?.setAttribute('stroke-dasharray', `${p.toFixed(3)} 1`);
          trailOpacity = 1;
        } else {
          if (e.dot && e.lastOpacity !== 0) e.dot.style.opacity = '0';
          const since = t - (start + TRAVEL);
          if (since >= 0 && since < FADE) {
            e.trail?.setAttribute('stroke-dasharray', '1 1');
            trailOpacity = 1 - since / FADE;
          }
        }
        if (e.trail && Math.abs(trailOpacity - e.lastOpacity) > 0.004) e.trail.style.opacity = trailOpacity.toFixed(2);
        e.lastOpacity = trailOpacity;
      }
    };

    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
      if (!visible) reset();
    }, { rootMargin: '120px' }) : null;
    io?.observe(root);
    const unsub = subscribe(tick);
    return () => {
      unsub();
      io?.disconnect();
      reset();
    };
  }, [layout, cycle]);

  const { w, h, preset: p } = layout;
  const naturalW = maxHeight ? Math.min(w, (maxHeight * w) / h) : w;
  const worldStyle = { '--wn': w, maxWidth: naturalW, aspectRatio: `${w} / ${h}` } as CSSProperties;
  const innerStyle = { '--ls': p.labelSize, '--lw': p.labelW, '--n': p.node, '--sw': `${p.stroke}px` } as CSSProperties;

  return (
    <div ref={rootRef} className={[s.world, className ?? ''].join(' ')} style={worldStyle} aria-label={`${nodes.length} nodes, ${connections.length} connections`} role="img">
      <div className={s.worldInner} style={innerStyle}>
        <svg className={s.svg} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {layout.conns.map((c) => (
            <path key={c.id} className={s.edge} d={c.d} />
          ))}
          {layout.conns.map((c) => (
            <path key={`t${c.id}`} className={s.trail} d={c.d} pathLength={1} strokeDasharray="0 1" data-trail={c.id} />
          ))}
          {layout.conns.map((c) => (
            <g key={`d${c.id}`} className={s.dotG} data-dot={c.id}>
              <circle className={s.dotGlow} r={p.dotR * 2.2} />
              <circle className={s.dot} r={p.dotR} />
            </g>
          ))}
        </svg>
        {layout.nodes.map((ln) => {
          const def = nodeType(ln.node.type);
          const dark = isDarkColor(def.color);
          const style = { '--x': ln.x, '--y': ln.y, '--r': ln.isTrigger ? 17 : 10, '--rl': ln.isTrigger ? 17 : 10 } as CSSProperties;
          return (
            <div key={ln.node.id} className={s.node} style={style} data-node={ln.node.id} data-trigger={ln.isTrigger} data-disabled={!!ln.node.disabled}>
              <div className={s.nodeBox} data-trigger={ln.isTrigger}>
                <NodeIcon type={ln.node.type} size={p.node} title={`${ln.node.name} · ${def.label}`} style={{ width: '100%', height: '100%', borderRadius: 'inherit', color: dark ? 'var(--text)' : undefined }} />
                <span className={s.ring} aria-hidden="true" />
              </div>
              <div className={s.nodeLabel}>{ln.node.name}</div>
            </div>
          );
        })}
        {p.connLabels &&
          layout.conns
            .filter((c) => c.label)
            .map((c) => (
              <span key={`l${c.id}`} className={s.connLabel} style={{ '--x': c.mid.x, '--y': c.mid.y } as CSSProperties}>
                {c.label}
              </span>
            ))}
      </div>
    </div>
  );
}
