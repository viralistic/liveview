import { ArrowRight, ExternalLink, Focus, Share2, UsersRound, X, Workflow as WorkflowIcon } from 'lucide-react';
import { COMPANIES, ROLE_LABEL, USERS, WORKFLOWS, callersOf, workflowById, nodeType } from '../../data';
import { openShare, useSession } from '../../stores/session';
import { roleForWorkflow, usersWithAccess, canManage } from '../../lib/access';
import { workflowHealth } from '../../lib/health';
import { fmtCompact, fmtDuration, fmtPct, relTime } from '../../lib/format';
import { Avatar, AvatarGroup } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Bars } from '../ui/Sparkline';
import { HealthRing } from '../ui/HealthRing';
import { NodeIcon } from '../ui/NodeIcon';
import { SeverityIcon } from '../ui/SeverityIcon';
import s from './WorkflowPanel.module.css';

/**
 * Shared detail panel for a workflow. Used by the canvas (right rail),
 * the graph view and the list view.
 */
export function WorkflowPanel({ workflowId, onClose, onFocus, showOpenCanvas, showOpenGraph }: { workflowId: string; onClose?: () => void; onFocus?: (id: string) => void; showOpenCanvas?: boolean; showOpenGraph?: boolean }) {
  const { user: me } = useSession();
  const { grants } = useSession();
  const wf = workflowById(workflowId);
  if (!wf) return null;
  const company = COMPANIES.find((c) => c.id === wf.companyId)!;
  const role = roleForWorkflow(me.id, wf, grants);
  const people = usersWithAccess({ kind: 'workflow', workflowId: wf.id }, grants);
  const owner = USERS.find((u) => u.id === wf.ownerId);
  const updatedBy = USERS.find((u) => u.id === wf.updatedById);
  const callers = callersOf(wf.id);
  const health = workflowHealth(wf);

  return (
    <div className={s.panel}>
      <div className={s.head}>
        <NodeIcon type={wf.trigger.nodeTypeId} size={36} />
        <div className={s.headMeta}>
          <div className={s.title}>{wf.name}</div>
          <div className={s.sub}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: company.color, display: 'inline-block' }} />
              {company.shortName}
            </span>
            <span>·</span>
            <span>{wf.trigger.label}</span>
            <span>·</span>
            <span>v{wf.version}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Badge tone={wf.active ? (wf.stats.lastStatus === 'error' ? 'danger' : 'success') : 'neutral'} dot>
              {wf.active ? (wf.stats.lastStatus === 'error' ? 'Failing' : wf.stats.lastStatus === 'running' ? 'Running' : 'Active') : 'Inactive'}
            </Badge>
            {wf.shared && <Badge tone="brand">Shared service</Badge>}
            {role && <Badge tone="outline">{ROLE_LABEL[role]}</Badge>}
          </div>
        </div>
        <HealthRing score={health} size={40} />
        {onClose && (
          <button type="button" className={s.closeBtn} onClick={onClose} aria-label="Close">
            <X />
          </button>
        )}
      </div>

      <div className={s.body}>
        <p className={s.desc}>{wf.description}</p>

        <div>
          <div className={s.sectionTitle}>
            <span>Last 7 days</span>
            <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 450 }}>{fmtCompact(wf.stats.runs7d)} runs</span>
          </div>
          <Bars data={wf.stats.series7d} failures={wf.stats.failures7d} width={300} height={44} />
          <div className={s.stats} style={{ marginTop: 10 }}>
            <div className={s.stat}>
              <div className={s.statLabel}>Success</div>
              <div className={s.statValue} style={{ color: wf.stats.successRate < 0.95 ? 'var(--danger-fg)' : undefined }}>{fmtPct(wf.stats.successRate)}</div>
            </div>
            <div className={s.stat}>
              <div className={s.statLabel}>Failed 24h</div>
              <div className={s.statValue}>{wf.stats.failed24h}</div>
            </div>
            <div className={s.stat}>
              <div className={s.statLabel}>Avg duration</div>
              <div className={s.statValue}>
                {fmtDuration(wf.stats.avgDurationMs)}
                <small>p95 {fmtDuration(wf.stats.p95DurationMs)}</small>
              </div>
            </div>
            <div className={s.stat}>
              <div className={s.statLabel}>Last run</div>
              <div className={s.statValue} style={{ fontSize: 'var(--fs-sm)' }}>{relTime(wf.stats.lastRunAt)}</div>
            </div>
          </div>
        </div>

        {wf.issues.length > 0 && (
          <div>
            <div className={s.sectionTitle}>
              <span>What to improve · {wf.issues.length}</span>
            </div>
            {wf.issues.map((i) => (
              <div key={i.id} className={s.issue}>
                <SeverityIcon severity={i.severity} size={13} filled />
                <div style={{ minWidth: 0 }}>
                  <div className={s.issueTitle}>{i.title}</div>
                  <div className={s.issueDetail}>{i.detail}</div>
                  <div className={s.issueFix}>
                    <b>Fix:</b> {i.suggestion}
                  </div>
                  <div className={s.issueImpact}>
                    {i.impact}
                    {i.nodeId ? ` · node “${wf.nodes.find((n) => n.id === i.nodeId)?.name}”` : ''} · detected {relTime(i.detectedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(wf.calls.length > 0 || callers.length > 0) && (
          <div>
            <div className={s.sectionTitle}>
              <span>Connections</span>
            </div>
            <div className={s.links}>
              {callers.map((c) => (
                <button key={c.id} type="button" className={s.linkRow} onClick={() => onFocus?.(c.id)}>
                  <WorkflowIcon />
                  <span>
                    Triggered by <b>{c.name}</b>
                  </span>
                  <small>{COMPANIES.find((x) => x.id === c.companyId)?.shortName}</small>
                </button>
              ))}
              {wf.calls.map((id) => {
                const t = WORKFLOWS.find((w) => w.id === id)!;
                return (
                  <button key={id} type="button" className={s.linkRow} onClick={() => onFocus?.(id)}>
                    <ArrowRight />
                    <span>
                      Triggers <b>{t.name}</b>
                    </span>
                    <small>{COMPANIES.find((x) => x.id === t.companyId)?.shortName}</small>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className={s.sectionTitle}>
            <span>Nodes · {wf.nodes.length}</span>
          </div>
          <div className={s.nodes}>
            {wf.nodes.map((n) => (
              <NodeIcon key={n.id} type={n.type} size={26} title={`${n.name} · ${nodeType(n.type).label}`} />
            ))}
          </div>
        </div>

        <div>
          <div className={s.sectionTitle}>
            <span>Access · {people.length}</span>
            {canManage(role) && (
              <button type="button" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => openShare({ kind: 'workflow', workflowId: wf.id })}>
                <Share2 size={12} /> Manage
              </button>
            )}
          </div>
          <div className={s.access}>
            <AvatarGroup users={people.map((p) => p.user)} size={26} max={6} />
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              {people.filter((p) => p.role === 'admin' || p.role === 'editor').length} can edit · {people.filter((p) => p.role === 'commenter' || p.role === 'viewer').length} can view
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
            {owner && <Avatar user={owner} size={18} />}
            <span>
              Owner {owner?.name} · updated {relTime(wf.updatedAt)} by {updatedBy?.name.split(' ')[0]}
            </span>
          </div>
        </div>
      </div>

      <div className={s.footer}>
        {showOpenCanvas && (
          <Button href={`/workflows/canvas?focus=${wf.id}`} variant="primary" size="sm">
            <Focus /> Open on canvas
          </Button>
        )}
        {showOpenGraph && (
          <Button href={`/workflows/graph?focus=${wf.id}`} variant="secondary" size="sm">
            <UsersRound /> Show in graph
          </Button>
        )}
        <Button variant="secondary" size="sm" href={`https://n8n.viralistic.nl/workflow/${wf.id}`} target="_blank" rel="noreferrer">
          <ExternalLink /> Open in n8n
        </Button>
      </div>
    </div>
  );
}
