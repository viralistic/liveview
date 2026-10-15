import type { ReactNode } from 'react';
import { ArrowRight, Bug, Clock, Euro, Flame, Gift, HeartHandshake, Lock, Play, Target, Trophy, Users, Zap } from 'lucide-react';
import type { MemberStats, User, Vertical } from '../../data/types';
import { BADGES, REWARDS, earnedRewards, kpisFor, leaderboard, nextReward, rankOf, verticalById } from '../../data/verticals';
import { fmtEuro, fmtInt, fmtPct, greeting, NOW } from '../../lib/format';
import { useSession } from '../../stores/session';
import { PageHeader } from '../pages/shared';
import { Bar, Stat, TileBody, TileHead } from './Tiles';
import { CountUp } from './TokenCounter';
import { KpiCard } from './ValueCharts';
import { TeamLeaderboard } from './Leaderboard';
import { BADGE_ICON, REWARD_ICON, firstName } from './util';
import s from './client.module.css';

/** A team member sees their own impact, the team and what there is to earn. */
export function WorkerDashboard() {
  const { user: me } = useSession();
  const stats = statsOf(me);
  const vertical = stats ? verticalById(stats.verticalId) : me.verticalId ? verticalById(me.verticalId) : undefined;
  if (!stats || !vertical) return <PageHeader title="My impact" lede="Not in a team yet. Ask your Head of AI." />;
  return <WorkerInner me={me} stats={stats} vertical={vertical} />;
}

function statsOf(u: User): MemberStats | undefined {
  return leaderboard(u.verticalId ?? '').find((m) => m.userId === u.id) ?? undefined;
}

function Tile({ span, children, label }: { span?: 1 | 2 | 4; children: ReactNode; label: string }) {
  return (
    <section className={[s.tile, span === 2 ? s.span2 : span === 4 ? s.span4 : ''].join(' ')} aria-label={label}>
      {children}
    </section>
  );
}

const HOW_TO: { icon: ReactNode; label: string; points: string }[] = [
  { icon: <Play />, label: 'Run', points: '+2' },
  { icon: <Clock />, label: 'Hour saved', points: '+10' },
  { icon: <Target />, label: 'KPI hit', points: '+150' },
  { icon: <Bug />, label: 'Bug found', points: '+100' },
  { icon: <HeartHandshake />, label: 'Colleague onboarded', points: '+200' },
];

function WorkerInner({ me, stats, vertical }: { me: User; stats: MemberStats; vertical: Vertical }) {
  const rank = rankOf(me.id);
  const board = leaderboard(vertical.id);
  const next = nextReward(stats.points);
  const earned = earnedRewards(stats.points);
  const kpis = kpisFor(vertical.companyId, vertical.id);
  const teamRuns = board.reduce((a, m) => a + m.runsTriggered30d, 0);
  const share = teamRuns ? stats.runsTriggered30d / teamRuns : 0;
  const streakCells = Array.from({ length: 12 }, (_, i) => i >= 12 - Math.min(12, stats.streakWeeks));

  return (
    <div className={s.page}>
      <div className={s.hero}>
        <div style={{ minWidth: 0 }}>
          <div className={s.eyebrow}>
            {NOW.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })} · {vertical.name}
          </div>
          <h1 className={s.greeting}>
            {greeting()}, {firstName(me)}
          </h1>
          <div className={s.line}>
            <span>You saved</span>
            <a href="#tile-hours" className={s.pill}>
              {fmtInt(stats.hoursSaved30d)} h
            </a>
            <span>and</span>
            <a href="#tile-euro" className={s.pill}>
              {fmtEuro(stats.euroSaved30d)}
            </a>
            <span>in 30 days for</span>
            <a href={`/teams/${vertical.id}`} className={s.pill}>
              {vertical.name} <ArrowRight />
            </a>
          </div>
        </div>
        <div className={s.actions}>
          {rank && (
            <span className={s.pill} style={{ height: 34, fontSize: 'var(--fs-md)' }}>
              {rank.rank === 1 && <Trophy />}#{rank.rank} of {rank.of} in the team
            </span>
          )}
        </div>
      </div>

      <div className={s.grid}>
        <Tile label="Hours saved">
          <div id="tile-hours" />
          <Stat label="Hours saved" icon={<Clock />} value={fmtInt(stats.hoursSaved30d)} unit="h" sub="30 days" />
        </Tile>
        <Tile label="Money saved">
          <div id="tile-euro" />
          <Stat label="Money saved" icon={<Euro />} value={fmtEuro(stats.euroSaved30d)} sub="30 days" />
        </Tile>
        <Tile label="Runs triggered">
          <Stat
            label="Runs triggered"
            icon={<Zap />}
            value={fmtInt(stats.runsTriggered30d)}
            sub={
              <>
                <b>{fmtPct(share, 0)}</b> of the team's runs
              </>
            }
          />
        </Tile>
        <Tile label="Rank">
          <Stat
            label="My rank"
            icon={<Trophy />}
            value={rank ? `#${rank.rank}` : 'n/a'}
            unit={rank ? `of ${rank.of}` : undefined}
            good={rank?.rank === 1}
            sub={
              <>
                <b>{stats.kpiHits}</b> of {stats.kpiTotal} team KPIs hit
              </>
            }
          />
        </Tile>

        <Tile span={2} label="Points">
          <TileHead title="Points" icon={<Gift />} />
          <TileBody>
            <div className={s.pointsBig}>
              <CountUp value={stats.points} />
              <small>points</small>
            </div>
            {next ? (
              <>
                <div className={s.rewardLine}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <RewardGlyph id={next.id} />
                    <span>
                      <b>{fmtInt(next.points - stats.points)}</b> to {next.label}
                    </span>
                  </span>
                  <span className="tnum">
                    {fmtInt(stats.points)} / {fmtInt(next.points)}
                  </span>
                </div>
                <div style={{ display: 'flex', marginTop: 8 }}>
                  <Bar value={stats.points / next.points} tone="accent" height={8} />
                </div>
              </>
            ) : (
              <div className={s.rewardLine}>Every reward earned. The quarterly trophy is yours.</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
              {REWARDS.map((r) => {
                const got = earned.some((e) => e.id === r.id);
                return (
                  <span key={r.id} title={`${r.label} · ${fmtInt(r.points)} points · ${r.description}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-2xs)', color: got ? 'var(--text)' : 'var(--text-muted)' }}>
                    <RewardGlyph id={r.id} earned={got} locked={!got} />
                    {r.label}
                  </span>
                );
              })}
            </div>
          </TileBody>
        </Tile>

        <Tile label="Streak">
          <TileHead title="Streak" />
          <TileBody>
            <div className={s.flame}>
              <Flame />
              <div className={s.big}>
                {stats.streakWeeks}
                <small>weeks</small>
              </div>
            </div>
            <div className={s.weeks} aria-label={`${Math.min(12, stats.streakWeeks)} of the last 12 weeks active`}>
              {streakCells.map((on, i) => (
                <i key={i} data-on={on ? 'true' : undefined} />
              ))}
            </div>
          </TileBody>
        </Tile>

        <Tile label="KPI contribution">
          <TileHead title="Team targets" icon={<Target />} />
          <TileBody>
            <div className={s.big}>
              {stats.kpiHits}
              <small>of {stats.kpiTotal} hit</small>
            </div>
            <div style={{ display: 'flex', marginTop: 10 }}>
              <Bar value={stats.kpiTotal ? stats.kpiHits / stats.kpiTotal : 0} tone={stats.kpiTotal && stats.kpiHits === stats.kpiTotal ? 'good' : undefined} height={6} />
            </div>
          </TileBody>
        </Tile>

        <Tile span={2} label="Badges">
          <TileHead title="Badges" sub={`${stats.badges.length} of ${BADGES.length} earned`} />
          <TileBody>
            <div className={s.badgeGrid}>
              {BADGES.map((b) => {
                const got = stats.badges.includes(b.id);
                const Icon = BADGE_ICON[b.id];
                return (
                  <div key={b.id} className={s.badgeCard} data-locked={got ? undefined : 'true'} title={b.description}>
                    <span className={s.badgeIcon} data-locked={got ? undefined : 'true'} data-top={got && b.id === 'top-of-month' ? 'true' : undefined} style={{ width: 28, height: 28 }}>
                      {got ? <Icon /> : <Lock />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <b>{b.label}</b>
                      <span>{b.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </TileBody>
        </Tile>

        <Tile span={2} label="Team leaderboard">
          <TileHead
            title="Team leaderboard"
            icon={<Users />}
            sub={`${vertical.name} · ${board.length} people`}
            action={
              <a href={`/teams/${vertical.id}`} className={s.hint}>
                Team page <ArrowRight />
              </a>
            }
          />
          <TileBody flush>
            <TeamLeaderboard verticalId={vertical.id} highlightId={me.id} compact />
          </TileBody>
        </Tile>

        {kpis.map((k) => (
          <Tile key={k.id} label={k.label}>
            <KpiCard
              kpi={k}
              contribution={
                <>
                  <span>Your share of the team's runs</span>
                  <b>{fmtPct(share, 0)}</b>
                </>
              }
            />
          </Tile>
        ))}

        <Tile span={kpis.length % 2 === 0 ? 2 : 1} label="How to earn points">
          <TileHead title="How to earn points" />
          <TileBody>
            <ul className={s.howto}>
              {HOW_TO.map((h) => (
                <li key={h.label}>
                  {h.icon}
                  {h.label}
                  <b>{h.points}</b>
                </li>
              ))}
            </ul>
          </TileBody>
        </Tile>
      </div>
    </div>
  );
}

function RewardGlyph({ id, earned, locked }: { id: string; earned?: boolean; locked?: boolean }) {
  const Icon = REWARD_ICON[id] ?? Gift;
  return (
    <span className={s.rewardIcon} data-earned={earned ? 'true' : undefined} data-locked={locked ? 'true' : undefined} style={{ width: 24, height: 24 }}>
      <Icon />
    </span>
  );
}
