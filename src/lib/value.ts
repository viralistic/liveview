import { COMPANIES, companyById } from '../data/companies';
import { WORKFLOWS } from '../data/workflows';
import { VERTICALS, KPIS, kpiHit, leaderboard, verticalsFor } from '../data/verticals';
import { modelById, usageProfile } from '../data/usage';
import type { Vertical, Workflow } from '../data/types';
import { NOW } from './format';
import { seeded } from './rng';

/**
 * Business value, computed from the dummy data so every view agrees:
 * runs × minutes saved = hours saved; hours × hourly rate = money saved;
 * tokens × model price = model cost; ROI = (saved − cost) / cost.
 * All deterministic (seeded), so SSR and client render the same numbers.
 */
export interface ValueSummary {
  runs30d: number;
  hoursSaved30d: number;
  euroSaved30d: number;
  tokens30d: number;
  tokenCost30d: number;
  /** tokens since go-live, for the counter */
  tokensTotal: number;
  hoursSavedTotal: number;
  euroSavedTotal: number;
  /** average tokens per second over the last 30 days, for the live counter */
  tokensPerSecond: number;
  workflows: number;
  modelWorkflows: number;
}

const DAY = 86_400_000;

/** Daily runs for the last `days` days, deterministic per workflow. */
export function dailyRuns(wf: Workflow, days = 30): number[] {
  const rand = seeded(`runs:${wf.id}`);
  const perDay = wf.stats.runs7d / 7;
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const weekday = new Date(NOW.getTime() - (days - 1 - i) * DAY).getDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.45 : 1;
    out.push(Math.round(perDay * weekend * (0.7 + rand() * 0.6)));
  }
  return out;
}
export function dailyTokens(wf: Workflow, days = 30): number[] {
  const p = usageProfile(wf.id);
  if (!p.tokensPerRun) return new Array(days).fill(0);
  const rand = seeded(`tokens:${wf.id}`);
  return dailyRuns(wf, days).map((r) => Math.round(r * p.tokensPerRun * (0.85 + rand() * 0.3)));
}

export function daysLive(wf: Workflow): number {
  const company = companyById(wf.companyId);
  const since = new Date(company.onboardedAt).getTime();
  return Math.max(30, Math.round((NOW.getTime() - since) / DAY));
}

export function workflowValue(wf: Workflow): ValueSummary {
  const p = usageProfile(wf.id);
  const company = companyById(wf.companyId);
  const runs = dailyRuns(wf).reduce((a, b) => a + b, 0);
  const tokens = dailyTokens(wf).reduce((a, b) => a + b, 0);
  const hours = (runs * p.minutesSavedPerRun) / 60;
  const euro = hours * company.hourlyRate;
  const cost = p.model ? (tokens / 1_000_000) * modelById(p.model).pricePerM : 0;
  const live = daysLive(wf);
  const ramp = 0.72; // usage grew over time, so history is a bit lighter than today
  const factor = (live / 30) * ramp;
  return {
    runs30d: runs,
    hoursSaved30d: hours,
    euroSaved30d: euro,
    tokens30d: tokens,
    tokenCost30d: cost,
    tokensTotal: Math.round(tokens * factor),
    hoursSavedTotal: hours * factor,
    euroSavedTotal: euro * factor,
    tokensPerSecond: tokens / (30 * 86_400),
    workflows: 1,
    modelWorkflows: p.model ? 1 : 0,
  };
}

const EMPTY: ValueSummary = { runs30d: 0, hoursSaved30d: 0, euroSaved30d: 0, tokens30d: 0, tokenCost30d: 0, tokensTotal: 0, hoursSavedTotal: 0, euroSavedTotal: 0, tokensPerSecond: 0, workflows: 0, modelWorkflows: 0 };
export function sumValue(items: ValueSummary[]): ValueSummary {
  return items.reduce<ValueSummary>(
    (a, b) => ({
      runs30d: a.runs30d + b.runs30d,
      hoursSaved30d: a.hoursSaved30d + b.hoursSaved30d,
      euroSaved30d: a.euroSaved30d + b.euroSaved30d,
      tokens30d: a.tokens30d + b.tokens30d,
      tokenCost30d: a.tokenCost30d + b.tokenCost30d,
      tokensTotal: a.tokensTotal + b.tokensTotal,
      hoursSavedTotal: a.hoursSavedTotal + b.hoursSavedTotal,
      euroSavedTotal: a.euroSavedTotal + b.euroSavedTotal,
      tokensPerSecond: a.tokensPerSecond + b.tokensPerSecond,
      workflows: a.workflows + b.workflows,
      modelWorkflows: a.modelWorkflows + b.modelWorkflows,
    }),
    EMPTY,
  );
}

export function workflowsValue(wfs: Workflow[]): ValueSummary {
  return sumValue(wfs.map(workflowValue));
}
export function verticalValue(v: Vertical): ValueSummary {
  return workflowsValue(WORKFLOWS.filter((w) => v.workflowIds.includes(w.id)));
}
export function companyValue(companyId: string): ValueSummary {
  return workflowsValue(WORKFLOWS.filter((w) => w.companyId === companyId));
}

/** Monthly cost for a client: partner fee + hosting or license + model tokens. */
export function companyCost(companyId: string): { partner: number; platform: number; tokens: number; total: number } {
  const c = companyById(companyId);
  const tokens = companyValue(companyId).tokenCost30d;
  return { partner: c.monthlyCost.partner, platform: c.monthlyCost.platform, tokens, total: c.monthlyCost.partner + c.monthlyCost.platform + tokens };
}
/** Return on investment over the last 30 days: saved minus cost, divided by cost. */
export function companyRoi(companyId: string): { saved: number; cost: number; net: number; roi: number; multiple: number } {
  const saved = companyValue(companyId).euroSaved30d;
  const cost = companyCost(companyId).total;
  const net = saved - cost;
  return { saved, cost, net, roi: cost ? net / cost : 0, multiple: cost ? saved / cost : 0 };
}

/** Daily series for charts: hours saved, euro saved, tokens. */
export function dailyValueSeries(wfs: Workflow[], days = 30): { hours: number[]; euro: number[]; tokens: number[] } {
  const hours = new Array(days).fill(0);
  const euro = new Array(days).fill(0);
  const tokens = new Array(days).fill(0);
  for (const wf of wfs) {
    const p = usageProfile(wf.id);
    const rate = companyById(wf.companyId).hourlyRate;
    const runs = dailyRuns(wf, days);
    const tok = dailyTokens(wf, days);
    for (let i = 0; i < days; i++) {
      const h = (runs[i]! * p.minutesSavedPerRun) / 60;
      hours[i] += h;
      euro[i] += h * rate;
      tokens[i] += tok[i]!;
    }
  }
  return { hours, euro, tokens };
}

/** Where the tokens go, per model. */
export function tokensByModel(wfs: Workflow[]): { model: string; label: string; tokens: number; cost: number; workflows: number }[] {
  const map = new Map<string, { model: string; label: string; tokens: number; cost: number; workflows: number }>();
  for (const wf of wfs) {
    const p = usageProfile(wf.id);
    if (!p.model) continue;
    const v = workflowValue(wf);
    const def = modelById(p.model);
    const cur = map.get(p.model) ?? { model: p.model, label: def.label, tokens: 0, cost: 0, workflows: 0 };
    cur.tokens += v.tokens30d;
    cur.cost += v.tokenCost30d;
    cur.workflows += 1;
    map.set(p.model, cur);
  }
  return [...map.values()].sort((a, b) => b.tokens - a.tokens);
}

/* ------------------------------------------------------------------ */
/* Vertical leaderboard: verticals compete on value, targets and use.  */
/* ------------------------------------------------------------------ */
export interface VerticalScore {
  vertical: Vertical;
  value: ValueSummary;
  kpiHits: number;
  kpiTotal: number;
  /** share of members active in the last 30 days (members with stats) */
  adoption: number;
  points: number;
  score: number;
}
export function verticalScores(companyId: string): VerticalScore[] {
  return verticalsFor(companyId)
    .filter((v) => v.status === 'live')
    .map((v) => {
      const value = verticalValue(v);
      const kpis = KPIS.filter((k) => k.verticalId === v.id);
      const board = leaderboard(v.id);
      const members = new Set([...(v.managerId ? [v.managerId] : []), ...v.memberIds]);
      const adoption = members.size ? Math.min(1, board.length / members.size) : 0;
      const points = board.reduce((a, m) => a + m.points, 0);
      const hits = kpis.filter(kpiHit).length;
      // score: hours saved weigh most, then KPI targets, then adoption
      const score = Math.round(value.hoursSaved30d * 2 + (kpis.length ? (hits / kpis.length) * 200 : 0) + adoption * 100 + points / 20);
      return { vertical: v, value, kpiHits: hits, kpiTotal: kpis.length, adoption, points, score };
    })
    .sort((a, b) => b.score - a.score);
}

/** Every company's value, for the partner's overview. */
export function allCompaniesValue(): { companyId: string; value: ValueSummary; roi: ReturnType<typeof companyRoi> }[] {
  return COMPANIES.map((c) => ({ companyId: c.id, value: companyValue(c.id), roi: companyRoi(c.id) }));
}

export { VERTICALS };
