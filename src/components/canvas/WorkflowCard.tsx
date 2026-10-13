import { memo } from 'react';
import { Lock } from 'lucide-react';
import type { Company, Severity, User, Workflow } from '../../data/types';
import type { CardLayout, Rect } from '../../lib/layout';
import { fmtCompact, relTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Badge, type Tone } from '../ui/Badge';
import { NodeIcon } from '../ui/NodeIcon';
import { SeverityIcon } from '../ui/SeverityIcon';
import { Sparkline } from '../ui/Sparkline';
import { FullGraph, MiniGraph } from './NodeGraph';
import { $hoverWf, type Tier } from './viewport';
import s from './canvas.module.css';

export function workflowStatus(wf: Workflow): { label: string; tone: Tone; color: string } {
  if (!wf.active) return { label: 'Inactive', tone: 'neutral', color: 'var(--neutral-400)' };
  if (wf.stats.lastStatus === 'error') return { label: 'Failing', tone: 'danger', color: 'var(--danger)' };
  if (wf.stats.lastStatus === 'running') return { label: 'Running', tone: 'info', color: 'var(--info)' };
  return { label: 'Active', tone: 'success', color: 'var(--success)' };
}

const SEV_ORDER: Severity[] = ['critical', 'inefficient', 'minor'];

function Chips({ wf }: { wf: Workflow }) {
  if (!wf.issues.length) return null;
  return (
    <span className={s.chips}>
      {SEV_ORDER.map((sev) => {
        const n = wf.issues.filter((i) => i.severity === sev).length;
        if (!n) return null;
        return (
          <span key={sev} className={s.chip} data-sev={sev} title={`${n} ${sev === 'critical' ? 'breaking' : sev === 'inefficient' ? 'inefficient' : 'minor'} issue${n > 1 ? 's' : ''}`}>
            <SeverityIcon severity={sev} size={11} />
            {n}
          </span>
        );
      })}
    </span>
  );
}

export interface WorkflowCardProps {
  card: CardLayout;
  origin: Rect;
  wf: Workflow;
  company: Company;
  owner?: User;
  tier: Tier;
  selected: boolean;
  locked: boolean;
  askName?: string;
}

export const WorkflowCard = memo(function WorkflowCard({ card, origin, wf, company, owner, tier, selected, locked, askName }: WorkflowCardProps) {
  const status = workflowStatus(wf);
  const failing = wf.active && wf.stats.lastStatus === 'error';
  const failedNodeIds = new Set(failing ? wf.issues.filter((i) => i.severity === 'critical' && i.nodeId).map((i) => i.nodeId!) : []);
  const compact = tier === 'tiny' || tier === 'compact';
  const wide = tier === 'mini2' || tier === 'full';
  const showChips = tier !== 'mini2' && tier !== 'full';

  return (
    <div
      className={[s.card, locked ? s.ghost : ''].join(' ')}
      data-wf={wf.id}
      data-locked={locked || undefined}
      data-tier={tier}
      data-selected={selected}
      data-failing={!locked && failing}
      data-inactive={!locked && !wf.active}
      style={{ left: card.x - origin.x, top: card.y - origin.y, width: card.w, height: card.h }}
      onPointerEnter={locked ? undefined : () => $hoverWf.set(wf.id)}
      onPointerLeave={locked ? undefined : () => $hoverWf.set(null)}
    >
      {locked ? (
        <div className={s.ghostInner}>
          <span className={s.ghostLock}>
            <Lock />
          </span>
          <span className={s.ghostTitle}>No access</span>
          <span className={s.ghostSub}>{askName ? `Ask ${askName} for access` : 'Ask an admin for access'}</span>
        </div>
      ) : compact ? (
        <div className={s.fill}>
          <div className={s.row}>
            <NodeIcon type={wf.trigger.nodeTypeId} size={18} />
            <span className={s.cardName}>{wf.name}</span>
            <span className={s.spacer} />
            <span className={s.statusDot} style={{ background: status.color }} title={status.label} />
          </div>
          <div className={s.row2}>
            <Sparkline data={wf.stats.series7d} width={64} height={16} color={failing ? 'var(--danger)' : 'var(--neutral-500)'} />
            <span className={s.cardMeta}>{fmtCompact(wf.stats.runs7d)} runs</span>
            <span className={s.spacer} />
            <Chips wf={wf} />
          </div>
        </div>
      ) : (
        <>
          <div className={s.band}>
            <NodeIcon type={wf.trigger.nodeTypeId} size={20} />
            <span className={s.cardName}>{wf.name}</span>
            {wide && (
              <span className={s.companyChip}>
                <i style={{ background: company.color }} />
                {company.shortName}
              </span>
            )}
            <Badge tone={status.tone} dot size="sm">
              {status.label}
            </Badge>
            {showChips && <Chips wf={wf} />}
            <span className={s.spacer} />
            {wide && <span className={s.cardMeta}>{wf.active ? `Last run ${relTime(wf.stats.lastRunAt)}` : `Paused ${relTime(wf.updatedAt)}`}</span>}
            {owner && <Avatar user={owner} size={18} title={`Owner ${owner.name}`} />}
          </div>
          {tier === 'full' ? <FullGraph wf={wf} failedNodeIds={failedNodeIds} /> : <MiniGraph wf={wf} failedNodeIds={failedNodeIds} />}
        </>
      )}
    </div>
  );
});
