import { SEVERITY_RANK, type Severity, type Workflow } from '../data/types';
import { WORKFLOWS } from '../data/workflows';

/** Worst severity among a workflow's issues. */
export function worstSeverity(wf: Workflow): Severity | null {
  let worst: Severity | null = null;
  for (const i of wf.issues) if (!worst || SEVERITY_RANK[i.severity] > SEVERITY_RANK[worst]) worst = i.severity;
  return worst;
}

/** 0..100 health score. Deliberately simple and explainable. */
export function workflowHealth(wf: Workflow): number {
  let score = 100;
  for (const i of wf.issues) score -= i.severity === 'critical' ? 38 : i.severity === 'inefficient' ? 14 : 5;
  score -= Math.round((1 - wf.stats.successRate) * 100 * 0.6);
  if (wf.stats.lastStatus === 'error') score -= 6;
  return Math.max(0, Math.min(100, score));
}

export function companyHealth(companyId: string): number {
  const wfs = WORKFLOWS.filter((w) => w.companyId === companyId && w.active);
  if (!wfs.length) return 100;
  // weight by traffic so a failing high-volume flow matters more
  const total = wfs.reduce((a, w) => a + Math.max(1, w.stats.runs7d), 0);
  const s = wfs.reduce((a, w) => a + workflowHealth(w) * Math.max(1, w.stats.runs7d), 0) / total;
  return Math.round(s);
}

export function orgHealth(): number {
  const active = WORKFLOWS.filter((w) => w.active);
  const total = active.reduce((a, w) => a + Math.max(1, w.stats.runs7d), 0);
  return Math.round(active.reduce((a, w) => a + workflowHealth(w) * Math.max(1, w.stats.runs7d), 0) / total);
}

export function healthTone(score: number): 'good' | 'warn' | 'bad' {
  return score >= 85 ? 'good' : score >= 60 ? 'warn' : 'bad';
}

/** Canvas-only hues. Dashboard pages use neutral markers (see SeverityIcon). */
export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'var(--heat-critical)',
  inefficient: 'var(--heat-inefficient)',
  minor: 'var(--heat-minor)',
};
/** Opaque hex fallbacks for SVG/canvas contexts that cannot read CSS vars. */
export const SEVERITY_HEX: Record<Severity, string> = {
  critical: '#ef4444',
  inefficient: '#f97316',
  minor: '#a3a3a3',
};

/** Pink when low (blended out), fluorescent when full. */
export function healthColor(score: number): string {
  if (score >= 90) return 'var(--health-full)';
  if (score >= 70) return 'var(--health-mid)';
  return 'var(--health-low)';
}
/** Short human label for a severity, without colour. */
export const SEVERITY_WORD: Record<Severity, string> = { critical: 'Breaking', inefficient: 'Wasteful', minor: 'Tip' };

export function aggregateSeries(wfs: Workflow[]): { runs: number[]; failures: number[] } {
  const runs = new Array(28).fill(0);
  const failures = new Array(28).fill(0);
  for (const w of wfs) {
    w.stats.series7d.forEach((v, i) => (runs[i] += v));
    w.stats.failures7d.forEach((v, i) => (failures[i] += v));
  }
  return { runs, failures };
}
