import { useMemo } from 'react';
import { Activity, CheckCircle2, Clock, Flame, Gauge, LayoutGrid, Lightbulb, Sparkles, TriangleAlert, Zap } from 'lucide-react';
import { COMPANIES, SEVERITY_RANK, type Issue } from '../../data';
import { useSession } from '../../stores/session';
import { aggregateSeries, orgHealth } from '../../lib/health';
import { fmtCompact, fmtDuration, fmtEuro, fmtInt, fmtPct, greeting, NOW } from '../../lib/format';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader, CardFooter } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { HealthRing } from '../ui/HealthRing';
import { ExecutionsChart, ChartLegend } from './charts/ExecutionsChart';
import { ActivityFeed, CompanyCard, IssueRow, KpiTile, OnlineNow, PageHeader } from './shared';
import s from './pages.module.css';

export function OverviewPage() {
  const { user: me } = useSession();
  const { visibleWorkflows: wfs } = useSession();
  const { visibleCompanies: companies } = useSession();

  const agg = useMemo(() => aggregateSeries(wfs), [wfs]);
  const runs24h = agg.runs.slice(-4).reduce((a, b) => a + b, 0);
  const runsPrev24h = agg.runs.slice(-8, -4).reduce((a, b) => a + b, 0);
  const failed24h = agg.failures.slice(-4).reduce((a, b) => a + b, 0);
  const failedPrev = agg.failures.slice(-8, -4).reduce((a, b) => a + b, 0);
  const runs7d = agg.runs.reduce((a, b) => a + b, 0);
  const failed7d = agg.failures.reduce((a, b) => a + b, 0);
  const successRate = runs7d ? 1 - failed7d / runs7d : 1;
  const active = wfs.filter((w) => w.active);
  const avgDuration = active.length ? active.reduce((a, w) => a + w.stats.avgDurationMs * Math.max(1, w.stats.runs7d), 0) / Math.max(1, active.reduce((a, w) => a + Math.max(1, w.stats.runs7d), 0)) : 0;
  const health = orgHealth();
  const issues = useMemo(() => wfs.flatMap((w) => w.issues).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.detectedAt.localeCompare(a.detectedAt)), [wfs]);
  const critical = issues.filter((i) => i.severity === 'critical');
  const opportunities = issues.filter((i) => i.estSavings);
  const savings = opportunities.reduce(
    (acc, i) => ({ runs: acc.runs + (i.estSavings?.runsPerWeek ?? 0), minutes: acc.minutes + (i.estSavings?.minutesPerWeek ?? 0), euro: acc.euro + (i.estSavings?.euroPerMonth ?? 0) }),
    { runs: 0, minutes: 0, euro: 0 },
  );

  const series = companies.map((c) => ({ id: c.id, label: c.shortName, color: c.color, values: aggregateSeries(wfs.filter((w) => w.companyId === c.id)).runs }));
  const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
  const failingCompanies = COMPANIES.filter((c) => critical.some((i) => wfs.find((w) => w.id === i.workflowId)?.companyId === c.id));

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <span>{NOW.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <span>·</span>
            <span>{wfs.length} workflows across {companies.length} {companies.length === 1 ? 'company' : 'companies'}</span>
          </>
        }
        title={
          <>
            {greeting()}, {me.name.split(' ')[0]}
          </>
        }
        lede={
          critical.length ? (
            <>
              <b>{critical.length} breaking {critical.length === 1 ? 'issue' : 'issues'}</b> at {failingCompanies.map((c) => c.shortName).join(' and ')} need you first. Everything else is running: {fmtInt(runs24h)} executions in the last 24 hours at {fmtPct(successRate)} success.
            </>
          ) : (
            <>
              All clear. {fmtInt(runs24h)} executions in the last 24 hours at {fmtPct(successRate)} success, {opportunities.length} ideas to make things cheaper.
            </>
          )
        }
        actions={
          <>
            <Button href="/workflows/graph" variant="secondary">
              <Activity /> Graph
            </Button>
            <Button href="/workflows/canvas" variant="primary">
              <LayoutGrid /> Open canvas
            </Button>
          </>
        }
      />

      <div className={s.kpis}>
        <KpiTile label="Executions · 24h" value={fmtCompact(runs24h)} delta={pct(runs24h, runsPrev24h)} spark={agg.runs.slice(-16)} icon={<Zap />} />
        <KpiTile label="Success rate · 7d" value={fmtPct(successRate)} delta={-(failed7d / Math.max(1, runs7d)) * 100 * 0.4} icon={<CheckCircle2 />} />
        <KpiTile label="Failed · 24h" value={fmtInt(failed24h)} delta={failed24h - failedPrev} deltaText={`${failed24h - failedPrev > 0 ? '+' : ''}${fmtInt(failed24h - failedPrev)}`} tone="bad" spark={agg.failures.slice(-16)} icon={<TriangleAlert />} />
        <KpiTile label="Avg duration" value={fmtDuration(avgDuration)} delta={-3.2} tone="bad" icon={<Clock />} />
        <KpiTile label="Active workflows" value={String(active.length)} unit={`of ${wfs.length}`} sub={`${wfs.length - active.length} inactive`} icon={<Activity />} />
        <div className={s.kpi}>
          <div className={s.kpiLabel}>
            <Gauge /> Instance health
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <HealthRing score={health} size={44} stroke={4} />
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {issues.length} findings
              <br />
              {critical.length} breaking
            </div>
          </div>
        </div>
      </div>

      <div className={s.grid2}>
        <div className={s.stack}>
          <Card>
            <CardHeader title="Executions" sub="Last 7 days in 6-hour buckets, stacked by company. Red dots mark buckets with failed runs." icon={<Activity />} action={<ChartLegend series={series} />} />
            <CardBody>
              <ExecutionsChart series={series} failures={agg.failures} height={230} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Companies" sub="Everything you have access to. Pin the ones you work on most." icon={<LayoutGrid />} />
            <CardBody>
              <div className={s.companies}>
                {companies.map((c) => (
                  <CompanyCard key={c.id} company={c} />
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent activity" icon={<Clock />} />
            <CardBody flush>
              <ActivityFeed limit={7} />
            </CardBody>
          </Card>
        </div>

        <div className={s.stack}>
          <Card>
            <CardHeader
              title="Needs attention"
              sub="Sorted by severity. The canvas shows the same findings as a heatmap."
              icon={<Flame />}
              action={
                <span style={{ display: 'flex', gap: 4 }}>
                  <Badge tone="danger">{critical.length} breaking</Badge>
                  <Badge tone="warning">{issues.filter((i) => i.severity === 'inefficient').length} inefficient</Badge>
                </span>
              }
            />
            <CardBody flush>
              <div className={s.issueList}>
                {issues.slice(0, 7).map((i) => (
                  <IssueRow key={i.id} issue={i} />
                ))}
              </div>
            </CardBody>
            {issues.length > 7 && (
              <CardFooter>
                <span>{issues.length - 7} more findings</span>
                <a href="/workflows/canvas" style={{ color: 'var(--text)', fontWeight: 500 }}>
                  See all on the canvas
                </a>
              </CardFooter>
            )}
          </Card>

          <Card>
            <CardHeader title="Improvement opportunities" sub="What you would save by applying the suggested fixes." icon={<Lightbulb />} />
            <div className={s.savings} style={{ paddingTop: 14 }}>
              <div className={s.saving}>
                <b>{fmtCompact(savings.runs)}</b>
                <span>fewer runs / week</span>
              </div>
              <div className={s.saving}>
                <b>{fmtDuration(savings.minutes * 60_000)}</b>
                <span>compute saved / week</span>
              </div>
              <div className={s.saving}>
                <b>{fmtEuro(savings.euro)}</b>
                <span>API spend / month</span>
              </div>
            </div>
            <CardBody flush>
              <div className={s.issueList}>
                {opportunities.slice(0, 4).map((i: Issue) => (
                  <IssueRow key={i.id} issue={i} />
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Online now" sub="Everyone currently in LiveView. Their cursor colour follows them onto the canvas." icon={<Sparkles />} />
            <CardBody flush style={{ paddingBottom: 6 }}>
              <OnlineNow />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
