/** The n8n-style editor rendered inside a card (full tier) and its mini version. */
import { memo } from 'react';
import type { Workflow } from '../../data/types';
import { nodeType } from '../../data/nodeTypes';
import { iconByName } from '../ui/icons';
import { NODE_SIZE } from '../../lib/layout';
import { connectionGeometry, cubicPath, nodePorts, nodeRel } from './geometry';
import s from './canvas.module.css';

export const FullGraph = memo(function FullGraph({ wf, failedNodeIds }: { wf: Workflow; failedNodeIds: ReadonlySet<string> }) {
  const conns = connectionGeometry(wf);
  const ports = nodePorts(wf);
  const running = wf.active && wf.stats.lastStatus === 'running';
  return (
    <>
      <svg className={s.graphSvg} aria-hidden="true">
        {conns.map((c) => (
          <path key={c.id} className={s.conn} d={c.d} />
        ))}
      </svg>
      {wf.nodes.map((n) => {
        const p = nodeRel(n);
        const def = nodeType(n.type);
        const Icon = iconByName(def.icon);
        const pp = ports.get(n.id)!;
        return (
          <div
            key={n.id}
            className={s.node}
            style={{ left: p.x, top: p.y, color: def.color }}
            data-trigger={n.col === 0}
            data-disabled={!!n.disabled}
            data-failed={failedNodeIds.has(n.id)}
            data-running={running && n.col === 0}
            title={`${n.name} · ${def.label}`}
          >
            <Icon strokeWidth={1.75} />
            <div className={s.nodeLabel}>{n.name}</div>
            {pp.input && <span className={s.portIn} style={{ left: 0, top: NODE_SIZE / 2 }} />}
            {pp.outputs.map((o) => (
              <span key={o.key} className={s.port} style={{ left: NODE_SIZE, top: o.y - p.y }} />
            ))}
          </div>
        );
      })}
      {conns
        .filter((c) => c.label)
        .map((c) => (
          <div key={`${c.id}-l`} className={s.connLabel} style={{ left: c.mid.x, top: c.mid.y }}>
            {c.label}
          </div>
        ))}
    </>
  );
});

const MINI = 80;
const MINI_OFF = (NODE_SIZE - MINI) / 2;

export const MiniGraph = memo(function MiniGraph({ wf, failedNodeIds }: { wf: Workflow; failedNodeIds: ReadonlySet<string> }) {
  const byId = new Map(wf.nodes.map((n) => [n.id, n] as const));
  return (
    <>
      <svg className={s.graphSvg} aria-hidden="true">
        {wf.connections.map((c, i) => {
          const a = byId.get(c.from);
          const b = byId.get(c.to);
          if (!a || !b) return null;
          const pa = nodeRel(a);
          const pb = nodeRel(b);
          return <path key={i} className={s.miniConn} d={cubicPath({ x: pa.x + NODE_SIZE - MINI_OFF, y: pa.y + NODE_SIZE / 2 }, { x: pb.x + MINI_OFF, y: pb.y + NODE_SIZE / 2 }, 36, 0.5)} />;
        })}
      </svg>
      {wf.nodes.map((n) => {
        const p = nodeRel(n);
        const def = nodeType(n.type);
        const Icon = iconByName(def.icon);
        return (
          <div key={n.id} className={s.miniNode} style={{ left: p.x + MINI_OFF, top: p.y + MINI_OFF, color: def.color }} data-trigger={n.col === 0} data-disabled={!!n.disabled} data-failed={failedNodeIds.has(n.id)} title={n.name}>
            <Icon strokeWidth={2} />
          </div>
        );
      })}
    </>
  );
});
