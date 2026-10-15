import { ArrowDown, ArrowUp, Flame, Minus, Trophy, ArrowUpRight } from 'lucide-react';
import type { BadgeId, MemberStats } from '../../data/types';
import { USERS } from '../../data/users';
import { badgeById, leaderboard, nextReward, verticalById } from '../../data/verticals';
import { verticalScores, type VerticalScore } from '../../lib/value';
import { fmtCompact, fmtEuro, fmtInt, fmtPct } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { Bar } from './Tiles';
import { BADGE_ICON, pointsThisWeek, rankMovement, teamOf } from './util';
import s from './client.module.css';

/* ------------------------------------------------------------------ */
/* Badges as small icons with a tooltip.                                */
/* ------------------------------------------------------------------ */
export function BadgeIcons({ ids, max = 6, size = 22 }: { ids: BadgeId[]; max?: number; size?: number }) {
  const shown = ids.slice(0, max);
  const rest = ids.length - shown.length;
  return (
    <span className={s.badges}>
      {shown.map((id) => {
        const def = badgeById(id);
        const Icon = BADGE_ICON[id];
        return (
          <Tooltip key={id} label={`${def.label}: ${def.description}`}>
            <span className={s.badgeIcon} data-top={id === 'top-of-month' ? 'true' : undefined} style={{ width: size, height: size }}>
              <Icon />
            </span>
          </Tooltip>
        );
      })}
      {rest > 0 && (
        <span className={s.badgeIcon} style={{ width: size, height: size, fontSize: 9, fontWeight: 600 }}>
          +{rest}
        </span>
      )}
    </span>
  );
}

function Movement({ delta }: { delta: number }) {
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
  return (
    <span className={s.move} data-dir={dir} title={dir === 'same' ? 'Same place as last week' : `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} since last week`}>
      {dir === 'up' ? <ArrowUp /> : dir === 'down' ? <ArrowDown /> : <Minus />}
      {dir !== 'same' && Math.abs(delta)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Team leaderboard: the people of one vertical, ranked by points.      */
/* ------------------------------------------------------------------ */
export function TeamLeaderboard({ verticalId, highlightId, compact = false }: { verticalId: string; highlightId?: string; compact?: boolean }) {
  const board = leaderboard(verticalId);
  const vertical = verticalById(verticalId);
  if (!board.length) return <div className={s.empty} style={{ padding: '12px 16px' }}>No activity yet. Points start with the first automation run.</div>;
  return (
    <div className={s.scrollX}>
      <table className={s.table}>
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>Member</th>
            <th className={s.num}>Points</th>
            <th className={s.num}>Hours</th>
            {!compact && <th className={s.num}>Saved</th>}
            {!compact && <th className={s.num}>KPIs</th>}
            <th>Streak</th>
            <th>Badges</th>
            <th className={s.num}>Week</th>
          </tr>
        </thead>
        <tbody>
          {board.map((m: MemberStats, i) => {
            const u = USERS.find((x) => x.id === m.userId);
            if (!u) return null;
            const isManager = vertical?.managerId === u.id;
            return (
              <tr key={m.userId} data-me={highlightId === m.userId ? 'true' : undefined}>
                <td>
                  <span className={s.rank} data-top={i === 0 ? 'true' : undefined} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i === 0 ? <Trophy className={s.trophy} aria-label="Number one" /> : i + 1}
                  </span>
                </td>
                <td>
                  <div className={s.person}>
                    <Avatar user={u} size={28} online={u.online} />
                    <div style={{ minWidth: 0 }}>
                      <b>
                        {u.name}
                        {highlightId === u.id ? ' (you)' : ''}
                      </b>
                      <span>{isManager ? 'Head of AI' : u.title}</span>
                    </div>
                  </div>
                </td>
                <td className={[s.num, s.points].join(' ')}>{fmtInt(m.points)}</td>
                <td className={s.num}>{fmtInt(m.hoursSaved30d)} h</td>
                {!compact && <td className={s.num}>{fmtEuro(m.euroSaved30d)}</td>}
                {!compact && (
                  <td className={s.num} style={{ color: m.kpiTotal && m.kpiHits === m.kpiTotal ? 'var(--success-fg)' : undefined }}>
                    {m.kpiHits}/{m.kpiTotal}
                  </td>
                )}
                <td>
                  <span className={s.streak} title={`${m.streakWeeks} weeks in a row`}>
                    <Flame /> {m.streakWeeks}w
                  </span>
                </td>
                <td>
                  <BadgeIcons ids={m.badges} max={compact ? 4 : 6} />
                </td>
                <td className={s.num}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>+{pointsThisWeek(m.series12w)}</span>
                    <Movement delta={rankMovement(verticalId, m.userId)} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Progress of every member towards their next reward. */
export function RewardProgress({ verticalId }: { verticalId: string }) {
  const board = leaderboard(verticalId);
  if (!board.length) return <div className={s.empty}>No points yet.</div>;
  return (
    <div className={s.rows}>
      {board.map((m) => {
        const u = USERS.find((x) => x.id === m.userId);
        const next = nextReward(m.points);
        if (!u) return null;
        return (
          <div key={m.userId} className={s.row} style={{ padding: '9px 16px' }}>
            <Avatar user={u} size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 'var(--fs-xs)' }}>
                <span className={s.rowName}>{u.name}</span>
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }} className="tnum">
                  {next ? (
                    <>
                      {fmtInt(m.points)} / {fmtInt(next.points)} · {next.label}
                    </>
                  ) : (
                    'Every reward earned'
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', marginTop: 5 }}>
                <Bar value={next ? m.points / next.points : 1} tone={next ? undefined : 'good'} height={5} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Verticals against each other.                                        */
/* ------------------------------------------------------------------ */
export function VerticalBoard({ companyId, compact = false }: { companyId: string; compact?: boolean }) {
  const scores = verticalScores(companyId);
  const max = Math.max(1, ...scores.map((x) => x.score));
  if (!scores.length) return <div className={s.empty} style={{ padding: '12px 16px' }}>No live vertical yet.</div>;
  return (
    <div className={s.rows}>
      {scores.map((x, i) => (
        <a key={x.vertical.id} href={`/teams/${x.vertical.id}`} className={s.row} style={{ padding: compact ? '9px 16px' : '11px 16px' }}>
          <span className={s.rank} data-top={i === 0 ? 'true' : undefined} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {i === 0 ? <Trophy className={s.trophy} aria-label="Number one" /> : i + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <span className={s.rowName}>{x.vertical.name}</span>
              <span className={[s.num, s.points].join(' ')} style={{ fontSize: 'var(--fs-sm)' }}>
                {fmtInt(x.score)}
              </span>
            </div>
            <div style={{ display: 'flex', marginTop: 6 }}>
              <Bar value={x.score / max} tone={i === 0 ? 'accent' : 'muted'} height={5} />
            </div>
            {!compact && (
              <div className={s.rowSub} style={{ marginTop: 5 }}>
                {fmtInt(x.value.hoursSaved30d)} h · {fmtEuro(x.value.euroSaved30d)} · KPIs {x.kpiHits}/{x.kpiTotal} · adoption {fmtPct(x.adoption, 0)}
              </div>
            )}
          </div>
          <ArrowUpRight size={14} style={{ color: 'var(--text-subtle)', flex: 'none' }} />
        </a>
      ))}
    </div>
  );
}

/** Full table for the teams page. */
export function VerticalTable({ companyId, highlightId }: { companyId: string; highlightId?: string }) {
  const scores = verticalScores(companyId);
  const max = Math.max(1, ...scores.map((x) => x.score));
  if (!scores.length) return <div className={s.empty} style={{ padding: '12px 16px' }}>No live vertical yet.</div>;
  return (
    <div className={s.scrollX}>
      <table className={s.table}>
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>Vertical</th>
            <th style={{ minWidth: 160 }}>Score</th>
            <th className={s.num}>Hours saved</th>
            <th className={s.num}>Euro saved</th>
            <th className={s.num}>Tokens</th>
            <th className={s.num}>KPIs hit</th>
            <th className={s.num}>Adoption</th>
            <th className={s.num}>Points</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((x: VerticalScore, i) => {
            const team = teamOf(x.vertical);
            return (
              <tr key={x.vertical.id} data-me={highlightId === x.vertical.id ? 'true' : undefined}>
                <td>
                  <span className={s.rank} data-top={i === 0 ? 'true' : undefined} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i === 0 ? <Trophy className={s.trophy} aria-label="Number one" /> : i + 1}
                  </span>
                </td>
                <td>
                  <a href={`/teams/${x.vertical.id}`} className={s.person}>
                    <div style={{ minWidth: 0 }}>
                      <b>{x.vertical.name}</b>
                      <span>
                        {team.length} {team.length === 1 ? 'person' : 'people'} · {x.vertical.workflowIds.length} workflows
                      </span>
                    </div>
                  </a>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Bar value={x.score / max} tone={i === 0 ? 'accent' : 'muted'} height={6} />
                    <span className={[s.num, s.points].join(' ')} style={{ width: 44 }}>
                      {fmtInt(x.score)}
                    </span>
                  </div>
                </td>
                <td className={s.num}>{fmtInt(x.value.hoursSaved30d)} h</td>
                <td className={s.num}>{fmtEuro(x.value.euroSaved30d)}</td>
                <td className={s.num} style={{ color: 'var(--text-muted)' }}>
                  {x.value.tokens30d ? fmtCompact(x.value.tokens30d) : '0'}
                </td>
                <td className={s.num} style={{ color: x.kpiTotal && x.kpiHits === x.kpiTotal ? 'var(--success-fg)' : undefined }}>
                  {x.kpiHits}/{x.kpiTotal}
                </td>
                <td className={s.num}>{fmtPct(x.adoption, 0)}</td>
                <td className={s.num}>{fmtInt(x.points)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The top three verticals, number one in the middle and taller. */
export function Podium({ companyId }: { companyId: string }) {
  const scores = verticalScores(companyId).slice(0, 3);
  if (!scores.length) return null;
  const order = scores.length === 3 ? [scores[1]!, scores[0]!, scores[2]!] : scores;
  return (
    <div className={s.podium} style={scores.length < 3 ? { gridTemplateColumns: `repeat(${scores.length}, minmax(0, 1fr))` } : undefined}>
      {order.map((x) => {
        const place = scores.indexOf(x) + 1;
        const manager = x.vertical.managerId ? USERS.find((u) => u.id === x.vertical.managerId) : undefined;
        return (
          <a key={x.vertical.id} href={`/teams/${x.vertical.id}`} className={s.podiumSpot} data-place={place}>
            <span className={s.arrow} aria-hidden="true">
              <ArrowUpRight />
            </span>
            <span className={s.place} data-place={place}>
              {place}
            </span>
            <div className={s.podiumName}>
              {place === 1 && <Trophy aria-label="Number one" />}
              <span className="truncate">{x.vertical.name}</span>
            </div>
            <div className={s.podiumScore}>
              {fmtInt(x.score)}
              <small>points</small>
            </div>
            <div className={s.podiumMeta}>
              <span>{fmtInt(x.value.hoursSaved30d)} h saved</span>
              <span>{fmtEuro(x.value.euroSaved30d)}</span>
              <span>
                KPIs {x.kpiHits}/{x.kpiTotal}
              </span>
            </div>
            <div className={s.podiumFoot}>
              {manager ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Avatar user={manager} size={18} /> {manager.name}
                </span>
              ) : (
                <span>No Head of AI yet</span>
              )}
              <span>adoption {fmtPct(x.adoption, 0)}</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
