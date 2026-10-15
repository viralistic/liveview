import { ArrowUpRight, Check, Focus, Plus, Settings2 } from 'lucide-react';
import { ROUTE_LABEL, SIZE_LABEL } from '../../data';
import { $newProjects, openNewProject, openProjectSettings } from '../../stores/projects';
import { useStore } from '../../stores/session';
import { useSession } from '../../stores/session';
import { aggregateSeries, companyHealth } from '../../lib/health';
import { companyMembers } from '../../lib/access';
import { fmtCompact, fmtInt } from '../../lib/format';
import { AvatarGroup } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card, CardBody } from '../ui/Card';
import { HealthRing } from '../ui/HealthRing';
import { PageHeader } from './shared';
import s from './pages.module.css';

/** The companies you manage. Quiet unless something is breaking. */
export function CompaniesPage() {
  const { grants, visibleWorkflows: wfs, visibleCompanies: companies, can } = useSession();
  const newProjects = useStore($newProjects);
  return (
    <>
      <PageHeader
        title="Companies"
        lede={<>{companies.length} you manage. Open one for its own dashboard, or jump straight to its section on the canvas.</>}
        actions={
          can('manage-access') ? (
            <Button variant="primary" onClick={openNewProject}>
              <Plus /> New project
            </Button>
          ) : undefined
        }
      />
      <Card>
        <CardBody flush>
          <div className={s.companyRows}>
            {companies.map((c) => {
              const cWfs = wfs.filter((w) => w.companyId === c.id);
              const cCritical = cWfs.flatMap((w) => w.issues).filter((i) => i.severity === 'critical').length;
              const score = companyHealth(c.id);
              const members = companyMembers(c.id, grants);
              const agg = aggregateSeries(cWfs);
              const runs = agg.runs.reduce((a, b) => a + b, 0);
              const failed = agg.failures.reduce((a, b) => a + b, 0);
              return (
                <div key={c.id} className={s.companyRow} style={{ padding: '18px 20px' }}>
                  <HealthRing score={cCritical ? Math.min(score, 69) : score} size={32} stroke={3} showLabel={false} checkWhenHealthy={cCritical === 0} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={`/companies/${c.slug}`} className={s.companyRowName} style={{ fontSize: 'var(--fs-lg)' }}>
                      {c.name}
                    </a>
                    <div className={s.actionSub}>
                      {SIZE_LABEL[c.size]} · {fmtInt(c.employees)} people · {ROUTE_LABEL[c.route]} · {cWfs.length} workflows · {fmtCompact(runs)} runs this week{failed ? ` · ${fmtInt(failed)} failed` : ''}
                      {cCritical > 0 && (
                        <>
                          {' · '}
                          <span className={s.companyCritical}>{cCritical} breaking</span>
                        </>
                      )}
                      {cCritical === 0 && score >= 90 && (
                        <>
                          {' · '}
                          <span style={{ color: 'var(--health-full)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Check size={12} /> all good
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <AvatarGroup users={members.map((m) => m.user)} size={24} max={4} />
                  <Button size="sm" variant="ghost" onClick={() => openProjectSettings(c.id)} aria-label={`${c.shortName} settings`} icon>
                    <Settings2 />
                  </Button>
                  <Button size="sm" variant="secondary" href={`/workflows/canvas?focus=${c.id}`}>
                    <Focus /> Canvas
                  </Button>
                  <Button size="sm" variant="ghost" href={`/companies/${c.slug}`} aria-label={`Open ${c.shortName}`} icon>
                    <ArrowUpRight />
                  </Button>
                </div>
              );
            })}
            {newProjects.map((p) => (
              <div key={p.id} className={s.companyRow} style={{ padding: '18px 20px' }}>
                <HealthRing score={0} size={32} stroke={3} showLabel={false} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button type="button" className={s.companyRowName} style={{ fontSize: 'var(--fs-lg)', textAlign: 'left' }} onClick={() => openProjectSettings(p.id)}>
                    {p.settings.name}
                  </button>
                  <div className={s.actionSub}>
                    Onboarding · {SIZE_LABEL[p.settings.size]} · {fmtInt(p.settings.employees)} people · {ROUTE_LABEL[p.settings.route]} · no workflows yet
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => openProjectSettings(p.id)}>
                  <Settings2 /> Settings
                </Button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
