import type { ReactNode } from 'react';
import { ArrowUpRight, Cloud, Focus, Lock, Radio, Server, Siren } from 'lucide-react';
import { ROUTE_HINT, ROUTE_LABEL, SENSITIVITY_LABEL, SIZE_HINT, SIZE_LABEL, USERS, WORKFLOWS, projectFor, verticalsFor, type Company } from '../../data';
import { useSession } from '../../stores/session';
import { signalsForCompany, type Signal } from '../../stores/signals';
import { usersWithAccess } from '../../lib/access';
import { aggregateSeries, companyHealth } from '../../lib/health';
import { companyValue } from '../../lib/value';
import { fmtCompact, fmtInt, fmtPct, relTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CompanyMark } from '../ui/CompanyMark';
import { HealthRing } from '../ui/HealthRing';
import { Tooltip } from '../ui/Tooltip';
import { LATEST_VERSION, PLAN_LABEL, TIER_LABEL, impactedForCompany, isBehind, partnerOf, pendingUpdates } from './incidents';
import v from './vendor.module.css';

/** A tooltip label that wraps instead of running off the screen. */
function Hint({ children }: { children: ReactNode }) {
  return <span style={{ display: 'block', whiteSpace: 'normal', maxWidth: 260, lineHeight: 1.4, textAlign: 'left' }}>{children}</span>;
}

export function contractSince(c: Company): string {
  return new Date(c.contractSince).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' });
}

/** The company profile n8n needs on every instance: size, people, tier, sensitivity, contract. */
export function ProfileBlock({ company, seats, runs7d }: { company: Company; seats: number; runs7d: number }) {
  const verticals = verticalsFor(company.id);
  const live = verticals.filter((x) => x.status === 'live').length;
  return (
    <div className={v.profile}>
      <div className={v.profileHead}>
        <Tooltip label={<Hint>{SIZE_HINT[company.size]}</Hint>}>
          <Badge tone="neutral">{SIZE_LABEL[company.size]}</Badge>
        </Tooltip>
        <span>
          <b>{fmtInt(company.employees)} people</b> · {company.industry} · {company.country} · {company.language}
        </span>
      </div>
      <div className={v.profileGrid}>
        <div className={v.profileItem}>
          <span>Plan</span>
          <b>{PLAN_LABEL[company.plan]}</b>
        </div>
        <div className={v.profileItem}>
          <span>Support</span>
          <b>{TIER_LABEL[company.supportTier]}</b>
        </div>
        <div className={v.profileItem}>
          <span>Sensitivity</span>
          <b title={company.sensitivity === 'hyper' ? 'Hyper-sensitive: no data leaves the instance, every change is reviewed.' : undefined}>
            {company.sensitivity === 'hyper' && <Lock />}
            {SENSITIVITY_LABEL[company.sensitivity]}
          </b>
        </div>
        <div className={v.profileItem}>
          <span>Contract since</span>
          <b>{contractSince(company)}</b>
        </div>
        <div className={v.profileItem}>
          <span>Seats</span>
          <b>{seats} with access</b>
        </div>
        <div className={v.profileItem}>
          <span>Verticals</span>
          <b>
            {live} of {verticals.length} live
          </b>
        </div>
        <div className={v.profileItem}>
          <span>Executions</span>
          <b>{fmtCompact(runs7d * 4.3)} / month</b>
        </div>
        <div className={v.profileItem}>
          <span>Onboarded</span>
          <b>{relTime(company.onboardedAt)}</b>
        </div>
      </div>
    </div>
  );
}

/** One instance: how it runs, how it is doing, who is allocated to it. */
export function InstanceCard({ company, signals, focus }: { company: Company; signals: Signal[]; focus?: boolean }) {
  const { grants, can } = useSession();
  const wfs = WORKFLOWS.filter((w) => w.companyId === company.id);
  const agg = aggregateSeries(wfs);
  const runs7d = agg.runs.reduce((a, b) => a + b, 0);
  const failed7d = agg.failures.reduce((a, b) => a + b, 0);
  const success = runs7d ? 1 - failed7d / runs7d : 1;
  const breaking = wfs.flatMap((w) => w.issues).filter((i) => i.severity === 'critical').length;
  const health = companyHealth(company.id);
  const tokens = companyValue(company.id).tokens30d;
  const partner = partnerOf(company);
  const project = projectFor(company.id);
  const techOwner = project ? USERS.find((u) => u.id === project.technicalOwnerId) : undefined;
  const seats = usersWithAccess({ kind: 'company', companyId: company.id }, grants).length;
  const behind = isBehind(company);
  const pending = pendingUpdates(company);
  const impacted = impactedForCompany(company);
  const breakingUpdates = pending.filter((u) => u.kind === 'breaking').length;
  const last = signalsForCompany(company.id, signals)[0];
  const lastBy = last ? USERS.find((u) => u.id === last.byId) : undefined;
  const RouteIcon = company.route === 'partner' ? Cloud : Server;

  return (
    <article id={company.id} className={v.instanceCard} data-focus={focus ? 'true' : undefined} aria-label={`${company.name} instance`}>
      <div className={v.cardTop}>
        <CompanyMark company={company} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={v.cardName}>
            <a href={`/companies/${company.slug}`}>{company.name}</a>
            {breaking > 0 && (
              <Badge tone="danger" size="sm">
                <Siren /> {breaking} breaking
              </Badge>
            )}
          </div>
          <div className={v.cardInd}>
            {company.industry} · {company.city}
          </div>
        </div>
        <HealthRing score={health} size={44} />
      </div>

      <div className={v.cardTags}>
        <Tooltip label={<Hint>{ROUTE_HINT[company.route]}</Hint>}>
          <span className={v.routeTag} data-route={company.route}>
            <RouteIcon /> {ROUTE_LABEL[company.route]}
          </span>
        </Tooltip>
        <Badge tone="outline">{PLAN_LABEL[company.plan]}</Badge>
        <Tooltip label={<Hint>{behind ? `${pending.length} release${pending.length === 1 ? '' : 's'} behind ${LATEST_VERSION}. ${impacted.length} workflow${impacted.length === 1 ? '' : 's'} touched by the pending releases${breakingUpdates ? `, ${breakingUpdates} breaking` : ''}.` : `Runs the latest release, ${LATEST_VERSION}.`}</Hint>}>
          <span className={v.versionTag} data-behind={behind}>
            <code>n8n {company.n8nVersion}</code>
            {behind ? (
              <>
                <ArrowUpRight /> Upgrade available · {impacted.length} impacted
              </>
            ) : (
              'Latest'
            )}
          </span>
        </Tooltip>
      </div>

      <div className={v.stats}>
        <div className={v.stat}>
          <b>{wfs.length}</b>
          <span>workflows</span>
        </div>
        <div className={v.stat}>
          <b>{fmtCompact(runs7d)}</b>
          <span>executions, 7 days</span>
        </div>
        <div className={v.stat}>
          <b style={{ color: success < 0.95 ? 'var(--accent)' : undefined }}>{fmtPct(success, 1)}</b>
          <span>success</span>
        </div>
        <div className={v.stat}>
          <b style={{ color: breaking ? 'var(--accent)' : undefined }}>{breaking}</b>
          <span>breaking</span>
        </div>
        {can('see-tokens') && (
          <div className={v.stat}>
            <b>{fmtCompact(tokens)}</b>
            <span>tokens, 30 days</span>
          </div>
        )}
      </div>

      <ProfileBlock company={company} seats={seats} runs7d={runs7d} />

      <div className={v.cardPeople}>
        {partner && (
          <span className={v.who}>
            <CompanyMark company={partner} size={18} />
            <b>{partner.shortName}</b> {partner.id === company.id ? 'own instance' : 'allocated partner'}
          </span>
        )}
        {techOwner && (
          <span className={v.who}>
            <Avatar user={techOwner} size={18} />
            <b>{techOwner.name}</b> technical owner
          </span>
        )}
      </div>

      <div className={v.cardFoot}>
        <span className={v.lastSignal}>
          <Radio size={12} style={{ color: last ? 'var(--accent)' : 'var(--text-subtle)' }} />
          {last && lastBy ? (
            <>
              Last signal <b>{relTime(last.at, new Date())}</b> by {lastBy.name.split(' ')[0]}
            </>
          ) : (
            'No signals yet'
          )}
        </span>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <Button size="sm" variant="secondary" href={`/incidents?instance=${company.id}`}>
            <Siren /> View incidents
          </Button>
          {can('view-canvas') && (
            <Button size="sm" variant="secondary" href={`/workflows/canvas?focus=${company.id}`}>
              <Focus /> Open canvas
            </Button>
          )}
        </span>
      </div>
    </article>
  );
}
