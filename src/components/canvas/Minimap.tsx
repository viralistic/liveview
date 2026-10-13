/** Small overview map; click to jump. */
import { useStore } from '@nanostores/react';
import type { Workflow } from '../../data/types';
import { companyById } from '../../data/companies';
import type { WorldLayout } from '../../lib/layout';
import { $viewport, type ViewportController } from './viewport';
import s from './canvas.module.css';

const M = 400; // world margin

export function Minimap({ ctrl, layout, visibleIds, workflowById }: { ctrl: ViewportController; layout: WorldLayout; visibleIds: ReadonlySet<string>; workflowById: ReadonlyMap<string, Workflow> }) {
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
          <rect key={sec.companyId} x={sec.x} y={sec.y} width={sec.w} height={sec.h} rx={60} fill="rgba(0,0,0,0.035)" stroke="rgba(0,0,0,0.1)" strokeWidth={14} />
        ))}
        {Object.values(layout.cards).map((c) => {
          const wf = workflowById.get(c.workflowId);
          const locked = !visibleIds.has(c.workflowId);
          const failing = !!wf && wf.active && wf.stats.lastStatus === 'error';
          const color = failing ? 'rgba(239,68,68,0.55)' : locked ? 'rgba(0,0,0,0.06)' : wf?.active ? companyById(c.companyId).color : 'rgba(0,0,0,0.12)';
          return <rect key={c.workflowId} x={c.x} y={c.y} width={c.w} height={c.h} rx={40} fill={color} fillOpacity={failing || locked || !wf?.active ? 1 : 0.35} />;
        })}
        <rect x={vis.x} y={vis.y} width={vis.w} height={vis.h} fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.7)" strokeWidth={24} rx={20} />
      </svg>
    </div>
  );
}
