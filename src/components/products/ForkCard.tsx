import { Archive, ArrowRight, Eye, GitBranch, GitMerge, GitPullRequestArrow, Minus, Plus, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { companyById } from '../../data/companies';
import { forkById } from '../../data/forks';
import { nodeType } from '../../data/nodeTypes';
import { orgOfUser } from '../../data/orgs';
import type { Fork, ForkStatus, NodeSwap } from '../../data/types';
import { userById } from '../../data/users';
import { relTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { CompanyMark } from '../ui/CompanyMark';
import { NodeIcon } from '../ui/NodeIcon';
import s from './products.module.css';

const STATUS_ICON: Record<ForkStatus, ReactNode> = {
  diverged: <GitBranch />,
  'pr-open': <GitPullRequestArrow />,
  merged: <GitMerge />,
  archived: <Archive />,
};

/** Status pill: purple when the fork is on its way into the product (PR open, merged), neutral otherwise. */
export function ForkStatusPill({ fork, size }: { fork: Fork; size?: 'sm' }) {
  const label = fork.status === 'pr-open' ? `PR #${fork.prNumber ?? ''} open` : fork.status === 'merged' ? (fork.prNumber ? `Merged #${fork.prNumber}` : 'Merged') : fork.status === 'archived' ? 'Archived' : 'Diverged';
  return (
    <span className={s.status} data-status={fork.status} data-size={size}>
      {STATUS_ICON[fork.status]}
      {label}
    </span>
  );
}

/** "HubSpot -> SAP" with both node icons. */
export function SwapChip({ swap }: { swap: NodeSwap }) {
  const from = nodeType(swap.from);
  const to = nodeType(swap.to);
  return (
    <span className={s.swapChip} title={`${swap.nodeName}: ${from.label} swapped for ${to.label}`}>
      <NodeIcon type={swap.from} size={18} />
      <span className={s.swapFrom}>{from.label}</span>
      <ArrowRight />
      <NodeIcon type={swap.to} size={18} />
      <span className={s.swapTo}>{to.label}</span>
    </span>
  );
}

export function ForkRow({ fork, all, starred, starCount, onStar, onOpen, active }: { fork: Fork; all: Fork[]; starred: boolean; starCount: number; onStar: () => void; onOpen: () => void; active?: boolean }) {
  const author = userById(fork.authorId);
  const org = orgOfUser(author);
  const parent = fork.parentForkId ? forkById(fork.parentForkId, all) : undefined;
  const changes = fork.swaps.length + (fork.addedNodes?.length ?? 0) + (fork.removedNodeIds?.length ?? 0);
  return (
    <div className={s.forkRow} data-status={fork.status} data-active={active}>
      <Avatar user={author} size={30} />
      <div className={s.forkMain}>
        <div className={s.forkTitle}>
          <button type="button" className={s.forkName} onClick={onOpen}>
            {fork.name}
          </button>
          <ForkStatusPill fork={fork} size="sm" />
          {parent && (
            <span className={s.forkOf} title={`Forked from ${parent.name}`}>
              fork of {parent.name}
            </span>
          )}
        </div>
        <div className={s.forkMeta}>
          <span>
            {author.name} · {org.shortName}
          </span>
          <span className={s.metaDot}>·</span>
          <span>updated {relTime(fork.updatedAt)}</span>
          <span className={s.metaDot}>·</span>
          <span className={s.aheadBehind} title="Commits ahead of and behind the product's main branch">
            <b>{fork.commitsAhead}</b> ahead, <b>{fork.commitsBehind}</b> behind
          </span>
        </div>
        <div className={s.chipRow}>
          {fork.swaps.map((sw) => (
            <SwapChip key={sw.nodeId} swap={sw} />
          ))}
          {(fork.addedNodes ?? []).map((n) => (
            <span key={n.id} className={s.swapChip} data-kind="added" title={`Adds a ${nodeType(n.type).label} node: ${n.name}`}>
              <Plus />
              <NodeIcon type={n.type} size={18} />
              <span className={s.swapTo}>{n.name}</span>
            </span>
          ))}
          {(fork.removedNodeIds ?? []).map((id) => (
            <span key={id} className={s.swapChip} data-kind="removed">
              <Minus />
              <span className={s.swapFrom}>{id}</span>
            </span>
          ))}
          {changes === 0 && <span className={s.noChanges}>No node changes yet, same flow as its parent</span>}
        </div>
      </div>
      <div className={s.forkSide}>
        {fork.usedByCompanyIds.length > 0 && (
          <span className={s.marks} title={`Used by ${fork.usedByCompanyIds.map((id) => companyById(id).shortName).join(', ')}`}>
            {fork.usedByCompanyIds.map((id) => (
              <CompanyMark key={id} company={companyById(id)} size={20} />
            ))}
          </span>
        )}
        <button type="button" className={s.starBtn} data-sm="true" data-on={starred} onClick={onStar} aria-pressed={starred} title={starred ? 'Unstar' : 'Star this fork'}>
          <Star />
          {starCount}
        </button>
        <Button size="sm" variant="secondary" onClick={onOpen}>
          <Eye /> View
        </Button>
      </div>
    </div>
  );
}
