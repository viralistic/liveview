import { useState } from 'react';
import { AtSign, Box, ChevronDown, ChevronUp, ExternalLink, Focus, Share2, UsersRound, X } from 'lucide-react';
import { COMPANIES, ROLE_LABEL, USERS, workflowById, productById } from '../../data';
import { useSession, openShare, toast } from '../../stores/session';
import { openAsk } from '../../stores/planner';
import { roleForWorkflow, usersWithAccess, canManage } from '../../lib/access';
import { workflowHealth } from '../../lib/health';
import { fmtCompact, fmtPct, relTime } from '../../lib/format';
import { AvatarGroup } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Bars } from '../ui/Sparkline';
import { HealthRing } from '../ui/HealthRing';
import { NodeIcon } from '../ui/NodeIcon';
import { SeverityIcon } from '../ui/SeverityIcon';
import { SmartFix } from '../planner/SmartFix';
import s from './WorkflowPanel.module.css';

const seconds = (ms: number) => (ms < 1000 ? `${(ms / 1000).toFixed(1)}s` : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`);

/**
 * Detail panel for one workflow. Minimal on purpose: what runs, what to fix,
 * who can see it. Connections are visible on the canvas, so they are not repeated.
 */
export function WorkflowPanel({ workflowId, onClose, onFocus, showOpenCanvas, showOpenGraph }: { workflowId: string; onClose?: () => void; onFocus?: (id: string) => void; showOpenCanvas?: boolean; showOpenGraph?: boolean }) {
  const { user: me, grants } = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const wf = workflowById(workflowId);
  if (!wf) return null;
  const company = COMPANIES.find((c) => c.id === wf.companyId)!;
  const role = roleForWorkflow(me.id, wf, grants);
  const people = usersWithAccess({ kind: 'workflow', workflowId: wf.id }, grants);
  const product = wf.productId ? productById(wf.productId) : undefined;
  const health = workflowHealth(wf);
  void onFocus;
  void USERS;

  return (
    <div className={s.panel}>
      <div className={s.head}>
        <NodeIcon type={wf.trigger.nodeTypeId} size={40} />
        <div className={s.headMeta}>
          <div className={s.title}>{wf.name}</div>
          <div className={s.sub}>
            {company.shortName} · {wf.trigger.label}
          </div>
          <div className={s.pills}>
            <Badge tone={wf.active ? (wf.stats.lastStatus === 'error' ? 'danger' : 'success') : 'neutral'} dot>
              {wf.active ? (wf.stats.lastStatus === 'error' ? 'Failing' : wf.stats.lastStatus === 'running' ? 'Running' : 'Active') : 'Inactive'}
            </Badge>
            {product && (
              <a className={s.productTag} href={`/products/${product.slug}`} title={`Instance of the ${product.name} product`}>
                <Box /> {product.name}
              </a>
            )}
            {role && role !== 'admin' && <Badge tone="outline">{ROLE_LABEL[role]}</Badge>}
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
        <div>
          <Bars data={wf.stats.series7d} failures={wf.stats.failures7d} width={320} height={40} color="var(--track-strong)" failColor="var(--accent)" />
          <div className={s.stats} style={{ marginTop: 12 }}>
            <div className={s.stat}>
              <div className={s.statLabel}>Runs, 7 days</div>
              <div className={s.statValue}>{fmtCompact(wf.stats.runs7d)}</div>
            </div>
            <div className={s.stat}>
              <div className={s.statLabel}>Success</div>
              <div className={s.statValue} style={{ color: wf.stats.successRate < 0.95 ? 'var(--accent)' : undefined }}>{fmtPct(wf.stats.successRate, 0)}</div>
            </div>
            <div className={s.stat}>
              <div className={s.statLabel}>Average</div>
              <div className={s.statValue}>{seconds(wf.stats.avgDurationMs)}</div>
            </div>
            <div className={s.stat}>
              <div className={s.statLabel}>Last run</div>
              <div className={s.statValue} style={{ fontSize: 'var(--fs-md)' }}>{relTime(wf.stats.lastRunAt)}</div>
            </div>
          </div>
        </div>

        {wf.issues.length > 0 && (
          <div>
            <div className={s.sectionTitle}>
              <span>Fix now</span>
            </div>
            {wf.issues.map((i) => (
              <div key={i.id} className={s.fix}>
                <div className={s.fixHead}>
                  <SeverityIcon severity={i.severity} size={13} filled />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className={s.fixAction}>{i.action}</div>
                    <div className={s.fixImpact}>{i.impact}</div>
                  </div>
                </div>
                {open === i.id && (
                  <div className={s.fixDetails}>
                    {i.detail}
                    <br />
                    <br />
                    <b>How:</b> {i.suggestion}
                  </div>
                )}
                <div className={s.fixRow}>
                  <SmartFix issue={i} compact />
                  <button type="button" className={s.linkBtn} onClick={() => setOpen(open === i.id ? null : i.id)}>
                    {open === i.id ? 'Less' : 'Why'} {open === i.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <button type="button" className={s.linkBtn} style={{ marginLeft: 'auto' }} onClick={() => toast(`Opened “${wf.name}” in n8n (demo)`)}>
                    Open in n8n
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className={s.sectionTitle}>
            <span>People</span>
            {canManage(role) && (
              <button type="button" className={s.linkBtn} style={{ textTransform: 'none', letterSpacing: 0 }} onClick={() => openShare({ kind: 'workflow', workflowId: wf.id })}>
                <Share2 size={12} /> Manage
              </button>
            )}
          </div>
          <div className={s.people}>
            <AvatarGroup users={people.map((p) => p.user)} size={28} max={6} />
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{people.length} can see this</span>
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
            <UsersRound /> Graph
          </Button>
        )}
        <Button variant="secondary" size="sm" href={`https://n8n.viralistic.nl/workflow/${wf.id}`} target="_blank" rel="noreferrer">
          <ExternalLink /> Open in n8n
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openAsk({ workflowId: wf.id })} title="Tag someone about this workflow">
          <AtSign /> Ask
        </Button>
      </div>
    </div>
  );
}
