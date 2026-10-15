import { useMemo } from 'react';
import { ArrowRight, AtSign, Award, Clock, Cpu, Euro, Gift, LayoutGrid, Trophy, Users, Workflow as WorkflowIcon } from 'lucide-react';
import type { Vertical } from '../../data/types';
import { companyById } from '../../data/companies';
import { USERS } from '../../data/users';
import { WORKFLOWS } from '../../data/workflows';
import { productById } from '../../data/products';
import { BADGES, REWARDS, VERTICAL_STATUS_LABEL, kpisFor, leaderboard, verticalById } from '../../data/verticals';
import { workflowHealth } from '../../lib/health';
import { dailyValueSeries, verticalScores, verticalValue } from '../../lib/value';
import { fmtCompact, fmtEuro, fmtInt, fmtPct } from '../../lib/format';
import { useSession } from '../../stores/session';
import { openAsk } from '../../stores/planner';
import { NoAccess } from '../shell/NoAccess';
import { Avatar, AvatarGroup } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { HealthRing } from '../ui/HealthRing';
import { NodeIcon } from '../ui/NodeIcon';
import { ProductTag } from '../ui/ProductTag';
import { Bars } from '../ui/Sparkline';
import { PageHeader } from '../pages/shared';
import { Stat, TileBody, TileGrid, TileHead, type TileDef } from './Tiles';
import { KpiCard } from './ValueCharts';
import { RewardProgress, TeamLeaderboard } from './Leaderboard';
import { BADGE_ICON, REWARD_ICON, partnerContact, shortDate, teamOf, verticalRank } from './util';
import s from './client.module.css';

/** One vertical: its people, leaderboard, KPIs, workflows and what there is to earn. */
export function TeamPage({ verticalId }: { verticalId: string }) {
  const { user: me, can, org } = useSession();
  const vertical = verticalById(verticalId);
  if (!can('see-leaderboards')) return <NoAccess cap="see-leaderboards" />;
  if (!vertical) return <PageHeader title="Unknown team" lede="This vertical does not exist." />;
  if (org.kind === 'client' && vertical.companyId !== me.companyId) return <NoAccess cap="see-leaderboards" />;
  return <TeamInner vertical={vertical} />;
}

function TeamInner({ vertical }: { vertical: Vertical }) {
  const { user: me } = useSession();
  const company = companyById(vertical.companyId);
  const team = teamOf(vertical);
  const manager = vertical.managerId ? USERS.find((u) => u.id === vertical.managerId) : undefined;
  const members = team.filter((u) => u.id !== vertical.managerId);
  const wfs = useMemo(() => WORKFLOWS.filter((w) => vertical.workflowIds.includes(w.id)), [vertical]);
  const value = useMemo(() => verticalValue(vertical), [vertical]);
  const series = useMemo(() => dailyValueSeries(wfs), [wfs]);
  const kpis = kpisFor(company.id, vertical.id);
  const board = leaderboard(vertical.id);
  const rank = verticalRank(company.id, vertical.id);
  const score = verticalScores(company.id).find((x) => x.vertical.id === vertical.id);
  const products = vertical.plannedProductIds.map((id) => productById(id)).filter((x): x is NonNullable<typeof x> => !!x);
  const live = vertical.status === 'live';

  const tiles: TileDef[] = [
    {
      id: 'time',
      label: 'Time saved',
      node: (
        <Stat
          label="Time saved"
          icon={<Clock />}
          value={fmtInt(value.hoursSaved30d)}
          unit="h"
          sub={
            <>
              30 days · <b>{fmtInt(value.hoursSavedTotal)} h</b> since go-live
            </>
          }
          spark={live ? series.hours : undefined}
        />
      ),
    },
    {
      id: 'money',
      label: 'Money saved',
      node: (
        <Stat
          label="Money saved"
          icon={<Euro />}
          value={fmtEuro(value.euroSaved30d)}
          sub={
            <>
              30 days · <b>{fmtEuro(value.euroSavedTotal)}</b> since go-live
            </>
          }
          spark={live ? series.euro : undefined}
        />
      ),
    },
    {
      id: 'tokens',
      label: 'Tokens',
      node: (
        <Stat
          label="Tokens"
          icon={<Cpu />}
          value={value.tokens30d ? fmtCompact(value.tokens30d) : '0'}
          sub={
            <>
              30 days · <b>{fmtEuro(value.tokenCost30d)}</b> model cost
            </>
          }
          spark={live && value.tokens30d ? series.tokens : undefined}
        />
      ),
    },
    {
      id: 'rank',
      label: 'Rank',
      node: (
        <Stat
          label="Rank among verticals"
          icon={<Trophy />}
          value={rank ? `#${rank.rank}` : 'n/a'}
          unit={rank ? `of ${rank.of}` : undefined}
          good={rank?.rank === 1}
          sub={
            rank ? (
              <>
                <b>{fmtInt(score?.score ?? 0)}</b> points · <b>{fmtInt(board.reduce((a, m) => a + m.points, 0))}</b> team points
              </>
            ) : (
              'Ranked after go-live'
            )
          }
        />
      ),
    },
    ...kpis.map<TileDef>((k) => ({ id: `kpi:${k.id}`, label: k.label, node: <KpiCard kpi={k} /> })),
    {
      id: 'board',
      span: 4,
      label: 'Team leaderboard',
      node: (
        <>
          <TileHead title="Team leaderboard" icon={<Users />} sub={board.length ? `${board.length} people ranked by points · hours saved, euro saved, KPI targets, streak and badges` : 'Points start with the first automation run'} />
          <TileBody flush>
            <TeamLeaderboard verticalId={vertical.id} highlightId={me.id} />
          </TileBody>
        </>
      ),
    },
    {
      id: 'workflows',
      span: 2,
      label: live ? 'Workflows' : 'Planned products',
      node: live ? (
        <>
          <TileHead
            title="Workflows"
            icon={<WorkflowIcon />}
            sub={`${wfs.filter((w) => w.active).length} of ${wfs.length} active`}
            action={
              <a href={`/workflows/canvas?focus=${company.id}`} className={s.hint}>
                Canvas <ArrowRight />
              </a>
            }
          />
          <TileBody flush>
            <div className={s.rows}>
              {wfs.map((w) => (
                <a key={w.id} href={`/workflows/canvas?focus=${w.id}`} className={s.wfRow}>
                  <NodeIcon type={w.trigger.nodeTypeId} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <div className={s.rowName}>{w.name}</div>
                    <div className={s.rowSub}>
                      {w.active ? `${fmtInt(w.stats.runs7d)} runs this week` : 'Inactive'} · {w.trigger.label}
                    </div>
                  </div>
                  <Bars data={w.stats.series7d} failures={w.stats.failures7d} width={96} height={22} color="var(--track-strong)" failColor="var(--accent)" />
                  <span className={s.num} style={{ fontSize: 'var(--fs-xs)', color: w.stats.successRate < 0.95 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {fmtPct(w.stats.successRate, 0)}
                  </span>
                  <HealthRing score={workflowHealth(w)} size={26} stroke={3} showLabel={false} checkWhenHealthy={!w.issues.some((i) => i.severity === 'critical')} />
                </a>
              ))}
            </div>
          </TileBody>
        </>
      ) : (
        <>
          <TileHead title="Planned products" sub="what this vertical will run first" />
          <TileBody>
            {products.length ? (
              <div className={s.products}>
                {products.map((pr) => (
                  <a key={pr.id} href={`/products/${pr.slug}`} className={s.product}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <b>{pr.name}</b>
                      <span>{pr.tagline}</span>
                    </div>
                    <ProductTag size="sm" name={`v${pr.version}`} />
                  </a>
                ))}
              </div>
            ) : (
              <div className={s.empty}>Products are chosen in the kick-off workshop.</div>
            )}
          </TileBody>
        </>
      ),
    },
    {
      id: 'rewards',
      span: 2,
      label: 'Rewards',
      node: (
        <>
          <TileHead title="Rewards" icon={<Gift />} sub="what the points buy, and who is close" />
          <TileBody flush>
            <div className={s.rows}>
              {REWARDS.map((r) => {
                const Icon = REWARD_ICON[r.id] ?? Gift;
                const reached = board.filter((m) => m.points >= r.points).map((m) => USERS.find((u) => u.id === m.userId)).filter((u): u is NonNullable<typeof u> => !!u);
                const closest = board.filter((m) => m.points < r.points).sort((a, b) => b.points - a.points)[0];
                return (
                  <div key={r.id} className={s.row} style={{ padding: '9px 16px' }}>
                    <span className={s.rewardIcon} data-earned={reached.length ? 'true' : undefined}>
                      <Icon />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={s.rowName}>
                        {r.label} <span style={{ color: 'var(--text-subtle)', fontWeight: 450 }}>· {fmtInt(r.points)} points</span>
                      </div>
                      <div className={s.rowSub}>{r.description}</div>
                    </div>
                    {reached.length ? (
                      <AvatarGroup users={reached} size={20} max={4} />
                    ) : closest ? (
                      <span className={s.rowSub} style={{ flex: 'none' }}>
                        {USERS.find((u) => u.id === closest.userId)?.name.split(' ')[0]} needs {fmtInt(r.points - closest.points)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {board.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <RewardProgress verticalId={vertical.id} />
              </div>
            )}
          </TileBody>
        </>
      ),
    },
    {
      id: 'badges',
      span: 4,
      label: 'Badges',
      node: (
        <>
          <TileHead title="Badges" icon={<Award />} sub="earned for using the automations, saving time, hitting targets and helping the team" />
          <TileBody>
            <div className={s.badgeGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
              {BADGES.map((b) => {
                const Icon = BADGE_ICON[b.id];
                const holders = board.filter((m) => m.badges.includes(b.id)).map((m) => USERS.find((u) => u.id === m.userId)).filter((u): u is NonNullable<typeof u> => !!u);
                return (
                  <div key={b.id} className={s.badgeCard} data-locked={holders.length ? undefined : 'true'} title={b.description}>
                    <span className={s.badgeIcon} data-top={b.id === 'top-of-month' && holders.length ? 'true' : undefined} style={{ width: 28, height: 28 }}>
                      <Icon />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <b>{b.label}</b>
                      <span>{holders.length ? `${holders.length} of ${board.length} earned it` : 'Nobody yet'}</span>
                    </div>
                    {holders.length > 0 && <AvatarGroup users={holders} size={18} max={3} />}
                  </div>
                );
              })}
            </div>
          </TileBody>
        </>
      ),
    },
  ];

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow={
          <>
            <a href="/teams" style={{ color: 'var(--text-muted)' }}>
              {company.shortName} teams
            </a>
            <span>·</span>
            <Badge tone={live ? 'success' : 'neutral'} dot size="sm">
              {VERTICAL_STATUS_LABEL[vertical.status]}
            </Badge>
            {vertical.onboardedAt && <span>{live ? 'live' : 'onboarding'} since {shortDate(vertical.onboardedAt)}</span>}
          </>
        }
        title={
          <>
            {rank?.rank === 1 && <Trophy size={22} aria-label="Number one" />}
            {vertical.name}
          </>
        }
        lede={
          <>
            {vertical.description}
            <span style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
              {manager ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Avatar user={manager} size={28} online={manager.online} />
                  <span>
                    <b>{manager.name}</b> · {vertical.label}
                  </span>
                </span>
              ) : (
                <span>No Head of AI yet</span>
              )}
              {members.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <AvatarGroup users={members} size={24} max={5} />
                  <span>
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </span>
                </span>
              )}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="primary" onClick={() => openAsk({ companyId: company.id, assigneeId: partnerContact(company.id, 'process') })}>
              <AtSign /> Ask Viralistic
            </Button>
            {live && (
              <Button variant="secondary" href={`/workflows/canvas?focus=${company.id}`}>
                <LayoutGrid /> Canvas
              </Button>
            )}
          </>
        }
      />
      <TileGrid tiles={tiles} order={tiles.map((t) => t.id)} />
    </div>
  );
}
