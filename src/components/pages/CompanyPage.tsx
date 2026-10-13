import { useMemo } from 'react';
import { Activity, CheckCircle2, Clock, Flame, KeyRound, Lightbulb, LayoutGrid, Share2, ShieldCheck, TriangleAlert, UsersRound, Zap } from 'lucide-react';
import { ACTIVITY, COMPANIES, CREDENTIALS, ROLE_LABEL, SEVERITY_RANK, WORKFLOWS } from '../../data';
import { useSession } from '../../stores/session';
import { openShare } from '../../stores/session';
import { canManage, canSeeWorkflow, companyMembers, roleForCompany, roleForWorkflow, scopeLabel } from '../../lib/access';
import { aggregateSeries, companyHealth, workflowHealth, worstSeverity } from '../../lib/health';
import { fmtCompact, fmtDuration, fmtEuro, fmtInt, fmtPct, relTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { HealthRing } from '../ui/HealthRing';
import { NodeIcon } from '../ui/NodeIcon';
import { SeverityIcon } from '../ui/SeverityIcon';
import { Bars } from '../ui/Sparkline';
import ui from '../ui/ui.module.css';
import { DotMatrix } from './charts/DotMatrix';
import { ActivityFeed, IssueRow, KpiTile, OnlineNow, PageHeader } from './shared';
import s from './pages.module.css';

export function CompanyPage({ companyId }: { companyId: string }) {
  const { user: me } = useSession();
  const { grants } = useSession();
  const company = COMPANIES.find((c) => c.id === companyId)!;
  const all = WORKFLOWS.filter((w) => w.companyId === companyId);
  const wfs = all.filter((w) => canSeeWorkflow(me.id, w, grants));
  const locked = all.length - wfs.length;
  const myRole = roleForCompany(me.id, companyId, grants);
  const members = companyMembers(companyId, grants);
  const agg = useMemo(() => aggregateSeries(wfs), [wfs]);
  const runs7d = agg.runs.reduce((a, b) => a + b, 0);
  const failed7d = agg.failures.reduce((a, b) => a + b, 0);
  const runs24h = agg.runs.slice(-4).reduce((a, b) => a + b, 0);
  const prev24h = agg.runs.slice(-8, -4).reduce((a, b) => a + b, 0);
  const failed24h = agg.failures.slice(-4).reduce((a, b) => a + b, 0);
  const successRate = runs7d ? 1 - failed7d / runs7d : 1;
  const health = companyHealth(companyId);
  const issues = wfs.flatMap((w) => w.issues).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const creds = CREDENTIALS.filter((c) => c.companyId === companyId || c.usedBy.some((id) => wfs.some((w) => w.id === id)));
  const breakdown = wfs
    .slice()
    .sort((a, b) => b.stats.runs7d - a.stats.runs7d)
    .slice(0, 5)
    .map((w) => ({ id: w.id, label: w.name, color: company.color, values: w.stats.series7d }));
  const activity = ACTIVITY.filter((a) => a.companyId === companyId);
  const opportunities = issues.filter((i) => i.estSavings);
  const savings = opportunities.reduce(
    (acc, i) => ({ runs: acc.runs + (i.estSavings?.runsPerWeek ?? 0), minutes: acc.minutes + (i.estSavings?.minutesPerWeek ?? 0), euro: acc.euro + (i.estSavings?.euroPerMonth ?? 0) }),
    { runs: 0, minutes: 0, euro: 0 },
  );

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <span>{company.industry}</span>
            <span>·</span>
            <span>{company.city}</span>
            <span>·</span>
            <span>onboarded {relTime(company.onboardedAt)}</span>
          </>
        }
        title={
          <span className={s.titleRow}>
            <span className={s.heroMark} style={{ background: company.color }}>
              {company.initials}
            </span>
            <span>
              {company.name}
              <div className={s.statRow} style={{ marginTop: 6, fontWeight: 450 }}>
                <span>
                  <b>{wfs.filter((w) => w.active).length}</b> active of {all.length} workflows
                </span>
                <span>
                  <b>{members.length}</b> people
                </span>
                <span>
                  your role: <b>{myRole ? ROLE_LABEL[myRole] : 'per workflow'}</b>
                </span>
                {locked > 0 && (
                  <span>
                    <b>{locked}</b> hidden from you
                  </span>
                )}
              </div>
            </span>
          </span>
        }
        actions={
          <>
            {canManage(myRole) && (
              <Button variant="secondary" onClick={() => openShare({ kind: 'company', companyId })}>
                <Share2 /> Manage access
              </Button>
            )}
            <Button variant="primary" href={`/workflows/canvas?focus=${companyId}`}>
              <LayoutGrid /> Open on canvas
            </Button>
          </>
        }
      />

      <div className={s.kpis}>
        <KpiTile label="Executions · 24h" value={fmtCompact(runs24h)} delta={prev24h ? ((runs24h - prev24h) / prev24h) * 100 : 0} spark={agg.runs.slice(-16)} icon={<Zap />} />
        <KpiTile label="Success rate · 7d" value={fmtPct(successRate)} icon={<CheckCircle2 />} />
        <KpiTile label="Failed · 24h" value={fmtInt(failed24h)} tone="bad" spark={agg.failures.slice(-16)} icon={<TriangleAlert />} />
        <KpiTile label="Findings" value={String(issues.length)} unit={`${issues.filter((i) => i.severity === 'critical').length} breaking`} icon={<Flame />} />
        <KpiTile label="Credentials" value={String(creds.length)} unit={creds.some((c) => c.status === 'expired') ? '1 expired' : 'all valid'} icon={<KeyRound />} />
        <div className={s.kpi}>
          <div className={s.kpiLabel}>Health score</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <HealthRing score={health} size={44} stroke={4} />
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              weighted
              <br />
              by traffic
            </div>
          </div>
        </div>
      </div>

      <div className={s.grid2}>
        <div className={s.stack}>
          <Card>
            <CardHeader title="Executions" sub="Last 7 days in 6-hour buckets. Pink dots are failed runs, rings are the current bucket." icon={<Activity />} />
            <CardBody>
              <DotMatrix values={agg.runs} failures={agg.failures} breakdown={breakdown} rows={8} height={170} tone="light" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="How to improve"
              sub={opportunities.length ? 'Applying the suggested fixes would save roughly this every week.' : 'No measurable waste found. Keep an eye on the minor tips in the findings.'}
              icon={<Lightbulb />}
            />
            {opportunities.length > 0 && (
              <div className={s.savings} style={{ paddingTop: 14 }}>
                {savings.runs > 0 && (
                  <div className={s.saving}>
                    <b>{fmtCompact(savings.runs)}</b>
                    <span>fewer runs / week</span>
                  </div>
                )}
                {savings.minutes > 0 && (
                  <div className={s.saving}>
                    <b>{fmtDuration(savings.minutes * 60_000)}</b>
                    <span>compute saved / week</span>
                  </div>
                )}
                {savings.euro > 0 && (
                  <div className={s.saving}>
                    <b>{fmtEuro(savings.euro)}</b>
                    <span>API spend / month</span>
                  </div>
                )}
              </div>
            )}
            <CardBody flush>
              <div className={s.issueList}>
                {(opportunities.length ? opportunities : issues.filter((i) => i.severity !== 'critical')).slice(0, 4).map((i) => (
                  <IssueRow key={i.id} issue={i} showCompany={false} />
                ))}
              </div>
            </CardBody>
          </Card>

        </div>

        <div className={s.stack}>
          {issues.length > 0 && (
            <Card>
              <CardHeader title="Needs attention" icon={<Flame />} action={<Badge tone="danger">{issues.filter((i) => i.severity === 'critical').length} breaking</Badge>} />
              <CardBody flush>
                <div className={s.issueList}>
                  {issues.map((i) => (
                    <IssueRow key={i.id} issue={i} showCompany={false} />
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Access"
              sub="Company roles cascade to every workflow here."
              icon={<ShieldCheck />}
              action={
                canManage(myRole) ? (
                  <Button size="sm" variant="secondary" onClick={() => openShare({ kind: 'company', companyId })}>
                    <UsersRound /> Manage
                  </Button>
                ) : undefined
              }
            />
            <CardBody flush style={{ paddingBottom: 8 }}>
              {members.map((m) => (
                <div key={m.user.id} className={s.onlineRow}>
                  <Avatar user={m.user} size={28} online={m.user.online} />
                  <div className={s.onlineMeta}>
                    <div className={s.onlineName}>
                      {m.user.name}
                      {m.user.id === me.id && <span className={s.subtle} style={{ fontWeight: 450 }}> · you</span>}
                    </div>
                    <div className={s.onlineSub}>
                      {m.user.title}
                      {m.inherited ? ` · via ${scopeLabel(m.via)}` : ''}
                    </div>
                  </div>
                  <Badge tone={m.role === 'admin' ? 'dark' : 'outline'}>{ROLE_LABEL[m.role]}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Credentials in use" icon={<KeyRound />} action={<a href="/credentials" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>All credentials</a>} />
            <CardBody flush style={{ paddingBottom: 8 }}>
              {creds.map((c) => (
                <div key={c.id} className={s.onlineRow}>
                  <NodeIcon type={c.type} size={26} />
                  <div className={s.onlineMeta}>
                    <div className={s.onlineName}>{c.name}</div>
                    <div className={s.onlineSub}>
                      {c.typeLabel} · used by {c.usedBy.filter((id) => wfs.some((w) => w.id === id)).length} here
                    </div>
                  </div>
                  <Badge tone={c.status === 'valid' ? 'success' : c.status === 'expiring' ? 'warning' : 'danger'} dot>
                    {c.status === 'valid' ? 'Valid' : c.status === 'expiring' ? 'Expiring' : 'Expired'}
                  </Badge>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Online now" icon={<Clock />} />
            <CardBody flush style={{ paddingBottom: 6 }}>
              <OnlineNow companyId={companyId} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Activity" icon={<Activity />} />
            <CardBody flush>
              <ActivityFeed items={activity} limit={6} />
            </CardBody>
          </Card>
        </div>
      </div>
      <div style={{ height: 16 }} />
      <Card>
      <CardHeader title="Workflows" sub={`${wfs.length} you can see${locked ? ` · ${locked} hidden` : ''}`} icon={<LayoutGrid />} />
      <CardBody flush>
        <table className={ui.table}>
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>7 days</th>
              <th className={ui.num}>Success</th>
              <th>Health</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {wfs.map((w) => {
              const sev = worstSeverity(w);
              const role = roleForWorkflow(me.id, w, grants);
              return (
                <tr key={w.id} className="clickable" onClick={() => (window.location.href = `/workflows/canvas?focus=${w.id}`)}>
            <td>
              <div className={s.wfCell}>
                <NodeIcon type={w.trigger.nodeTypeId} size={28} />
                <div style={{ minWidth: 0 }}>
                  <div className={s.wfName}>
                    {w.name}
                    {w.shared && <span className={s.subtle} style={{ fontWeight: 450 }}> · shared</span>}
                  </div>
                  <div className={s.wfDesc}>{w.description}</div>
                </div>
              </div>
            </td>
            <td className={s.muted} style={{ whiteSpace: 'nowrap' }}>{w.trigger.label}</td>
            <td>
              <Badge tone={!w.active ? 'neutral' : w.stats.lastStatus === 'error' ? 'danger' : 'success'} dot>
                {!w.active ? 'Inactive' : w.stats.lastStatus === 'error' ? 'Failing' : w.stats.lastStatus === 'running' ? 'Running' : 'Active'}
              </Badge>
            </td>
            <td>
              <Bars data={w.stats.series7d} failures={w.stats.failures7d} width={96} height={22} />
            </td>
            <td className={ui.num} style={{ color: w.stats.successRate < 0.95 ? 'var(--danger-fg)' : undefined }}>{fmtPct(w.stats.successRate, 0)}</td>
            <td>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <HealthRing score={workflowHealth(w)} size={26} stroke={3} showLabel={false} />
                {sev && <SeverityIcon severity={sev} size={13} />}
              </span>
            </td>
            <td className={s.muted} style={{ whiteSpace: 'nowrap' }}>
              {relTime(w.updatedAt)}
              {role === 'viewer' && <span className={s.subtle}> · view only</span>}
            </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardBody>
      </Card>
    </>
  );
}
