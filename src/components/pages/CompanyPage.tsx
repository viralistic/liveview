import { useMemo } from 'react';
import { Activity, AtSign, Check, Flame, KeyRound, LayoutGrid, Lock, Mail, MessageSquare, Phone, Pin, Settings2, Share2, ShieldCheck, Sparkles, Users as UsersIcon, Video } from 'lucide-react';
import { ACTIVITY, COMPANIES, CREDENTIALS, PHASES, ROLE_LABEL, ROUTE_LABEL, SENSITIVITY_LABEL, SEVERITY_RANK, SIZE_LABEL, USERS, WORKFLOWS, phaseIndex, projectFor, type Communication } from '../../data';
import { useSession, openShare } from '../../stores/session';
import { openAsk } from '../../stores/planner';
import { openProjectSettings } from '../../stores/projects';
import { canManage, canSeeWorkflow, companyMembers, roleForCompany, scopeLabel } from '../../lib/access';
import { aggregateSeries, companyHealth, workflowHealth } from '../../lib/health';
import { fmtCompact, fmtInt, fmtPct, relTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { HealthRing } from '../ui/HealthRing';
import { NodeIcon } from '../ui/NodeIcon';
import { ProductTag } from '../ui/ProductTag';
import { SeverityIcon } from '../ui/SeverityIcon';
import { Bars } from '../ui/Sparkline';
import ui from '../ui/ui.module.css';
import { ExportMenu } from './ExportMenu';
import { ActivityFeed } from './shared';
import s from './pages.module.css';
import { productById } from '../../data';

const COMM_ICON: Record<Communication['type'], React.ReactNode> = {
  email: <Mail />,
  call: <Phone />,
  meeting: <Video />,
  visit: <Pin />,
  workshop: <Sparkles />,
  note: <MessageSquare />,
};

/** One project: where the engagement is, who owns what, and how the automations are doing. */
export function CompanyPage({ companyId }: { companyId: string }) {
  const { user: me, grants } = useSession();
  const company = COMPANIES.find((c) => c.id === companyId)!;
  const project = projectFor(companyId);
  const all = WORKFLOWS.filter((w) => w.companyId === companyId);
  const wfs = all.filter((w) => canSeeWorkflow(me.id, w, grants));
  const myRole = roleForCompany(me.id, companyId, grants);
  const members = companyMembers(companyId, grants);
  const agg = useMemo(() => aggregateSeries(wfs), [wfs]);
  const runs24h = agg.runs.slice(-4).reduce((a, b) => a + b, 0);
  const failed24h = agg.failures.slice(-4).reduce((a, b) => a + b, 0);
  const runs7d = agg.runs.reduce((a, b) => a + b, 0);
  const failed7d = agg.failures.reduce((a, b) => a + b, 0);
  const successRate = runs7d ? 1 - failed7d / runs7d : 1;
  const health = companyHealth(companyId);
  const issues = wfs.flatMap((w) => w.issues).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const critical = issues.filter((i) => i.severity === 'critical');
  const creds = CREDENTIALS.filter((c) => c.companyId === companyId);
  const activity = ACTIVITY.filter((a) => a.companyId === companyId);
  const processOwner = project ? USERS.find((u) => u.id === project.processOwnerId) : undefined;
  const techOwner = project ? USERS.find((u) => u.id === project.technicalOwnerId) : undefined;
  const contacts = project ? project.clientContactIds.map((id) => USERS.find((u) => u.id === id)!).filter(Boolean) : [];
  const currentPhase = project ? phaseIndex(project.phase) : -1;
  const comms = project ? [...project.communications].sort((a, b) => b.at.localeCompare(a.at)) : [];
  const upcoming = comms.filter((c) => new Date(c.at).getTime() > Date.now()).sort((a, b) => a.at.localeCompare(b.at));
  const past = comms.filter((c) => new Date(c.at).getTime() <= Date.now());

  return (
    <>
      <div className={s.header} style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className={s.eyebrow}>
            {company.industry} · {company.city}
            <span className={s.profileChips}>
              <span className={s.chip} title="Company size">{SIZE_LABEL[company.size]}</span>
              <span className={s.chip} title="People">{fmtInt(company.employees)} people</span>
              <span className={s.chip} title="How n8n is hosted">{ROUTE_LABEL[company.route]}</span>
              <span className={s.chip} title="Information sensitivity">
                {company.sensitivity === 'hyper' && <Lock size={10} />}
                {SENSITIVITY_LABEL[company.sensitivity]}
              </span>
            </span>
          </div>
          <h1 className={s.greeting} style={{ fontSize: 40 }}>
            {company.name}
          </h1>
          {project && (
            <div className={s.managing} style={{ marginTop: 12, fontSize: 'var(--fs-md)' }}>
              <span>
                In <b style={{ color: 'var(--text)', fontWeight: 500 }}>{PHASES[currentPhase]?.label}</b> since {relTime(project.phaseSince)}.
              </span>
              <span>{project.phaseNote}</span>
            </div>
          )}
        </div>
        <div className={s.actions}>
          <Button variant="secondary" onClick={() => openProjectSettings(companyId)} aria-label="Project settings" title="Project settings" icon>
            <Settings2 />
          </Button>
          {canManage(myRole) && (
            <Button variant="secondary" onClick={() => openShare({ kind: 'company', companyId })}>
              <Share2 /> Access
            </Button>
          )}
          <Button variant="primary" href={`/workflows/canvas?focus=${companyId}`}>
            <LayoutGrid /> Open on canvas
          </Button>
          <ExportMenu scope={{ kind: 'company', companyId }} />
        </div>
      </div>

      {project && (
        <div className={s.roadmap} aria-label="Project trajectory">
          {PHASES.map((p, i) => {
            const state = i < currentPhase ? 'done' : i === currentPhase ? 'current' : 'todo';
            return (
              <div key={p.id} className={s.phase} data-state={state} title={p.description}>
                <span className={s.phaseDot}>{state === 'done' ? <Check /> : i + 1}</span>
                <span className={s.phaseLabel}>{p.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className={s.kpisMin}>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>Runs today</div>
          <div className={s.kpiMinValue}>{fmtCompact(runs24h)}</div>
          <div className={s.hoverCard}>
            <b>{fmtInt(runs7d)}</b> this week
          </div>
        </div>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>Success</div>
          <div className={s.kpiMinValue}>{fmtPct(successRate, 1)}</div>
          <div className={s.hoverCard}>
            <b>{fmtInt(failed7d)}</b> failed this week
          </div>
        </div>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>Failed today</div>
          <div className={s.kpiMinValue} style={{ color: failed24h ? 'var(--accent)' : undefined }}>{fmtInt(failed24h)}</div>
          <div className={s.hoverCard}>{critical.length ? <b>{critical[0]!.action}</b> : 'Nothing is breaking'}</div>
        </div>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>Workflows</div>
          <div className={s.kpiMinValue}>{wfs.length}</div>
          <div className={s.hoverCard}>
            <b>{wfs.filter((w) => w.active).length}</b> active · <b>{all.length - wfs.length}</b> hidden from you
          </div>
        </div>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>Health</div>
          <div className={s.kpiMinValue}>
            <HealthRing score={health} size={34} stroke={3.5} showLabel={false} />
            {health}
          </div>
          <div className={s.hoverCard}>
            <b>{issues.length}</b> findings · <b>{critical.length}</b> breaking
          </div>
        </div>
      </div>

      <div className={s.grid2}>
        <div className={s.stack}>
          {issues.length > 0 && (
            <Card>
              <CardHeader title="Needs attention" icon={<Flame />} action={critical.length ? <span className={s.companyCritical}>{critical.length} breaking</span> : undefined} />
              <CardBody flush>
                {issues.slice(0, 4).map((i) => {
                  const wf = WORKFLOWS.find((w) => w.id === i.workflowId)!;
                  return (
                    <div key={i.id} className={s.actionRow}>
                      <SeverityIcon severity={i.severity} size={13} filled />
                      <div className={s.actionMeta}>
                        <div className={s.actionTitle}>{i.action}</div>
                        <div className={s.actionSub}>
                          {wf.name} · {i.impact}
                        </div>
                      </div>
                      <Button size="sm" variant={i.severity === 'critical' ? 'primary' : 'secondary'} href={`/workflows/canvas?focus=${wf.id}`}>
                        {i.severity === 'critical' ? 'Fix' : 'Open'}
                      </Button>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Workflows" icon={<LayoutGrid />} />
            <CardBody flush>
              <div className={s.tableWrap}>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>Workflow</th>
                      <th>Status</th>
                      <th>7 days</th>
                      <th className={ui.num}>Success</th>
                      <th>Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wfs.map((w) => {
                      const product = w.productId ? productById(w.productId) : undefined;
                      return (
                        <tr key={w.id} className="clickable" onClick={() => (window.location.href = `/workflows/canvas?focus=${w.id}`)}>
                          <td>
                            <div className={s.wfCell}>
                              <NodeIcon type={w.trigger.nodeTypeId} size={28} />
                              <div style={{ minWidth: 0 }}>
                                <div className={s.wfName}>{w.name}</div>
                                <div className={s.wfDesc} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  {w.trigger.label}
                                  {product && <ProductTag name={product.name} slug={product.slug} size="sm" />}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge tone={!w.active ? 'neutral' : w.stats.lastStatus === 'error' ? 'danger' : 'success'} dot>
                              {!w.active ? 'Inactive' : w.stats.lastStatus === 'error' ? 'Failing' : w.stats.lastStatus === 'running' ? 'Running' : 'Active'}
                            </Badge>
                          </td>
                          <td>
                            <Bars data={w.stats.series7d} failures={w.stats.failures7d} width={96} height={22} color="var(--track-strong)" failColor="var(--accent)" />
                          </td>
                          <td className={ui.num} style={{ color: w.stats.successRate < 0.95 ? 'var(--accent)' : undefined }}>{fmtPct(w.stats.successRate, 0)}</td>
                          <td>
                            <HealthRing score={workflowHealth(w)} size={26} stroke={3} showLabel={false} checkWhenHealthy={!w.issues.some((i) => i.severity === 'critical')} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Activity" icon={<Activity />} />
            <CardBody flush>
              <ActivityFeed items={activity} limit={5} />
            </CardBody>
          </Card>
        </div>

        <div className={s.stack}>
          {project && (
            <Card>
              <CardHeader title="Who to ask" />
              <CardBody flush style={{ paddingBottom: 8 }}>
                {processOwner && (
                  <div className={s.onlineRow}>
                    <Avatar user={processOwner} size={32} online={processOwner.online} />
                    <div className={s.onlineMeta}>
                      <div className={s.onlineName}>{processOwner.name}</div>
                      <div className={s.onlineSub}>Process owner</div>
                    </div>
                    <Button size="sm" variant="ghost" icon aria-label={`Ask ${processOwner.name}`} onClick={() => openAsk({ companyId, assigneeId: processOwner.id })}>
                      <AtSign />
                    </Button>
                  </div>
                )}
                {techOwner && (
                  <div className={s.onlineRow}>
                    <Avatar user={techOwner} size={32} online={techOwner.online} />
                    <div className={s.onlineMeta}>
                      <div className={s.onlineName}>{techOwner.name}</div>
                      <div className={s.onlineSub}>Technical owner</div>
                    </div>
                    <Button size="sm" variant="ghost" icon aria-label={`Ask ${techOwner.name}`} onClick={() => openAsk({ companyId, assigneeId: techOwner.id })}>
                      <AtSign />
                    </Button>
                  </div>
                )}
                {contacts.map((u) => (
                  <div key={u.id} className={s.onlineRow}>
                    <Avatar user={u} size={32} online={u.online} />
                    <div className={s.onlineMeta}>
                      <div className={s.onlineName}>{u.name}</div>
                      <div className={s.onlineSub}>Client · {u.title}</div>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {project && (
            <Card>
              <CardHeader title="What the client wants" />
              <CardBody>
                <ul className={s.wants}>
                  {project.wants.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <div className={s.kpiLabel} style={{ marginTop: 14, marginBottom: 6 }}>
                  Needs
                </div>
                <ul className={s.wants} data-muted="true">
                  {project.needs.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <div className={s.nextStep}>
                  <span>Next</span>
                  <b>{project.nextStep.title}</b>
                  <span>
                    {relTime(project.nextStep.at).replace(' ago', '')} · {USERS.find((u) => u.id === project.nextStep.ownerId)?.name.split(' ')[0]}
                  </span>
                </div>
              </CardBody>
            </Card>
          )}

          {project && (
            <Card>
              <CardHeader title="Communication" action={<a href="/planner" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Planner</a>} />
              <CardBody flush style={{ paddingBottom: 6 }}>
                {upcoming.map((c) => (
                  <CommRow key={c.id} c={c} upcoming />
                ))}
                {past.slice(0, 5).map((c) => (
                  <CommRow key={c.id} c={c} />
                ))}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="People" icon={<ShieldCheck />} action={canManage(myRole) ? <Button size="sm" variant="ghost" onClick={() => openShare({ kind: 'company', companyId })}><UsersIcon /> Manage</Button> : undefined} />
            <CardBody flush style={{ paddingBottom: 8 }}>
              {members.map((m) => (
                <div key={m.user.id} className={s.onlineRow}>
                  <Avatar user={m.user} size={28} online={m.user.online} />
                  <div className={s.onlineMeta}>
                    <div className={s.onlineName}>{m.user.name}</div>
                    <div className={s.onlineSub}>{m.inherited ? `via ${scopeLabel(m.via)}` : m.user.title}</div>
                  </div>
                  <Badge tone={m.role === 'admin' ? 'dark' : 'outline'}>{ROLE_LABEL[m.role]}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Credentials" icon={<KeyRound />} action={<a href="/credentials" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>All</a>} />
            <CardBody flush style={{ paddingBottom: 8 }}>
              {creds.map((c) => (
                <div key={c.id} className={s.onlineRow}>
                  <NodeIcon type={c.type} size={26} />
                  <div className={s.onlineMeta}>
                    <div className={s.onlineName}>{c.name}</div>
                  </div>
                  <Badge tone={c.status === 'valid' ? 'success' : c.status === 'expiring' ? 'warning' : 'danger'} dot>
                    {c.status === 'valid' ? 'Valid' : c.status === 'expiring' ? 'Expiring' : 'Expired'}
                  </Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function CommRow({ c, upcoming }: { c: Communication; upcoming?: boolean }) {
  const people = c.participantIds.map((id) => USERS.find((u) => u.id === id)!).filter(Boolean);
  return (
    <div className={s.commRow} data-upcoming={upcoming}>
      <span className={s.commIcon}>{COMM_ICON[c.type]}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className={s.onlineName}>
          {c.title}
          {upcoming && <span className={s.commSoon}>upcoming</span>}
        </div>
        <div className={s.onlineSub} style={{ whiteSpace: 'normal' }}>
          {c.summary}
        </div>
        <div className={s.commMeta}>
          {new Date(c.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {people.map((p) => p.name.split(' ')[0]).join(', ')}
          {c.phase ? ` · ${PHASES.find((p) => p.id === c.phase)?.label}` : ''}
        </div>
      </div>
    </div>
  );
}
