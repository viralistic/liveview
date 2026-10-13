/** Small overview map; click to jump. Neutral, except the heat hue for failing flows and purple for product instances. */
import { useStore } from '@nanostores/react';
import type { Workflow } from '../../data/types';
import type { WorldLayout } from '../../lib/layout';
import { SEVERITY_HEX } from '../../lib/health';
import { $viewport, type ViewportController } from './viewport';
import s from './canvas.module.css';

const M = 400; // world margin

export function Minimap({ ctrl, layout, visibleIds, workflowById, heat }: { ctrl: ViewportController; layout: WorldLayout; visibleIds: ReadonlySet<string>; workflowById: ReadonlyMap<string, Workflow>; heat: boolean }) {
  const vp = useStore($viewport);
  const b = layout.bounds;
  const vis = { x: vp.x, y: vp.y, w: ctrl.effW / vp.z, h: ctrl.h / vp.z };
  const vb = `${b.x - M} ${b.y - M} ${b.w + 2 * M} ${b.h + 2 * M}`;
  return (
    <div
      className={s.minimap}
      data-ui
      title="Minimap · click to jump"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const wx = b.x - M + ((e.clientX - r.left - 6) / (r.width - 12)) * (b.w + 2 * M);
        const wy = b.y - M + ((e.clientY - r.top - 6) / (r.height - 12)) * (b.h + 2 * M);
        ctrl.animateTo({ x: wx - ctrl.effW / 2 / vp.z, y: wy - ctrl.h / 2 / vp.z, z: vp.z }, 380);
      }}
    >
      <svg viewBox={vb} aria-hidden="true">
        {layout.sections.map((sec) => (
          <rect key={sec.companyId} className={s.mmSection} x={sec.x} y={sec.y} width={sec.w} height={sec.h} rx={60} strokeWidth={14} />
        ))}
        {Object.values(layout.cards).map((c) => {
          const wf = workflowById.get(c.workflowId);
          const locked = !visibleIds.has(c.workflowId);
          const failing = !!wf && wf.active && wf.stats.lastStatus === 'error';
          const product = !!wf?.productId && !locked;
          const hot = heat && failing && !locked;
          const fill = hot ? SEVERITY_HEX.critical : product ? 'var(--product)' : 'currentColor';
          const opacity = hot ? 0.6 : locked ? 0.08 : !wf?.active ? 0.14 : product ? 0.5 : 0.3;
          return <rect key={c.workflowId} x={c.x} y={c.y} width={c.w} height={c.h} rx={40} style={{ fill, fillOpacity: opacity }} />;
        })}
        <rect className={s.mmView} x={vis.x} y={vis.y} width={vis.w} height={vis.h} strokeWidth={24} rx={20} />
      </svg>
    </div>
  );
}
