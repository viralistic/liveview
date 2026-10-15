/**
 * Side panel for one fork: its flow with the swapped nodes marked in purple,
 * a "was / now" diff against the product, who uses it, and the actions:
 * use it, fork it again, open a pull request, merge it into the product.
 */
import { useEffect, useMemo } from 'react';
import { ArrowRight, Check, ChevronRight, GitFork, GitMerge, GitPullRequestArrow, Lock, Minus, Plus, Replace, Rocket, Star, X } from 'lucide-react';
import { companyById } from '../../data/companies';
import { forkAncestors, forkDiff, forkFlow } from '../../data/forks';
import { nodeType } from '../../data/nodeTypes';
import { orgOfUser } from '../../data/orgs';
import type { Fork, Product } from '../../data/types';
import { userById } from '../../data/users';
import { relTime } from '../../lib/format';
import { mergeFork, openPullRequest } from '../../stores/forks';
import { useSession } from '../../stores/session';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { CompanyMark } from '../ui/CompanyMark';
import { NodeIcon } from '../ui/NodeIcon';
import { Tooltip } from '../ui/Tooltip';
import { ForkStatusPill } from './ForkCard';
import { LiveGraph, type NodeMark } from './LiveGraph';
import { MEDIUM_PRESET } from './graphLayout';
import s from './products.module.css';

export function ForkDrawer({ fork, product, all, onClose, onUse, onForkThis, starred, starCount, onStar, escapeDisabled }: { fork: Fork | null; product: Product; all: Fork[]; onClose: () => void; onUse: (fork: Fork) => void; onForkThis: (fork: Fork) => void; starred: boolean; starCount: number; onStar: () => void; escapeDisabled?: boolean }) {
  const { userId, can } = useSession();
  const canFork = can('fork-products');
  const canPublish = can('publish-products');

  useEffect(() => {
    if (!fork || escapeDisabled) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fork, escapeDisabled, onClose]);

  const flow = useMemo(() => (fork ? forkFlow(fork, all) : null), [fork, all]);
  const diff = useMemo(() => (fork ? forkDiff(fork, all) : []), [fork, all]);
  if (!fork || !flow) return null;

  const author = userById(fork.authorId);
  const org = orgOfUser(author);
  const ancestors = forkAncestors(fork, all);
  const marks: Record<string, NodeMark> = {};
  for (const [id] of Object.entries(flow.inherited)) marks[id] = 'inherited';
  for (const [id, kind] of Object.entries(flow.changed)) marks[id] = kind;
  const own = diff.filter((d) => !d.inherited);
  const inherited = diff.filter((d) => d.inherited);
  const forkBtn = (
    <Button variant="secondary" disabled={!canFork} onClick={() => onForkThis(fork)} style={!canFork ? { pointerEvents: 'none' } : undefined}>
      <GitFork /> Fork this
    </Button>
  );

  return (
    <div className={s.drawerOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={s.drawer} role="dialog" aria-modal="true" aria-label={fork.name}>
        <header className={s.drawerHead}>
          <nav className={s.crumbs} aria-label="Lineage">
            <span>{product.name}</span>
            {ancestors.map((a) => (
              <span key={a.id} className={s.crumb}>
                <ChevronRight />
                {a.name}
              </span>
            ))}
            <span className={s.crumb}>
              <ChevronRight />
              <b>{fork.name}</b>
            </span>
          </nav>
          <Button variant="ghost" icon size="sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </header>

        <div className={s.drawerBody}>
          <div className={s.drawerTitle}>
            <h2>{fork.name}</h2>
            <ForkStatusPill fork={fork} />
          </div>
          <div className={s.drawerMeta}>
            <span className={s.metaBy}>
              <Avatar user={author} size={20} /> {author.name} · {org.shortName}
            </span>
            <span className={s.metaDot}>·</span>
            <span>forked {relTime(fork.createdAt)}</span>
            <span className={s.metaDot}>·</span>
            <span>updated {relTime(fork.updatedAt)}</span>
            <span className={s.metaDot}>·</span>
            <span className={s.aheadBehind}>
              <b>{fork.commitsAhead}</b> ahead, <b>{fork.commitsBehind}</b> behind
            </span>
            <button type="button" className={s.starBtn} data-sm="true" data-on={starred} onClick={onStar} aria-pressed={starred} title={starred ? 'Unstar' : 'Star this fork'}>
              <Star />
              {starCount}
            </button>
          </div>
          {fork.description && <p className={s.description}>{fork.description}</p>}

          <div className={s.drawerStage}>
            <LiveGraph nodes={flow.nodes} connections={flow.connections} preset={MEDIUM_PRESET} changed={marks} />
            <div className={s.stageLegend}>
              <span>
                <i className={s.legendMark}>
                  <Replace />
                </i>
                swapped
              </span>
              <span>
                <i className={s.legendMark}>
                  <Plus />
                </i>
                added
              </span>
              {inherited.length > 0 && (
                <span>
                  <i className={s.legendMark} data-kind="inherited">
                    <Replace />
                  </i>
                  from parent fork
                </span>
              )}
            </div>
          </div>

          <section className={s.diff}>
            <h4 className={s.diffTitle}>
              Changes
              <span className={s.netMuted}>
                {' '}
                · {own.length} own{inherited.length ? `, ${inherited.length} inherited` : ''}
              </span>
            </h4>
            {diff.length > 0 && (
              <div className={s.diffHead}>
                <span />
                <span>was</span>
                <span />
                <span>now</span>
              </div>
            )}
            {diff.map((d, i) => {
              const fromDef = d.from ? nodeType(d.from) : undefined;
              const toDef = d.to ? nodeType(d.to) : undefined;
              return (
                <div key={`${d.nodeId}-${i}`} className={s.diffRow} data-kind={d.kind} data-inherited={d.inherited}>
                  <span className={s.diffKind} title={d.kind}>
                    {d.kind === 'swapped' ? <Replace /> : d.kind === 'added' ? <Plus /> : <Minus />}
                  </span>
                  <span className={s.diffCell}>
                    {fromDef ? (
                      <>
                        <NodeIcon type={d.from!} size={26} />
                        <span className={s.diffText}>
                          <b>{fromDef.label}</b>
                          <small>{d.name}</small>
                        </span>
                      </>
                    ) : (
                      <span className={s.diffNone}>not in the product</span>
                    )}
                  </span>
                  <ArrowRight className={s.diffArrow} />
                  <span className={s.diffCell} data-now="true">
                    {toDef ? (
                      <>
                        <NodeIcon type={d.to!} size={26} />
                        <span className={s.diffText}>
                          <b>{toDef.label}</b>
                          <small>{d.name}</small>
                        </span>
                      </>
                    ) : (
                      <span className={s.diffNone}>removed</span>
                    )}
                  </span>
                  {d.inherited && <span className={s.inheritedTag}>parent fork</span>}
                </div>
              );
            })}
            {diff.length === 0 && <div className={s.diffEmpty}>Same nodes as its parent. Changes will show here as they are committed.</div>}
          </section>

          <section className={s.usedBy}>
            <h4 className={s.diffTitle}>Used by</h4>
            {fork.usedByCompanyIds.length > 0 ? (
              <div className={s.usedByList}>
                {fork.usedByCompanyIds.map((id) => {
                  const c = companyById(id);
                  return (
                    <span key={id} className={s.usedByChip}>
                      <CompanyMark company={c} size={18} /> {c.shortName}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className={s.diffEmpty}>Not deployed yet. Use this variant to create the first instance.</div>
            )}
          </section>
        </div>

        <footer className={s.drawerFoot}>
          <div className={s.drawerActions}>
            {fork.status !== 'archived' && (
              <Button variant="primary" onClick={() => onUse(fork)}>
                <Rocket /> Use this variant
              </Button>
            )}
            {canFork ? forkBtn : <Tooltip label="Your role cannot fork products">{forkBtn}</Tooltip>}
            {fork.status === 'diverged' && canFork && (
              <Button variant="secondary" onClick={() => openPullRequest(fork)}>
                <GitPullRequestArrow /> Open pull request
              </Button>
            )}
            {canPublish && (fork.status === 'diverged' || fork.status === 'pr-open') && (
              <Button variant="secondary" className={s.btnProduct} onClick={() => mergeFork(fork, userId)}>
                <GitMerge /> Merge into product
              </Button>
            )}
            {fork.status === 'merged' && (
              <span className={s.mergedNote}>
                <Check /> Merged into {product.name}
              </span>
            )}
          </div>
          <span className={s.repoNote}>
            <Lock /> Versioned like code. Demo: not connected to GitHub.
          </span>
        </footer>
      </aside>
    </div>
  );
}
