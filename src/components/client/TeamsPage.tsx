import { useState } from 'react';
import { ArrowUpRight, Trophy } from 'lucide-react';
import { COMPANIES } from '../../data/companies';
import { VERTICAL_STATUS_LABEL, kpiHit, kpisFor, verticalsFor } from '../../data/verticals';
import { verticalScores } from '../../lib/value';
import { fmtEuro, fmtInt } from '../../lib/format';
import { useSession } from '../../stores/session';
import { NoAccess } from '../shell/NoAccess';
import { Avatar, AvatarGroup } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Segmented } from '../ui/Segmented';
import { PageHeader } from '../pages/shared';
import { Podium, VerticalTable } from './Leaderboard';
import { shortDate, teamOf } from './util';
import s from './client.module.css';

/**
 * Teams: every vertical of a company against each other. A podium for the
 * top three, the full leaderboard and a card per vertical. Partner people
 * can switch company; client people see their own.
 */
export function TeamsPage() {
  const { can } = useSession();
  if (!can('see-leaderboards')) return <NoAccess cap="see-leaderboards" />;
  return <TeamsInner />;
}

function TeamsInner() {
  const { user: me, org } = useSession();
  const partner = org.kind === 'partner';
  const companies = COMPANIES.filter((c) => verticalsFor(c.id).length > 0);
  const [picked, setPicked] = useState<string>(companies.some((c) => c.id === 'volkswagen') ? 'volkswagen' : companies[0]?.id ?? '');
  const companyId = partner ? picked : me.companyId;
  const company = COMPANIES.find((c) => c.id === companyId) ?? companies[0]!;
  const verticals = verticalsFor(company.id);
  const scores = verticalScores(company.id);
  const live = verticals.filter((v) => v.status === 'live');
  const hours = scores.reduce((a, x) => a + x.value.hoursSaved30d, 0);
  const euro = scores.reduce((a, x) => a + x.value.euroSaved30d, 0);

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow={`${company.shortName} · ${live.length} live, ${verticals.length - live.length} coming`}
        title="Teams"
        lede={
          <>
            Together <b>{fmtInt(hours)} h</b> and <b>{fmtEuro(euro)}</b> saved in 30 days.
          </>
        }
        actions={partner && companies.length > 1 ? <Segmented value={company.id} onChange={setPicked} items={companies.map((c) => ({ id: c.id, label: c.shortName }))} /> : undefined}
      />

      <Podium companyId={company.id} />

      <Card>
        <CardHeader title="Leaderboard" icon={<Trophy />} />
        <CardBody flush>
          <VerticalTable companyId={company.id} highlightId={me.verticalId} />
        </CardBody>
      </Card>

      <div className={s.section}>
        <h2>Every vertical</h2>
        <span>{verticals.length} in total</span>
      </div>
      <div className={s.cards}>
        {verticals.map((v) => {
          const team = teamOf(v);
          const manager = v.managerId ? team.find((u) => u.id === v.managerId) : undefined;
          const members = team.filter((u) => u.id !== v.managerId);
          const kpis = kpisFor(company.id, v.id);
          const hits = kpis.filter(kpiHit).length;
          const score = scores.find((x) => x.vertical.id === v.id);
          const place = scores.findIndex((x) => x.vertical.id === v.id) + 1;
          return (
            <a key={v.id} href={`/teams/${v.id}`} className={s.card} aria-label={`Open ${v.name}`}>
              <span className={s.arrow} aria-hidden="true">
                <ArrowUpRight />
              </span>
              <div className={s.cardTop}>
                {place === 1 && <Trophy size={16} aria-label="Number one" />}
                <div className={s.cardName}>{v.name}</div>
                <Badge tone={v.status === 'live' ? 'success' : 'neutral'} dot size="sm">
                  {VERTICAL_STATUS_LABEL[v.status]}
                </Badge>
                <span style={{ width: 18 }} />
              </div>
              <div className={s.cardStats}>
                <div className={s.cardStat}>
                  <b>{score ? fmtInt(score.score) : '0'}</b>
                  score{place ? ` · #${place}` : ''}
                </div>
                <div className={s.cardStat}>
                  <b>{v.workflowIds.length}</b>
                  {v.workflowIds.length === 1 ? 'workflow' : 'workflows'}
                </div>
                <div className={s.cardStat}>
                  <b>
                    {hits}
                    <span style={{ color: 'var(--text-subtle)', fontWeight: 450 }}>/{kpis.length}</span>
                  </b>
                  KPIs hit
                </div>
              </div>
              <div className={s.cardFoot}>
                {manager ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Avatar user={manager} size={22} />
                    <span className="truncate">
                      {manager.name} <span style={{ color: 'var(--text-subtle)' }}>· Head of AI</span>
                    </span>
                  </span>
                ) : (
                  <span>No Head of AI yet</span>
                )}
                {members.length ? <AvatarGroup users={members} size={20} max={3} /> : <span style={{ fontSize: 'var(--fs-2xs)' }}>{v.status === 'live' ? 'no members' : v.onboardedAt ? `since ${shortDate(v.onboardedAt)}` : 'planned'}</span>}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
