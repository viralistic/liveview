import { useMemo } from 'react';
import { Activity, ArrowRight, CalendarCheck, Check, Clock, Flame, Lightbulb, LayoutGrid, Focus } from 'lucide-react';
import { COMPANIES, SEVERITY_RANK, USERS, WORKFLOWS, type Issue } from '../../data';
import { useSession, useStore } from '../../stores/session';
import { $tasks } from '../../stores/planner';
import { latestSignal, useSignals } from '../../stores/signals';
import { aggregateSeries, companyHealth, orgHealth } from '../../lib/health';
import { companyMembers } from '../../lib/access';
import { fmtCompact, fmtDuration, fmtEuro, fmtInt, fmtPct, greeting, NOW } from '../../lib/format';
import { companyShort, upcomingFor, whenLabel } from '../../lib/today';
import { ComeBack } from '../ui/ComeBack';
import { Button } from '../ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '../ui/Card';
import { HealthRing } from '../ui/HealthRing';
import { Avatar, AvatarGroup } from '../ui/Avatar';
import { SeverityIcon } from '../ui/SeverityIcon';
import { ExportMenu } from './ExportMenu';
import { ActivityFeed } from './shared';
import s from './pages.module.css';

const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** Scroll to a section on this page instead of jumping. */
function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** The overview: who you are, what needs you today, five numbers. Everything else is one scroll down. */
export function OverviewPage() {
  const { user: me, grants, visibleWorkflows: wfs, visibleCompanies: companies } = useSession();
  const tasks = useStore($tasks);
  const agg = useMemo(() => aggregateSeries(wfs), [wfs]);
  const runs24h = agg.runs.slice(-4).reduce((a, b) => a + b, 0);
  const failed24h = agg.failures.slice(-4).reduce((a, b) => a + b, 0);
  const runs7d = agg.runs.reduce((a, b) => a + b, 0);
  const failed7d = agg.failures.reduce((a, b) => a + b, 0);
  const successRate = runs7d ? 1 - failed7d / runs7d : 1;
  const active = wfs.filter((w) => w.active);
  const health = orgHealth();
  const issues = useMemo(() => wfs.flatMap((w) => w.issues).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.detectedAt.localeCompare(a.detectedAt)), [wfs]);
  const critical = issues.filter((i) => i.severity === 'critical');
  const opportunities = issues.filter((i) => i.estSavings);
  const main = opportunities[0];
  const savings = opportunities.reduce(
    (acc, i) => ({ runs: acc.runs + (i.estSavings?.runsPerWeek ?? 0), minutes: acc.minutes + (i.estSavings?.minutesPerWeek ?? 0), euro: acc.euro + (i.estSavings?.euroPerMonth ?? 0) }),
    { runs: 0, minutes: 0, euro: 0 },
  );
  const upcoming = useMemo(() => upcomingFor(companies.map((c) => c.id), tasks, me.id, 10).slice(0, 3), [companies, tasks, me.id]);

  return (
    <>
      <div className={s.header} style={{ alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className={s.eyebrow}>{NOW.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className={s.greeting}>
            {greeting()}, {me.name.split(' ')[0]}
          </h1>
          <p className={s.intro}>Your personal overview: how everything you are responsible for in n8n is doing, in one flash.</p>
          <div className={s.managing}>
            <span>You are managing</span>
            <a href="/workflows/canvas" className={s.pillLink}>
              {wfs.length} workflows <ArrowRight />
            </a>
            <span>across</span>
            <a href="/companies" className={s.pillLink}>
              {companies.length} {companies.length === 1 ? 'company' : 'companies'} <ArrowRight />
            </a>
          </div>
        </div>
        <div className={s.actions}>
          <Button href="/workflows/canvas" variant="primary">
            <LayoutGrid /> Open canvas
          </Button>
          <Button href="/workflows/graph" variant="secondary">
            <Activity /> Graph
          </Button>
          <ExportMenu scope={{ kind: 'org' }} />
        </div>
      </div>

      {/* today, in one sentence */}
      <div className={s.today}>
        <span className={s.todayIcon} data-tone={critical.length ? 'critical' : 'calm'}>
          {critical.length ? <Flame /> : <Check />}
        </span>
        <span>
          {critical.length ? (
            <>
              <b>
                {critical.length} {critical.length === 1 ? 'thing needs' : 'things need'} you today:
              </b>{' '}
              {critical.map((i, idx) => {
                const wf = WORKFLOWS.find((w) => w.id === i.workflowId);
                return (
                  <span key={i.id}>
                    {idx > 0 && (idx === critical.length - 1 ? ' and ' : ', ')}
                    <a href={`/workflows/canvas?focus=${i.workflowId}`}>{lower(i.action)}</a> ({companyShort(wf?.companyId)})
                  </span>
                );
              })}
              .
            </>
          ) : (
            <b>No critical actions today.</b>
          )}
          <ComeBack items={upcoming} />
        </span>
      </div>

      <div className={s.kpisMin}>
        <a href="#activity" className={[s.kpiMin, s.tileLink].join(' ')} onClick={(e) => jump(e, 'activity')}>
          <div className={s.kpiLabel}>Runs today</div>
          <div className={s.kpiMinValue}>{fmtCompact(runs24h)}</div>
          <div className={s.hoverCard}>
            <b>{fmtInt(runs7d)}</b> runs in 7 days · <b>{fmtInt(active.reduce((a, w) => a + w.stats.runs24h, 0))}</b> today
          </div>
        </a>
        <a href="#attention" className={[s.kpiMin, s.tileLink].join(' ')} onClick={(e) => jump(e, 'attention')}>
          <div className={s.kpiLabel}>Success</div>
          <div className={s.kpiMinValue}>{fmtPct(successRate, 1)}</div>
          <div className={s.hoverCard}>
            <b>{fmtInt(failed7d)}</b> failed of <b>{fmtInt(runs7d)}</b> runs this week
          </div>
        </a>
        <a href="#attention" className={[s.kpiMin, s.tileLink].join(' ')} onClick={(e) => jump(e, 'attention')}>
          <div className={s.kpiLabel}>Failed today</div>
          <div className={s.kpiMinValue} style={{ color: failed24h ? 'var(--accent)' : undefined }}>{fmtInt(failed24h)}</div>
          <div className={s.hoverCard}>
            {critical.length ? (
              <>
                Mostly <b>{WORKFLOWS.find((w) => w.id === critical[0]!.workflowId)?.name}</b>
              </>
            ) : (
              <>Nothing is breaking</>
            )}
          </div>
        </a>
        <a href="#companies" className={[s.kpiMin, s.tileLink].join(' ')} onClick={(e) => jump(e, 'companies')}>
          <div className={s.kpiLabel}>Workflows</div>
          <div className={s.kpiMinValue}>{wfs.length}</div>
          <div className={s.hoverCard}>
            <b>{active.length}</b> active · <b>{wfs.length - active.length}</b> inactive · <b>{wfs.filter((w) => w.productId).length}</b> from products
          </div>
        </a>
        <a href="#improve" className={[s.kpiMin, s.tileLink].join(' ')} onClick={(e) => jump(e, 'improve')}>
          <div className={s.kpiLabel}>Health</div>
          <div className={s.kpiMinValue}>
            <HealthRing score={health} size={34} stroke={3.5} showLabel={false} />
            {health}
          </div>
          <div className={s.hoverCard}>
            <b>{issues.length}</b> findings · <b>{critical.length}</b> breaking · avg run {fmtDuration(active.reduce((a, w) => a + w.stats.avgDurationMs, 0) / Math.max(1, active.length))}
          </div>
        </a>
      </div>

      <div className={s.grid2}>
        <div className={s.stack}>
          <Card id="attention" className={s.section}>
            <CardHeader title="Needs attention" action={critical.length ? <span className={s.companyCritical}>{critical.length} breaking</span> : undefined} />
            <CardBody flush>
              {issues.length === 0 ? (
                <div className={s.calm}>
                  <Check /> Nothing needs you right now.
                </div>
              ) : (
                issues.slice(0, 5).map((i) => <ActionRow key={i.id} issue={i} />)
              )}
            </CardBody>
            {issues.length > 5 && (
              <CardFooter>
                <span>{issues.length - 5} more</span>
                <a href="/improvements" style={{ color: 'var(--text)', fontWeight: 500 }}>
                  See all
                </a>
              </CardFooter>
            )}
          </Card>

          <Card id="activity" className={s.section}>
            <CardHeader title="Recent activity" icon={<Clock />} />
            <CardBody flush>
              <ActivityFeed limit={6} />
            </CardBody>
          </Card>
        </div>

        <div className={s.stack}>
          <Card id="companies" className={s.section}>
            <CardHeader title="Companies" />
            <CardBody flush>
              <div className={s.companyRows}>
                {companies.map((c) => {
                  const cWfs = wfs.filter((w) => w.companyId === c.id);
                  const cCritical = cWfs.flatMap((w) => w.issues).filter((i) => i.severity === 'critical').length;
                  const score = companyHealth(c.id);
                  const members = companyMembers(c.id, grants);
                  const cAgg = aggregateSeries(cWfs);
                  const runs = cAgg.runs.reduce((a, b) => a + b, 0);
                  const failed = cAgg.failures.reduce((a, b) => a + b, 0);
                  return (
                    <div key={c.id} className={s.companyRow}>
                      <a href={`/companies/${c.slug}`} className={s.companyRowName}>
                        {c.name}
                      </a>
                      {cCritical > 0 && <span className={s.companyCritical}>{cCritical} breaking</span>}
                      <HealthRing score={cCritical ? Math.min(score, 69) : score} size={28} stroke={3} showLabel={false} checkWhenHealthy={cCritical === 0} />
                      <div className={s.hoverCard}>
                        <b>{cWfs.length}</b> workflows · <b>{fmtCompact(runs)}</b> runs · <b>{fmtInt(failed)}</b> failed · <b>{members.length}</b> people · health <b>{score}</b>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {upcoming.length > 0 && (
            <Card id="upcoming" className={s.section}>
              <CardHeader title="Coming up" icon={<CalendarCheck />} action={<a href="/planner" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Planner</a>} />
              <CardBody flush>
                {upcoming.map((u) => (
                  <div key={u.title + u.at} className={s.actionRow}>
                    <div className={s.actionMeta}>
                      <div className={s.actionTitle}>{u.title}</div>
                      <div className={s.actionSub}>
                        {whenLabel(u.at)}
                        {u.companyId ? ` · ${companyShort(u.companyId)}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <Card id="improve" className={s.section}>
            <CardHeader title="Improve" icon={<Lightbulb />} action={<a href="/improvements" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>More</a>} />
            <CardBody>
              {main ? (
                <>
                  <div className={s.actionTitle}>{main.action}</div>
                  <div className={s.actionSub}>
                    {COMPANIES.find((c) => c.id === WORKFLOWS.find((w) => w.id === main.workflowId)?.companyId)?.shortName} · {WORKFLOWS.find((w) => w.id === main.workflowId)?.name}
                  </div>
                  <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
                    {savings.runs > 0 && (
                      <div>
                        <div className={s.savingBig}>{fmtCompact(savings.runs)}</div>
                        <div className={s.kpiLabel}>fewer runs / week</div>
                      </div>
                    )}
                    {savings.minutes > 0 && (
                      <div>
                        <div className={s.savingBig}>{fmtDuration(savings.minutes * 60_000)}</div>
                        <div className={s.kpiLabel}>saved / week</div>
                      </div>
                    )}
                    {savings.euro > 0 && (
                      <div>
                        <div className={s.savingBig}>{fmtEuro(savings.euro)}</div>
                        <div className={s.kpiLabel}>/ month</div>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <Button size="sm" variant="secondary" href={`/workflows/canvas?focus=${main.workflowId}`}>
                      <Focus /> Open
                    </Button>
                  </div>
                </>
              ) : (
                <div className={s.muted}>Nothing to improve right now.</div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="People" />
            <CardBody>
              <AvatarGroup users={companies.flatMap((c) => companyMembers(c.id, grants).map((m) => m.user)).filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i)} size={30} max={8} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function ActionRow({ issue }: { issue: Issue }) {
  const wf = WORKFLOWS.find((w) => w.id === issue.workflowId)!;
  const company = COMPANIES.find((c) => c.id === wf.companyId)!;
  // n8n may have signalled this finding to the partner (stores/signals.ts)
  const signals = useSignals();
  const signal = latestSignal(issue.id, signals);
  const signalledBy = signal ? USERS.find((u) => u.id === signal.byId) : undefined;
  return (
    <div className={s.actionRow}>
      <SeverityIcon severity={issue.severity} size={13} filled />
      <div className={s.actionMeta}>
        <div className={s.actionTitle}>{issue.action}</div>
        <div className={s.actionSub}>
          {company.shortName} · {wf.name} · {issue.impact}
        </div>
        {signal && signalledBy && (
          <div className={s.actionSub} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }} title={signal.note}>
            <span className={s.chip} style={{ paddingLeft: 3, flex: 'none' }}>
              <Avatar user={signalledBy} size={14} /> n8n signalled
            </span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{signal.note}</span>
          </div>
        )}
      </div>
      <Button size="sm" variant={issue.severity === 'critical' ? 'primary' : 'secondary'} href={`/workflows/canvas?focus=${wf.id}`}>
        {issue.severity === 'critical' ? 'Fix' : 'Open'}
      </Button>
    </div>
  );
}
