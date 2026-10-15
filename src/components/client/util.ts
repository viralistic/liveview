import { Bug, Clock, Coffee, Flame, HeartHandshake, Hourglass, Play, Rocket, Sun, Target, Ticket, Trophy, Utensils, type LucideIcon } from 'lucide-react';
import type { BadgeId, User, Vertical } from '../../data/types';
import { USERS } from '../../data/users';
import { projectFor } from '../../data/projects';
import { leaderboard } from '../../data/verticals';
import { verticalScores } from '../../lib/value';
import { fmtInt } from '../../lib/format';

/** Lucide icons for badges and rewards (data names them, this maps them). */
export const BADGE_ICON: Record<BadgeId, LucideIcon> = {
  'first-run': Play,
  'early-adopter': Rocket,
  'streak-4': Flame,
  'streak-12': Flame,
  'saver-50': Clock,
  'saver-200': Hourglass,
  'kpi-crusher': Target,
  'bug-spotter': Bug,
  mentor: HeartHandshake,
  'top-of-month': Trophy,
};
export const REWARD_ICON: Record<string, LucideIcon> = { coffee: Coffee, lunch: Utensils, halfday: Sun, conference: Ticket, champion: Trophy };

export const firstName = (u: User): string => u.name.split(' ')[0]!;
export const fmtHours = (h: number): string => `${fmtInt(h)} h`;
/** "15 Oct", fixed to the demo time zone so SSR and client agree. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' });
}
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
}

/** Everyone in a vertical: the Head of AI first, then the members. */
export function teamOf(v: Vertical): User[] {
  const ids = [...(v.managerId ? [v.managerId] : []), ...v.memberIds];
  return ids.filter((id, i) => ids.indexOf(id) === i).map((id) => USERS.find((u) => u.id === id)).filter((u): u is User => !!u);
}

/** Where a live vertical stands among the company's live verticals. */
export function verticalRank(companyId: string, verticalId: string): { rank: number; of: number } | undefined {
  const scores = verticalScores(companyId);
  const i = scores.findIndex((s) => s.vertical.id === verticalId);
  return i < 0 ? undefined : { rank: i + 1, of: scores.length };
}

/** Who at the partner answers a question about this company: the technical owner, else the process owner. */
export function partnerContact(companyId: string, kind: 'technical' | 'process' = 'technical'): string | undefined {
  const p = projectFor(companyId);
  if (!p) return undefined;
  return kind === 'technical' ? p.technicalOwnerId ?? p.processOwnerId : p.processOwnerId ?? p.technicalOwnerId;
}

/** Rank movement over the last week: positive means the person moved up. */
export function rankMovement(verticalId: string, userId: string): number {
  const board = leaderboard(verticalId);
  const lastWeek = (m: (typeof board)[number]) => m.points - (m.series12w[m.series12w.length - 1] ?? 0);
  const before = [...board].sort((a, b) => lastWeek(b) - lastWeek(a));
  const now = board.findIndex((m) => m.userId === userId);
  const was = before.findIndex((m) => m.userId === userId);
  return was - now;
}

/** Points earned in the last week. */
export function pointsThisWeek(series12w: number[]): number {
  return series12w[series12w.length - 1] ?? 0;
}
