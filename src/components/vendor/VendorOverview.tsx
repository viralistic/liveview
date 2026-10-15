import { useMemo } from 'react';
import { ArrowRight, Check, Clock, Cloud, Lock, Radio, Rocket, Server, Siren } from 'lucide-react';
import { PARTNER, ROUTE_LABEL, SENSITIVITY_LABEL, SIZE_LABEL, USERS, companyById, orgOfUser, projectFor, usersOfOrg, type Company } from '../../data';
import { useSession, toast } from '../../stores/session';
import { latestSignal, useSignals, type Signal } from '../../stores/signals';
import { personaOf } from '../../lib/persona';
import { aggregateSeries, companyHealth } from '../../lib/health';
import { companyValue } from '../../lib/value';
import { fmtCompact, fmtInt, greeting, relTime, NOW } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '../ui/Card';
import { CompanyMark } from '../ui/CompanyMark';
import { HealthRing } from '../ui/HealthRing';
import { IncidentRow } from './IncidentRow';
import { LATEST_VERSION, RELEASE_VERSIONS, TIER_LABEL, cmpVersion, impactedForCompany, incidentState, incidentsFor, isBehind, partnerOf, pendingUpdates } from './incidents';
import s from '../pages/pages.module.css';
import v from './vendor.module.css';

const first = (name: string) => name.split(' ')[0]!;

/**
 * The n8n control room: every instance n8n is involved in, through the partner
 * program or an enterprise agreement, and the incidents it should signal.
 * Tokens yes, business numbers never.
 */
export function VendorOverview() {
  const { user: me, can, visibleCompanies: companies, visibleWorkflows: wfs } = useSession();
  const signals = useSignals();
  const incidents = useMemo(() => incidentsFor(companies, wfs), [companies, wfs]);
  const states = incidents.map((i) => incidentState(i.issue.id, signals));
  const openCount = states.filter((st) => st !== 'acknowledged').length;
  const signalledCount = states.filter((st) => st === 'signalled').length;
  const ackCount = states.filter((st) => st === 'acknowledged').length;
  const critical = incidents.filter((i) => i.issue.severity === 'critical').length;
  const partners = Array.from(new Set(companies.map((c) => partnerOf(c)?.id).filter((x): x is string => !!x)));
  const behind = companies.filter(isBehind);
  const agg = useMemo(() => aggregateSeries(wfs), [wfs]);
  const runs7d = agg.runs.reduce((a, b) => a + b, 0);
  const failed7d = agg.failures.reduce((a, b) => a + b, 0);
  const tokens30d = companies.reduce((a, c) => a + companyValue(c.id).tokens30d, 0);
  const thisMonth = signals.filter((sg) => {
    const d = new Date(sg.at);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const partnerPeople = usersOfOrg(PARTNER.id);
  const recent = [...signals].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  return (
    <>
      <div className={s.header} style={{ alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className={s.eyebrow}>
            {NOW.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · n8n control room
          </div>
          <h1 className={s.greeting}>
            {greeting()}, {first(me.name)}
          </h1>
          <div className={s.managing}>
            <span>n8n is involved in</span>
            <a href="/instances" className={s.pillLink}>
              {companies.length} {companies.length === 1 ? 'instance' : 'instances'} <ArrowRight />
            </a>
            <span>through</span>
            <a href="#partner" className={s.pillLink}>
              {partners.length} {partners.length === 1 ? 'partner' : 'partners'} <ArrowRight />
            </a>
          </div>
        </div>
        <div className={s.actions}>
          <Button href="/incidents" variant={critical ? 'primary' : 'secondary'}>
            <Siren /> Incidents{openCount ? ` · ${openCount}` : ''}
          </Button>
          <Button href="/instances" variant="secondary">
            <Server /> Instances
          </Button>
        </div>
      </div>

      <div className={v.kpis}>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>Instances</div>
          <div className={s.kpiMinValue}>{companies.length}</div>
          <div className={s.hoverCard}>
            <b>{companies.filter((c) => c.route === 'partner').length}</b> partner route · <b>{companies.filter((c) => c.route === 'self-hosted').length}</b> local host
          </div>
        </div>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>Open incidents</div>
          <div className={s.kpiMinValue} style={{ color: critical ? 'var(--accent)' : undefined }}>{openCount}</div>
          <div className={s.hoverCard}>
            <b>{critical}</b> breaking · <b>{signalledCount}</b> signalled · <b>{ackCount}</b> acknowledged
          </div>
        </div>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>Behind on version</div>
          <div className={s.kpiMinValue}>
            {behind.length}
            <small style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: 450, letterSpacing: 0 }}>of {companies.length}</small>
          </div>
          <div className={s.hoverCard}>
            Latest is <b>{LATEST_VERSION}</b> · {behind.map((c) => `${c.shortName} ${c.n8nVersion}`).join(' · ') || 'everyone is current'}
          </div>
        </div>
        <div className={s.kpiMin}>
          <div className={s.kpiLabel}>Executions, 7 days</div>
          <div className={s.kpiMinValue}>{fmtCompact(runs7d)}</div>
          <div className={s.hoverCard}>
            <b>{fmtInt(failed7d)}</b> failed · <b>{wfs.length}</b> workflows across {companies.length} instances
          </div>
        </div>
        {can('see-tokens') && (
          <div className={s.kpiMin}>
            <div className={s.kpiLabel}>Tokens, 30 days</div>
            <div className={s.kpiMinValue}>{fmtCompact(tokens30d)}</div>
            <div className={s.hoverCard}>
              Model usage across all instances. <b>No money</b> is shown to n8n.
            </div>
          </div>
        )}
      </div>

      <div className={s.grid2}>
        <div className={s.stack}>
          <Card>
            <CardHeader
              title="Incidents"
              sub="Breaking and wasteful findings across every instance n8n is involved in. Worst first."
              icon={<Siren />}
              action={critical ? <span className={s.companyCritical}>{critical} breaking</span> : undefined}
            />
            <CardBody flush>
              {incidents.length === 0 ? (
                <div className={v.empty}>
                  <Check /> Nothing is breaking or wasteful right now.
                </div>
              ) : (
                incidents.map((inc) => <IncidentRow key={inc.issue.id} inc={inc} signal={latestSignal(inc.issue.id, signals)} />)
              )}
            </CardBody>
            {incidents.length > 0 && (
              <CardFooter>
                <span>
                  {openCount} open · {thisMonth.length} signal{thisMonth.length === 1 ? '' : 's'} sent this month
                </span>
                <a href="/incidents" style={{ color: 'var(--text)', fontWeight: 500 }}>
                  All incidents
                </a>
              </CardFooter>
            )}
          </Card>

          {can('apply-updates') && (
            <Card>
              <CardHeader title="Platform" sub={`Version adoption per instance. Latest release is ${LATEST_VERSION}.`} icon={<Rocket />} />
              <CardBody flush>
                {companies.map((c) => (
                  <PlatformRow key={c.id} company={c} />
                ))}
              </CardBody>
            </Card>
          )}
        </div>

        <div className={s.stack}>
          <Card>
            <CardHeader title="Instances" icon={<Server />} action={<a href="/instances" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>All</a>} />
            <CardBody flush>
              {companies.map((c) => (
                <InstanceRow key={c.id} company={c} />
              ))}
            </CardBody>
          </Card>

          <Card id="partner">
            <CardHeader title="Allocated partner" />
            <div className={v.partnerHead}>
              <CompanyMark company={companyById(PARTNER.id)} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={v.partnerName}>{PARTNER.name}</div>
                <div className={v.partnerSub}>n8n partner · {PARTNER.city}</div>
              </div>
              <Badge tone="dark" size="sm">
                Partner
              </Badge>
            </div>
            <div className={v.partnerFacts}>
              <div className={v.fact}>
                <b>{companies.filter((c) => c.id !== PARTNER.id).length}</b>
                <span>client instances</span>
              </div>
              <div className={v.fact}>
                <b>{partnerPeople.length}</b>
                <span>people</span>
              </div>
              <div className={v.fact}>
                <b>{thisMonth.length}</b>
                <span>signals this month</span>
              </div>
            </div>
            <div className={v.people}>
              {partnerPeople.map((u) => (
                <div key={u.id} className={v.person}>
                  <Avatar user={u} size={26} online={u.online} />
                  <div className={v.personMeta}>
                    <div className={v.personName}>{u.name}</div>
                    <div className={v.personSub}>{u.title}</div>
                  </div>
                  <span className={v.roleChip}>{personaOf(u).short}</span>
                </div>
              ))}
            </div>
            <div className={v.sla}>
              <Clock />
              <span>
                Response SLA: <b>breaking within one working hour</b>, wasteful within three working days. A signal lands in the technical owner's planner right away.
              </span>
            </div>
          </Card>

          <Card>
            <CardHeader title="Signals" icon={<Radio />} sub={signals.length ? `${signals.length} sent in total` : undefined} />
            <CardBody flush>
              {recent.length === 0 ? (
                <div className={v.empty} style={{ color: 'var(--text-muted)' }}>
                  <Radio style={{ color: 'var(--text-subtle)' }} /> No signals yet. Signal the partner from an incident above.
                </div>
              ) : (
                recent.map((sg) => <SignalFeedRow key={sg.id} signal={sg} />)
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

/** One instance with its profile, compact. */
function InstanceRow({ company }: { company: Company }) {
  const RouteIcon = company.route === 'partner' ? Cloud : Server;
  const behind = isBehind(company);
  const health = companyHealth(company.id);
  const impacted = impactedForCompany(company).length;
  return (
    <a href={`/instances#${company.id}`} className={v.instanceRow}>
      <CompanyMark company={company} size={30} />
      <div className={v.instanceRowMeta}>
        <div className={v.instanceRowName}>
          {company.shortName}
          <Badge tone="neutral" size="sm">
            {SIZE_LABEL[company.size]}
          </Badge>
          <span className={v.routeTag} data-route={company.route}>
            <RouteIcon /> {ROUTE_LABEL[company.route]}
          </span>
        </div>
        <div className={v.instanceRowSub}>
          {fmtInt(company.employees)} people · {company.industry} · {company.country} · {TIER_LABEL[company.supportTier]} support ·{' '}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {company.sensitivity === 'hyper' && <Lock />}
            {SENSITIVITY_LABEL[company.sensitivity]}
          </span>
        </div>
      </div>
      <div className={v.versionCell}>
        <code className={s.version}>{company.n8nVersion}</code>
        {behind && <span className={v.behind}>{impacted ? `${impacted} impacted` : 'upgrade available'}</span>}
      </div>
      <HealthRing score={health} size={30} stroke={3} showLabel={false} checkWhenHealthy />
    </a>
  );
}

/** Version adoption for one instance: a dot per release, filled when the instance has it. */
function PlatformRow({ company }: { company: Company }) {
  const pending = pendingUpdates(company);
  const impacted = impactedForCompany(company);
  const breaking = pending.filter((u) => u.kind === 'breaking').length;
  const behind = isBehind(company);
  const project = projectFor(company.id);
  const owner = project ? USERS.find((u) => u.id === project.technicalOwnerId) : undefined;
  return (
    <div className={v.platformRow}>
      <CompanyMark company={company} size={28} />
      <div className={v.platformMeta}>
        <div className={v.platformName}>
          {company.shortName}
          <code className={s.version}>{company.n8nVersion}</code>
          <span className={v.dots} aria-label={`${RELEASE_VERSIONS.length - pending.length} of ${RELEASE_VERSIONS.length} releases adopted`}>
            {RELEASE_VERSIONS.map((ver) => (
              <i key={ver} data-on={cmpVersion(company.n8nVersion, ver) >= 0} data-latest={ver === LATEST_VERSION} title={ver} />
            ))}
          </span>
        </div>
        <div className={v.platformSub}>
          {behind ? (
            <>
              {pending.length} release{pending.length === 1 ? '' : 's'} behind · {impacted.length} workflow{impacted.length === 1 ? '' : 's'} impacted{breaking ? <> · <b>{breaking} breaking</b></> : ''}
              {owner ? ` · ${first(owner.name)} owns the upgrade` : ''}
            </>
          ) : (
            `Runs ${LATEST_VERSION}, the latest release`
          )}
        </div>
      </div>
      {behind ? (
        <Button size="sm" variant="secondary" onClick={() => toast(`Upgrade nudge sent to ${owner ? first(owner.name) : 'the partner'} at ${PARTNER.shortName}: ${company.shortName} to n8n ${LATEST_VERSION}`)}>
          <Rocket /> Nudge upgrade
        </Button>
      ) : (
        <span className={v.upToDate}>
          <Check /> Up to date
        </span>
      )}
    </div>
  );
}

function SignalFeedRow({ signal }: { signal: Signal }) {
  const by = USERS.find((u) => u.id === signal.byId);
  const to = signal.assigneeId ? USERS.find((u) => u.id === signal.assigneeId) : undefined;
  return (
    <div className={v.feedRow}>
      {by && <Avatar user={by} size={26} />}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className={v.feedText}>
          <b>{by ? first(by.name) : 'n8n'}</b> signalled {to ? <b>{first(to.name)}</b> : 'the partner'}
          {to ? ` at ${orgOfUser(to).shortName}` : ''}: {signal.note}
        </div>
        <div className={v.feedTime}>
          {relTime(signal.at, new Date())} · {signal.importance} importance · {signal.status === 'acknowledged' ? 'acknowledged' : signal.plannedAt ? `planned ${new Date(signal.plannedAt).toLocaleDateString('en-GB', { weekday: 'short' })} ${new Date(signal.plannedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'in the inbox'}
        </div>
      </div>
    </div>
  );
}
