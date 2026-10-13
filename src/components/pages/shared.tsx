import type { ReactNode } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Focus, KeyRound, LayoutGrid, List, MessageSquareText, Pencil, Pin, Play, Power, ShieldCheck, TriangleAlert, Waypoints, Workflow as WorkflowIcon } from 'lucide-react';
import { ACTIVITY, COMPANIES, USERS, WORKFLOWS, type Activity as ActivityT, type Company, type Issue } from '../../data';
import { $pinned, togglePin, useStore, useSession } from '../../stores/session';
import { companyMembers } from '../../lib/access';
import { companyHealth } from '../../lib/health';
import { fmtCompact, relTime } from '../../lib/format';
import { Avatar, AvatarGroup } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { HealthRing } from '../ui/HealthRing';
import { Segmented } from '../ui/Segmented';
import { SeverityIcon } from '../ui/SeverityIcon';
import { Sparkline } from '../ui/Sparkline';
import s from './pages.module.css';

export function PageHeader({ eyebrow, title, lede, actions }: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={s.header}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className={s.eyebrow}>{eyebrow}</div>}
        <h1 className={s.h1}>{title}</h1>
        {lede && <p className={s.lede}>{lede}</p>}
      </div>
      {actions && <div className={s.actions}>{actions}</div>}
    </div>
  );
}

export function ViewSwitcher({ value }: { value: 'list' | 'graph' | 'canvas' }) {
  return (
    <Segmented
      value={value}
      items={[
        { id: 'list', label: 'List', icon: <List />, href: '/workflows' },
        { id: 'graph', label: 'Graph', icon: <Waypoints />, href: '/workflows/graph' },
        { id: 'canvas', label: 'Canvas', icon: <LayoutGrid />, href: '/workflows/canvas' },
      ]}
    />
  );
}

export function KpiTile({ label, value, unit, delta, deltaLabel, deltaText, spark, icon, tone, sub }: { label: string; value: string; unit?: string; delta?: number; deltaLabel?: string; deltaText?: string; spark?: number[]; icon?: ReactNode; tone?: 'good' | 'bad'; sub?: string }) {
  const dir = delta === undefined ? null : delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat';
  // for "failed" style tiles, up is bad
  const cls = dir === null ? '' : tone === 'bad' ? (dir === 'up' ? s.down : dir === 'down' ? s.up : s.flat) : dir === 'up' ? s.up : dir === 'down' ? s.down : s.flat;
  return (
    <div className={s.kpi}>
      <div className={s.kpiLabel}>
        {icon}
        {label}
      </div>
      <div className={s.kpiValue}>
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className={s.kpiFoot}>
        {dir !== null ? (
          <span className={[s.kpiDelta, cls].join(' ')} title={deltaLabel ?? 'Compared with the previous period'}>
            {dir === 'up' ? <ArrowUpRight /> : dir === 'down' ? <ArrowDownRight /> : null}
            {deltaText ?? `${delta! > 0 ? '+' : ''}${delta!.toFixed(1)}%`}
            {!spark && <span style={{ opacity: 0.7, fontWeight: 450 }}> vs last week</span>}
          </span>
        ) : sub ? (
          <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{sub}</span>
        ) : (
          <span />
        )}
        {spark && (
          <span className={s.kpiSpark}>
            <Sparkline data={spark} width={72} height={22} color="var(--text-subtle)" />
          </span>
        )}
      </div>
    </div>
  );
}

export function CompanyChip({ company }: { company: Company }) {
  return (
    <a href={`/companies/${company.slug}`} className={s.chip}>
      <span className={s.chipDot} style={{ background: company.color }} />
      {company.shortName}
    </a>
  );
}

export function IssueRow({ issue, showCompany = true }: { issue: Issue; showCompany?: boolean }) {
  const wf = WORKFLOWS.find((w) => w.id === issue.workflowId)!;
  const company = COMPANIES.find((c) => c.id === wf.companyId)!;
  const node = issue.nodeId ? wf.nodes.find((n) => n.id === issue.nodeId) : undefined;
  return (
    <div className={s.issueRow}>
      <div style={{ paddingTop: 1 }}>
        <SeverityIcon severity={issue.severity} size={13} filled />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className={s.issueTitle}>{issue.title}</div>
        <div className={s.issueMeta}>
          {showCompany && <CompanyChip company={company} />}
          <a href={`/workflows/canvas?focus=${wf.id}`}>
            <b>{wf.name}</b>
          </a>
          {node && <span className={s.subtle}>in “{node.name}”</span>}
          <span className={s.subtle}>{relTime(issue.detectedAt)}</span>
        </div>
        <div className={s.issueImpact}>{issue.impact} · {issue.suggestion}</div>
      </div>
      <div className={s.rowAction}>
        <Button size="sm" variant="secondary" href={`/workflows/canvas?focus=${wf.id}`}>
          <Focus /> Open
        </Button>
      </div>
    </div>
  );
}

export function CompanyCard({ company }: { company: Company }) {
  const { grants } = useSession();
  const pinned = useStore($pinned);
  const wfs = WORKFLOWS.filter((w) => w.companyId === company.id);
  const runs = wfs.reduce((a, w) => a + w.stats.runs7d, 0);
  const failed = wfs.reduce((a, w) => a + w.stats.failed7d, 0);
  const issues = wfs.flatMap((w) => w.issues);
  const critical = issues.filter((i) => i.severity === 'critical').length;
  const members = companyMembers(company.id, grants);
  const health = companyHealth(company.id);
  const isPinned = pinned.includes(company.id);
  return (
    <div className={s.companyCard}>
      <div className={s.companyTop}>
        <span className={s.heroMark} style={{ background: company.color, width: 40, height: 40, borderRadius: 11, fontSize: 13 }}>
          {company.initials}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={s.companyName}>
            <a href={`/companies/${company.slug}`}>{company.shortName}</a>
            {critical > 0 && (
              <span className={s.chip} style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', borderColor: 'var(--danger-border)' }}>
                <TriangleAlert size={11} /> {critical} breaking
              </span>
            )}
          </div>
          <div className={s.companyInd}>{company.industry} · {company.city}</div>
        </div>
        <HealthRing score={health} size={40} />
      </div>
      <div className={s.companyStats}>
        <div className={s.companyStat}>
          <b>{wfs.filter((w) => w.active).length}<span style={{ color: 'var(--text-subtle)', fontWeight: 450 }}>/{wfs.length}</span></b>
          active
        </div>
        <div className={s.companyStat}>
          <b>{fmtCompact(runs)}</b>
          runs, 7 days
        </div>
        <div className={s.companyStat}>
          <b style={{ color: failed ? 'var(--danger-fg)' : undefined }}>{fmtCompact(failed)}</b>
          failed, 7 days
        </div>
      </div>
      <div className={s.companyFoot}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <AvatarGroup users={members.map((m) => m.user)} size={22} max={4} />
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{members.length} people</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <button type="button" className={s.pinBtn} data-pinned={isPinned} onClick={() => togglePin(company.id)} aria-label={isPinned ? 'Unpin' : 'Pin'} title={isPinned ? 'Unpin from sidebar' : 'Pin to sidebar'}>
            <Pin style={isPinned ? { fill: 'currentColor' } : undefined} />
          </button>
          <Button size="sm" variant="secondary" href={`/workflows/canvas?focus=${company.id}`}>
            <Focus /> Canvas
          </Button>
        </span>
      </div>
    </div>
  );
}

const ACT_ICON: Record<ActivityT['type'], ReactNode> = {
  edit: <Pencil />,
  run: <Play />,
  error: <TriangleAlert />,
  access: <ShieldCheck />,
  comment: <MessageSquareText />,
  activate: <Power />,
  credential: <KeyRound />,
};

export function ActivityFeed({ items, limit = 8 }: { items?: ActivityT[]; limit?: number }) {
  const list = (items ?? ACTIVITY).slice(0, limit);
  return (
    <div className={s.activity}>
      {list.map((a) => {
        const u = a.userId ? USERS.find((x) => x.id === a.userId) : undefined;
        const c = a.companyId ? COMPANIES.find((x) => x.id === a.companyId) : undefined;
        return (
          <div key={a.id} className={s.actRow}>
            {u ? (
              <Avatar user={u} size={26} />
            ) : (
              <span className={s.actIcon} style={a.type === 'error' ? { background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderColor: 'var(--danger-border)' } : undefined}>
                {ACT_ICON[a.type]}
              </span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className={s.actText}>
                {u && <b>{u.name.split(' ')[0]} </b>}
                {a.message}
              </div>
              <div className={s.actTime}>
                {relTime(a.at)}
                {c ? ` · ${c.shortName}` : ''}
              </div>
            </div>
          </div>
        );
      })}
      {list.length === 0 && <div className={s.muted} style={{ padding: 18 }}>Nothing happened yet.</div>}
    </div>
  );
}

export function OnlineNow({ companyId }: { companyId?: string }) {
  const online = USERS.filter((u) => u.online);
  return (
    <div className={s.online}>
      {online.map((u) => {
        const viewing = u.presence?.viewing;
        const wf = viewing ? WORKFLOWS.find((w) => w.id === viewing) : undefined;
        const co = viewing ? COMPANIES.find((c) => c.id === viewing || c.id === wf?.companyId) : undefined;
        if (companyId && co?.id !== companyId) return null;
        return (
          <div key={u.id} className={s.onlineRow}>
            <Avatar user={u} size={28} online />
            <div className={s.onlineMeta}>
              <div className={s.onlineName}>
                {u.name}
                {u.isYou && <span className={s.subtle} style={{ fontWeight: 450 }}> · you</span>}
              </div>
              <div className={s.onlineSub}>{wf ? `Looking at ${wf.name}` : co ? `Browsing ${co.shortName}` : u.title}</div>
            </div>
            <span className={s.cursorDot} style={{ background: u.color }} title={`${u.name.split(' ')[0]}'s cursor colour`} />
          </div>
        );
      })}
    </div>
  );
}

export const ActivityIcon = Activity;
export const WorkflowGlyph = WorkflowIcon;
