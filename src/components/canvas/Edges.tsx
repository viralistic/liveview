/** SVG world layer: source edges (dashed) and Execute Workflow edges with travelling dots. */
import { useMemo } from 'react';
import { useStore } from '@nanostores/react';
import type { Workflow } from '../../data/types';
import { companyById } from '../../data/companies';
import type { WorldLayout } from '../../lib/layout';
import { interWorkflowRoute, sourceRoute } from './geometry';
import { $hoverWf } from './viewport';
import type { Selection } from './types';
import s from './canvas.module.css';

interface InterEdge {
  id: string;
  from: string;
  to: string;
  d: string;
  dur: number;
  dots: number;
  color: string;
}
interface SrcEdge {
  id: string;
  wf: string;
  d: string;
  dur: number;
  active: boolean;
}

export function Edges({ layout, workflowById, visibleIds, selection, showConnections, showSources }: { layout: WorldLayout; workflowById: ReadonlyMap<string, Workflow>; visibleIds: ReadonlySet<string>; selection: Selection; showConnections: boolean; showSources: boolean }) {
  const hover = useStore($hoverWf);
  const hiId = hover ?? (selection?.kind === 'workflow' ? selection.id : null);

  const inter = useMemo<InterEdge[]>(() => {
    const out: InterEdge[] = [];
    for (const id of visibleIds) {
      const wf = workflowById.get(id);
      const card = layout.cards[id];
      if (!wf || !card) continue;
      for (const calleeId of wf.calls) {
        const callee = workflowById.get(calleeId);
        const calleeCard = layout.cards[calleeId];
        if (!callee || !calleeCard || !visibleIds.has(calleeId)) continue;
        const route = interWorkflowRoute(card, wf, calleeCard, callee);
        const traffic = wf.stats.runs24h;
        out.push({
          id: `e-${wf.id}-${calleeId}`,
          from: wf.id,
          to: calleeId,
          d: route.d,
          dur: Math.min(9, Math.max(2.6, route.len / 460)),
          dots: wf.active ? (traffic > 150 ? 3 : traffic > 40 ? 2 : 1) : 0,
          color: companyById(wf.companyId).color,
        });
      }
    }
    return out;
  }, [layout, workflowById, visibleIds]);

  const src = useMemo<SrcEdge[]>(() => {
    const out: SrcEdge[] = [];
    for (const source of layout.sources) {
      for (const id of source.workflowIds) {
        const wf = workflowById.get(id);
        const card = layout.cards[id];
        if (!wf || !card || !visibleIds.has(id)) continue;
        const route = sourceRoute(source, card, wf);
        out.push({ id: `s-${source.id.replace(':', '-')}-${id}`, wf: id, d: route.d, dur: Math.min(7, Math.max(2.4, route.len / 260)), active: wf.active });
      }
    }
    return out;
  }, [layout, workflowById, visibleIds]);

  return (
    <>
      {showSources &&
        src.map((e) => (
          <g key={e.id}>
            <path id={e.id} className={s.srcEdge} d={e.d} />
            {e.active && (
              <g>
                <animateMotion dur={`${e.dur}s`} repeatCount="indefinite" begin={`-${(e.dur * 0.37).toFixed(2)}s`}>
                  <mpath href={`#${e.id}`} />
                </animateMotion>
                <circle className={s.dot} r={2.6} fill="rgba(0,0,0,0.5)" />
              </g>
            )}
          </g>
        ))}
      {showConnections &&
        inter.map((e) => {
          const hi = hiId === e.from || hiId === e.to;
          const dim = hiId != null && !hi;
          const dur = hi ? e.dur / 1.45 : e.dur;
          return (
            <g key={e.id}>
              <path id={e.id} className={s.edge} data-hi={hi} data-dim={dim} d={e.d} />
              {Array.from({ length: e.dots }, (_, i) => (
                <g key={`${i}-${hi ? 'h' : 'n'}`}>
                  <animateMotion dur={`${dur.toFixed(2)}s`} repeatCount="indefinite" begin={`-${((i / e.dots) * dur).toFixed(2)}s`}>
                    <mpath href={`#${e.id}`} />
                  </animateMotion>
                  <circle className={s.dot} r={hi ? 4.5 : 3.5} fill={e.color} fillOpacity={dim ? 0.3 : 0.7} />
                </g>
              ))}
            </g>
          );
        })}
    </>
  );
}
