import { memo } from 'react';
import { Lock } from 'lucide-react';
import type { Company, Severity, User, Workflow } from '../../data/types';
import type { CardLayout, Rect } from '../../lib/layout';
import { fmtCompact, relTime } from '../../lib/format';
import { productById } from '../../data/products';
import { Avatar } from '../ui/Avatar';
import { Badge, type Tone } from '../ui/Badge';
import { NodeIcon } from '../ui/NodeIcon';
import { ProductDot, ProductTag } from '../ui/ProductTag';
import { SeverityIcon } from '../ui/SeverityIcon';
import { Sparkline } from '../ui/Sparkline';
import { FullGraph, MiniGraph } from './NodeGraph';
import { isDraft } from './NewWorkflow';
import { $hoverWf, type Tier } from './viewport';
import s from './canvas.module.css';

export type StatusKey = 'draft' | 'inactive' | 'failing' | 'running' | 'active';
export function workflowStatus(wf: Workflow): { label: string; tone: Tone; key: StatusKey } {
  if (isDraft(wf)) return { label: 'Draft', tone: 'outline', key: 'draft' };
  if (!wf.active) return { label: 'Inactive', tone: 'neutral', key: 'inactive' };
  if (wf.stats.lastStatus === 'error') return { label: 'Failing', tone: 'danger', key: 'failing' };
  if (wf.stats.lastStatus === 'running') return { label: 'Running', tone: 'info', key: 'running' };
  return { label: 'Active', tone: 'success', key: 'active' };
}

const SEV_ORDER: Severity[] = ['critical', 'inefficient', 'minor'];

/** Finding counts. Breaking is pink, everything else is quiet grey; the heat hue carries the colour. */
function Chips({ wf }: { wf: Workflow }) {
  if (!wf.issues.length) return null;
  return (
    <span className={s.chips}>
      {SEV_ORDER.map((sev) => {
        const n = wf.issues.filter((i) => i.severity === sev).length;
        if (!n) return null;
        return (
          <span key={sev} className={s.chip} data-sev={sev} title={`${n} ${sev === 'critical' ? 'breaking' : sev === 'inefficient' ? 'wasteful' : 'minor'} finding${n > 1 ? 's' : ''}`}>
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
  const draft = status.key === 'draft';
  const failing = status.key === 'failing';
  const failedNodeIds = new Set(failing ? wf.issues.filter((i) => i.severity === 'critical' && i.nodeId).map((i) => i.nodeId!) : []);
  const product = wf.productId ? productById(wf.productId) : undefined;
  const compact = tier === 'tiny' || tier === 'compact';
  const wide = tier === 'mini2' || tier === 'full';
  // mini bands are ~340px wide: a product tag there costs the chips and the owner avatar
  const showChips = tier === 'tiny' || tier === 'compact' || (tier === 'mini' && !product);
  const showOwner = !!owner && !(tier === 'mini' && product);
  // the tag is a real link to the product page; data-ui keeps the canvas from treating the press as a card click.
  // Compact cards are ~180px wide at fit zoom, so they carry the purple dot and the tag appears from the mini tier up.
  const tag = product ? (
    <span className={s.tagWrap} data-ui>
      <ProductTag name={product.name} slug={product.slug} size="sm" />
    </span>
  ) : null;

  return (
    <div
      className={[s.card, locked ? s.ghost : ''].join(' ')}
      data-wf={wf.id}
      data-locked={locked || undefined}
      data-draft={draft || undefined}
      data-tier={tier}
      data-selected={selected}
      data-failing={!locked && failing}
      data-inactive={!locked && !draft && !wf.active}
      data-product={!locked && !!product}
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
            {product && <ProductDot />}
            <span className={s.spacer} />
            <span className={s.statusDot} data-status={status.key} title={status.label} />
          </div>
          <div className={s.row2}>
            <Sparkline data={wf.stats.series7d} width={64} height={16} color={failing ? 'var(--accent)' : 'var(--neutral-500)'} />
            <span className={s.cardMeta}>{draft ? 'not deployed' : `${fmtCompact(wf.stats.runs7d)} runs`}</span>
            <span className={s.spacer} />
            <Chips wf={wf} />
          </div>
        </div>
      ) : (
        <>
          <div className={s.band}>
            <NodeIcon type={wf.trigger.nodeTypeId} size={20} />
            <span className={s.cardName}>{wf.name}</span>
            {wide && <span className={s.companyChip}>{company.shortName}</span>}
            {tag}
            <Badge tone={status.tone} dot={!draft} size="sm">
              {status.label}
            </Badge>
            {showChips && <Chips wf={wf} />}
            <span className={s.spacer} />
            {wide && <span className={s.cardMeta}>{draft ? 'Not deployed yet' : wf.active ? `Last run ${relTime(wf.stats.lastRunAt)}` : `Paused ${relTime(wf.updatedAt)}`}</span>}
            {showOwner && owner && <Avatar user={owner} size={18} title={`Owner ${owner.name}`} />}
          </div>
          {tier === 'full' ? <FullGraph wf={wf} failedNodeIds={failedNodeIds} /> : <MiniGraph wf={wf} failedNodeIds={failedNodeIds} />}
        </>
      )}
    </div>
  );
});
