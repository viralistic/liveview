import { useMemo } from 'react';
import { Focus } from 'lucide-react';
import { COMPANIES, SEVERITY_RANK, WORKFLOWS } from '../../data';
import { useSession } from '../../stores/session';
import { fmtCompact, fmtDuration, fmtEuro } from '../../lib/format';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { SeverityIcon } from '../ui/SeverityIcon';
import { PageHeader } from './shared';
import s from './pages.module.css';

/** Everything that would make the workflows cheaper, faster or safer, biggest win first. */
export function ImprovementsPage() {
  const { visibleWorkflows: wfs } = useSession();
  const issues = useMemo(
    () =>
      wfs
        .flatMap((w) => w.issues)
        .filter((i) => i.severity !== 'critical')
        .sort((a, b) => (b.estSavings?.minutesPerWeek ?? 0) + (b.estSavings?.euroPerMonth ?? 0) * 10 - ((a.estSavings?.minutesPerWeek ?? 0) + (a.estSavings?.euroPerMonth ?? 0) * 10) || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]),
    [wfs],
  );
  const savings = issues.reduce(
    (acc, i) => ({ runs: acc.runs + (i.estSavings?.runsPerWeek ?? 0), minutes: acc.minutes + (i.estSavings?.minutesPerWeek ?? 0), euro: acc.euro + (i.estSavings?.euroPerMonth ?? 0) }),
    { runs: 0, minutes: 0, euro: 0 },
  );
  return (
    <>
      <PageHeader title="Improvements" lede={<>Applying everything below would save roughly this every week.</>} />
      <div className={s.kpisMin} style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 0 }}>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>Fewer runs</div>
          <div className={s.kpiMinValue}>{fmtCompact(savings.runs)}</div>
        </div>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>Compute saved</div>
          <div className={s.kpiMinValue}>{fmtDuration(savings.minutes * 60_000)}</div>
        </div>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>API spend, per month</div>
          <div className={s.kpiMinValue}>{fmtEuro(savings.euro)}</div>
        </div>
      </div>
      <Card>
        <CardHeader title={`${issues.length} opportunities`} />
        <CardBody flush>
          {issues.map((i) => {
            const wf = WORKFLOWS.find((w) => w.id === i.workflowId)!;
            const company = COMPANIES.find((c) => c.id === wf.companyId)!;
            return (
              <div key={i.id} className={s.actionRow}>
                <SeverityIcon severity={i.severity} size={13} filled />
                <div className={s.actionMeta}>
                  <div className={s.actionTitle}>{i.action}</div>
                  <div className={s.actionSub}>
                    {company.shortName} · {wf.name} · {i.impact}
                  </div>
                </div>
                {i.estSavings && (
                  <div style={{ textAlign: 'right', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {i.estSavings.minutesPerWeek ? <div>{fmtDuration(i.estSavings.minutesPerWeek * 60_000)} / week</div> : null}
                    {i.estSavings.euroPerMonth ? <div>{fmtEuro(i.estSavings.euroPerMonth)} / month</div> : null}
                    {i.estSavings.runsPerWeek && !i.estSavings.minutesPerWeek ? <div>{fmtCompact(i.estSavings.runsPerWeek)} runs / week</div> : null}
                  </div>
                )}
                <Button size="sm" variant="secondary" href={`/workflows/canvas?focus=${wf.id}`}>
                  <Focus /> Open
                </Button>
              </div>
            );
          })}
          {issues.length === 0 && <div className={s.calm}>Nothing to improve. Nice.</div>}
        </CardBody>
      </Card>
    </>
  );
}
