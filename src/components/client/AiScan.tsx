import { useEffect, useMemo, useState } from 'react';
import { AtSign, Check, Plus, RotateCcw, Sparkles } from 'lucide-react';
import type { Workflow } from '../../data/types';
import { companyById } from '../../data/companies';
import { MODELS, modelById, usageProfile } from '../../data/usage';
import { workflowValue } from '../../lib/value';
import { fmtCompact, fmtEuro, fmtInt, relTime } from '../../lib/format';
import { openAsk } from '../../stores/planner';
import { toast } from '../../stores/session';
import { useScanState } from '../../stores/client';
import { Button } from '../ui/Button';
import { TileBody, TileHead } from './Tiles';
import { clock, partnerContact } from './util';
import s from './client.module.css';

/* ------------------------------------------------------------------ */
/* Findings are derived from the data, deterministically, so the scan   */
/* can be "re-run" and a reload shows the same list.                    */
/* ------------------------------------------------------------------ */
export type FindingGroup = 'time' | 'model' | 'optim';
export const GROUP_LABEL: Record<FindingGroup, string> = { time: 'Time-saving opportunities', model: 'Model updates', optim: 'Optimisation' };
export interface Finding {
  id: string;
  group: FindingGroup;
  title: string;
  detail: string;
  chips: { text: string; tone?: 'good' | 'accent' }[];
  workflowId?: string;
  /** hours per month this would free up */
  hours: number;
  /** euro per month this would save (negative = costs more) */
  euro: number;
}

const WEEKS_PER_MONTH = 52 / 12;
const tier = (id: string) => (/mini|haiku|flash/.test(id) ? 'small' : 'large');
const h1 = (h: number) => (h >= 10 ? fmtInt(h) : h.toFixed(1));

export function scanFindings(companyId: string, wfs: Workflow[]): Finding[] {
  const company = companyById(companyId);
  const rate = company.hourlyRate;
  const out: Finding[] = [];

  /* 1. time: issues the monitoring already priced, plus two derived kinds */
  for (const wf of wfs) {
    for (const i of wf.issues) {
      if (!i.estSavings) continue;
      const hours = ((i.estSavings.minutesPerWeek ?? 0) * WEEKS_PER_MONTH) / 60;
      const euro = (i.estSavings.euroPerMonth ?? 0) + hours * rate;
      const chips: Finding['chips'] = [];
      if (hours) chips.push({ text: `${h1(hours)} h / month`, tone: 'good' });
      if (i.estSavings.runsPerWeek) chips.push({ text: `${fmtCompact(i.estSavings.runsPerWeek)} fewer runs / week` });
      if (euro) chips.push({ text: `${fmtEuro(euro)} / month` });
      out.push({ id: `t-${i.id}`, group: 'time', title: i.action, detail: `${i.impact}. ${i.suggestion}`, chips, workflowId: wf.id, hours, euro });
    }
  }
  const activeRuns = wfs.filter((w) => w.active).map((w) => w.stats.runs7d).sort((a, b) => a - b);
  const typicalRuns = activeRuns.length ? activeRuns[Math.floor(activeRuns.length / 2)]! : 0;
  for (const wf of wfs) {
    if (wf.active) continue;
    const p = usageProfile(wf.id);
    const runs = (wf.stats.runs7d || typicalRuns) * WEEKS_PER_MONTH;
    const hours = (runs * p.minutesSavedPerRun) / 60;
    if (hours < 1) continue;
    out.push({
      id: `t-inactive-${wf.id}`,
      group: 'time',
      title: `Switch on ${wf.name}`,
      detail: `Inactive, last run ${relTime(wf.stats.lastRunAt)}. At the pace of its siblings it would replace ${p.minutesSavedPerRun} minutes of manual work per run.`,
      chips: [
        { text: `≈ ${h1(hours)} h / month`, tone: 'good' },
        { text: `≈ ${fmtEuro(hours * rate)} / month` },
      ],
      workflowId: wf.id,
      hours,
      euro: hours * rate,
    });
  }
  for (const wf of wfs) {
    if (!wf.active || wf.stats.failed7d < 10 || wf.stats.successRate >= 0.97) continue;
    if (wf.issues.some((i) => i.severity === 'critical')) continue; // already on the incident list
    const p = usageProfile(wf.id);
    const hours = (wf.stats.failed7d * WEEKS_PER_MONTH * Math.max(2, p.minutesSavedPerRun)) / 60;
    out.push({
      id: `t-retry-${wf.id}`,
      group: 'time',
      title: `Retry failed runs of ${wf.name}`,
      detail: `${fmtInt(wf.stats.failed7d)} runs failed this week and were finished by hand. Retry on fail with a 2 second wait catches most of them.`,
      chips: [
        { text: `≈ ${h1(hours)} h / month`, tone: 'good' },
        { text: `${fmtInt(wf.stats.failed7d)} failed / week` },
      ],
      workflowId: wf.id,
      hours,
      euro: hours * rate,
    });
  }

  /* 2. model updates: a newer model of the same vendor and size with higher quality */
  for (const wf of wfs) {
    const p = usageProfile(wf.id);
    if (!p.model) continue;
    const v = workflowValue(wf);
    if (!v.tokens30d) continue;
    const cur = modelById(p.model);
    const better = MODELS.filter((m) => m.vendor === cur.vendor && tier(m.id) === tier(cur.id) && m.quality > cur.quality && m.releasedAt > cur.releasedAt).sort((a, b) => b.quality - a.quality)[0];
    if (!better) continue;
    const now = (v.tokens30d / 1_000_000) * cur.pricePerM;
    const next = (v.tokens30d / 1_000_000) * better.pricePerM;
    const delta = next - now;
    out.push({
      id: `m-${wf.id}`,
      group: 'model',
      title: `${wf.name}: ${cur.label} to ${better.label}`,
      detail: `${better.label} was released ${better.releasedAt.slice(0, 4)} and scores ${better.quality} against ${cur.quality} on quality. Same prompts, same nodes, one setting.`,
      chips: [
        { text: `${fmtCompact(v.tokens30d)} tokens / month` },
        delta <= 0 ? { text: `saves ${fmtEuro(-delta)} / month`, tone: 'good' } : { text: `+${fmtEuro(delta)} / month` },
        { text: `quality +${better.quality - cur.quality}`, tone: 'good' },
      ],
      workflowId: wf.id,
      hours: 0,
      euro: -delta,
    });
  }

  /* 3. optimisation: token-wise and quality-wise */
  const modelWfs = wfs.filter((w) => usageProfile(w.id).model && workflowValue(w).tokens30d > 0).sort((a, b) => workflowValue(b).tokens30d - workflowValue(a).tokens30d);
  for (const wf of modelWfs) {
    const p = usageProfile(wf.id);
    const v = workflowValue(wf);
    if (p.tokensPerRun >= 1200) {
      const saved = v.tokenCost30d * 0.3;
      out.push({
        id: `o-cache-${wf.id}`,
        group: 'optim',
        title: `Cache the prompt of ${wf.name}`,
        detail: `${fmtInt(p.tokensPerRun)} tokens per run, most of it the same instructions every time. Prompt caching cuts about 30% of the tokens.`,
        chips: [{ text: `-${fmtCompact(v.tokens30d * 0.3)} tokens / month` }, { text: `saves ${fmtEuro(saved)} / month`, tone: 'good' }],
        workflowId: wf.id,
        hours: 0,
        euro: saved,
      });
    }
    if (p.tokensPerRun >= 5000) {
      const saved = v.tokenCost30d * 0.25;
      out.push({
        id: `o-context-${wf.id}`,
        group: 'optim',
        title: `Shorten the context of ${wf.name}`,
        detail: 'The whole record goes into the prompt. Sending only the fields the model uses trims about a quarter of the tokens.',
        chips: [{ text: `-${fmtCompact(v.tokens30d * 0.25)} tokens / month` }, { text: `saves ${fmtEuro(saved)} / month`, tone: 'good' }],
        workflowId: wf.id,
        hours: 0,
        euro: saved,
      });
    }
    if (wf.stats.runs7d >= 1000) {
      const saved = v.tokenCost30d * 0.15;
      out.push({
        id: `o-batch-${wf.id}`,
        group: 'optim',
        title: `Batch the model calls of ${wf.name}`,
        detail: `${fmtInt(wf.stats.runs7d)} runs a week call the model one at a time. Ten items per call share the instructions and cut overhead tokens by about 15%.`,
        chips: [{ text: `-${fmtCompact(v.tokens30d * 0.15)} tokens / month` }, { text: `saves ${fmtEuro(saved)} / month`, tone: 'good' }],
        workflowId: wf.id,
        hours: 0,
        euro: saved,
      });
    }
  }
  const top = modelWfs[0];
  if (top) {
    const v = workflowValue(top);
    out.push({
      id: `o-eval-${top.id}`,
      group: 'optim',
      title: `Add an evaluation step to ${top.name}`,
      detail: 'Score a 2% sample of the outputs with a second model and alert when quality drops. Catches a bad prompt change before a dealer does.',
      chips: [{ text: `+${fmtCompact(v.tokens30d * 0.02)} tokens / month` }, { text: `+${fmtEuro(v.tokenCost30d * 0.02)} / month` }, { text: 'quality guard', tone: 'accent' }],
      workflowId: top.id,
      hours: 0,
      euro: -v.tokenCost30d * 0.02,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The tile: idle, scanning (animated steps) or the findings list.      */
/* ------------------------------------------------------------------ */
const STEP_MS = 650;

export function AiScan({ companyId, verticalId, workflows }: { companyId: string; verticalId?: string; workflows: Workflow[] }) {
  const [scan, setScan] = useScanState(companyId, verticalId);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const findings = useMemo(() => scanFindings(companyId, workflows), [companyId, workflows]);
  const modelCount = new Set(workflows.map((w) => usageProfile(w.id).model).filter(Boolean)).size;
  const steps = [`Reading ${workflows.length} workflow${workflows.length === 1 ? '' : 's'}`, `Comparing ${modelCount || 'no'} model${modelCount === 1 ? '' : 's'} with ${MODELS.length} available`, 'Estimating time saved', 'Writing findings'];

  useEffect(() => {
    if (!running) return;
    if (step >= steps.length) {
      setScan({ at: new Date().toISOString(), findings: findings.length });
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setStep((n) => n + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [running, step, steps.length, findings.length, setScan]);

  const start = () => {
    setStep(0);
    setRunning(true);
  };
  const again = () => {
    setScan(null);
    start();
  };
  const assignee = partnerContact(companyId, 'technical');
  const hours = findings.reduce((a, f) => a + f.hours, 0);
  const euro = findings.reduce((a, f) => a + Math.max(0, f.euro), 0);
  const groups: FindingGroup[] = ['time', 'model', 'optim'];

  return (
    <>
      <TileHead
        title="AI scan"
        icon={<Sparkles />}
        sub={scan && !running ? `Scanned at ${clock(scan.at)}` : undefined}
        action={
          scan && !running ? (
            <Button size="sm" variant="ghost" onClick={again}>
              <RotateCcw /> Scan again
            </Button>
          ) : undefined
        }
      />
      <TileBody>
        {running ? (
          <div>
            <div className={s.scanSteps}>
              {steps.map((label, i) => {
                const state = i < step ? 'done' : i === step ? 'active' : 'todo';
                return (
                  <div key={label} className={s.scanStep} data-state={state}>
                    <span className={s.scanDot}>{state === 'done' ? <Check strokeWidth={3} /> : state === 'active' ? <Sparkles /> : null}</span>
                    {label}
                  </div>
                );
              })}
            </div>
            <div className={s.scanBar}>
              <i style={{ width: `${Math.min(100, (step / steps.length) * 100)}%` }} />
            </div>
          </div>
        ) : scan ? (
          <div>
            <div className={s.scanSummary}>
              <b>{findings.length} findings</b>
              <span>·</span>
              <span>
                up to <b>{h1(hours)} h</b> and <b>{fmtEuro(euro)}</b> per month
              </span>
            </div>
            {groups.map((g) => {
              const list = findings.filter((f) => f.group === g);
              return (
                <div key={g} className={s.group}>
                  <div className={s.groupHead}>
                    {GROUP_LABEL[g]}
                    <span>{list.length ? list.length : 'none'}</span>
                  </div>
                  {list.length === 0 && <div className={s.empty}>{g === 'model' ? 'Every model is the newest of its kind.' : g === 'time' ? 'Nothing left on the table this month.' : 'No model steps to tune here.'}</div>}
                  {list.map((f) => (
                    <div key={f.id} className={s.finding}>
                      <div style={{ minWidth: 0 }}>
                        <div className={s.findingTitle}>{f.title}</div>
                        <div className={s.findingSub}>
                          {f.workflowId && (
                            <a href={`/workflows/canvas?focus=${f.workflowId}`} style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                              {workflows.find((w) => w.id === f.workflowId)?.name}
                            </a>
                          )}
                          {f.workflowId ? ' · ' : ''}
                          {f.detail}
                        </div>
                        <div className={s.chips}>
                          {f.chips.map((c) => (
                            <span key={c.text} className={s.chip} data-tone={c.tone}>
                              {c.text}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={s.findingActions}>
                        <Button size="sm" variant="secondary" onClick={() => openAsk({ companyId, workflowId: f.workflowId, assigneeId: assignee })}>
                          <AtSign /> Ask Viralistic
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toast(`Added to the roadmap: ${f.title}`)}>
                          <Plus /> Roadmap
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={s.scanIdle}>
            <Button variant="primary" onClick={start}>
              <Sparkles /> Scan for opportunities
            </Button>
          </div>
        )}
      </TileBody>
    </>
  );
}
