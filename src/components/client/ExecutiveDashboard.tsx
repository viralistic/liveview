import { useMemo, useState } from 'react';
import { ArrowRight, Check, Clock, Compass, Cpu, Download, Euro, Flame, Gauge, Layers, Megaphone, RotateCcw, SlidersHorizontal, TrendingUp, Trophy, X } from 'lucide-react';
import type { Company, ScopeItem, Vertical, Workflow } from '../../data/types';
import { COMPANIES } from '../../data/companies';
import { USERS } from '../../data/users';
import { WORKFLOWS } from '../../data/workflows';
import { PHASES, phaseIndex, projectFor } from '../../data/projects';
import { VERTICAL_STATUS_LABEL, kpiHit, kpisFor, verticalsFor } from '../../data/verticals';
import { companyCost, companyRoi, companyValue, dailyValueSeries, verticalScores, verticalValue, type ValueSummary, type VerticalScore } from '../../lib/value';
import { fmtCompact, fmtEuro, fmtInt, fmtPct, greeting, NOW } from '../../lib/format';
import { upcomingFor } from '../../lib/today';
import { ComeBack } from '../ui/ComeBack';
import { toast, useSession } from '../../stores/session';
import { openAsk } from '../../stores/planner';
import { resolveOrder, useTileOrder } from '../../stores/client';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Bars } from '../ui/Sparkline';
import p from '../pages/pages.module.css';
import { Bar, Stat, TileBody, TileGrid, TileHead, type TileDef } from './Tiles';
import { TokenCounter } from './TokenCounter';
import { KpiCard, ModelBreakdown, TripleBars, tripleMax } from './ValueCharts';
import { VerticalBoard } from './Leaderboard';
import { AiScan } from './AiScan';
import { firstName, partnerContact, shortDate } from './util';
import s from './client.module.css';

/**
 * The Head of AI Ecosystem sees the whole company in one eyesight: time
 * saved, money saved, ROI, tokens, every vertical, the agreed KPIs, the
 * roadmap and an AI scan. Tiles can be dragged into any order; the order
 * is remembered per person.
 */
type StatId = 'time' | 'money' | 'roi' | 'net';

export function ExecutiveDashboard() {
  const { user: me, userId, can } = useSession();
  const company = COMPANIES.find((c) => c.id === me.companyId) ?? COMPANIES[0]!;
  const companyId = company.id;
  const wfs = useMemo(() => WORKFLOWS.filter((w) => w.companyId === companyId), [companyId]);
  const value = useMemo(() => companyValue(companyId), [companyId]);
  const cost = useMemo(() => companyCost(companyId), [companyId]);
  const roi = useMemo(() => companyRoi(companyId), [companyId]);
  const series = useMemo(() => dailyValueSeries(wfs), [wfs]);
  const scores = useMemo(() => verticalScores(companyId), [companyId]);
  const live = verticalsFor(companyId).filter((v) => v.status === 'live');
  const kpis = kpisFor(companyId);
  const breaking = useMemo(() => wfs.filter((w) => w.issues.some((i) => i.severity === 'critical')), [wfs]);
  const upcoming = useMemo(() => upcomingFor([companyId], [], undefined, 14).slice(0, 2), [companyId]);
  const [customize, setCustomize] = useState(false);
  const [detail, setDetail] = useState<StatId | null>(null);
  const [saved, setSaved] = useTileOrder(userId);
  const dailyCost = cost.total / 30;

  const pick = (e: React.MouseEvent<HTMLAnchorElement>, id: StatId) => {
    e.preventDefault();
    setDetail(id);
    requestAnimationFrame(() => document.getElementById('detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const statLink = (id: StatId, node: React.ReactNode) => (
    <a href="#detail" className={s.statLink} data-active={detail === id ? 'true' : undefined} onClick={(e) => pick(e, id)} aria-label={`More about ${id === 'roi' ? 'return on investment' : id === 'net' ? 'net value' : id === 'time' ? 'time saved' : 'money saved'}`}>
      {node}
    </a>
  );

  const stats: TileDef[] = [
    {
      id: 'time',
      label: 'Time saved',
      node: statLink(
        'time',
        <Stat
          label="Time saved"
          icon={<Clock />}
          value={fmtInt(value.hoursSaved30d)}
          unit="h"
          sub={
            <>
              <b>{fmtInt(value.hoursSavedTotal)} h</b> since go-live
            </>
          }
          spark={series.hours}
        />,
      ),
    },
    {
      id: 'money',
      label: 'Money saved',
      node: statLink(
        'money',
        <Stat
          label="Money saved"
          icon={<Euro />}
          value={fmtEuro(value.euroSaved30d)}
          sub={
            <>
              <b>{fmtEuro(value.euroSavedTotal)}</b> since go-live
            </>
          }
          spark={series.euro}
        />,
      ),
    },
    {
      id: 'roi',
      label: 'Return on investment',
      node: statLink(
        'roi',
        <Stat
          label="Return"
          icon={<Gauge />}
          value={`${roi.multiple.toFixed(1)}x`}
          good={roi.multiple >= 1}
          sub={
            <>
              on <b>{fmtEuro(cost.total)}</b> a month
            </>
          }
        />,
      ),
    },
    {
      id: 'net',
      label: 'Net value',
      node: statLink(
        'net',
        <Stat label="Net value" icon={<TrendingUp />} value={fmtEuro(roi.net)} sub="after cost" spark={series.euro.map((e) => Math.max(0, e - dailyCost))} />,
      ),
    },
  ];

  const tiles: TileDef[] = [
    { id: 'tokens', span: 2, label: 'Tokens', node: <TokensTile value={value} wfs={wfs} daily={series.tokens} /> },
    { id: 'verticals', span: 2, label: 'Per vertical', node: <VerticalsTile companyId={companyId} /> },
    ...kpis.map<TileDef>((k) => ({ id: `kpi:${k.id}`, label: k.label, node: <KpiCard kpi={k} showVertical /> })),
    {
      id: 'board',
      span: 2,
      label: 'Verticals leaderboard',
      node: (
        <>
          <TileHead
            title="Verticals leaderboard"
            icon={<Trophy />}
            action={
              <a href="/teams" className={s.hint}>
                All teams <ArrowRight />
              </a>
            }
          />
          <TileBody flush>
            <VerticalBoard companyId={companyId} />
          </TileBody>
        </>
      ),
    },
    { id: 'roadmap', span: 2, label: 'Roadmap', node: <RoadmapTile companyId={companyId} /> },
    { id: 'scan', span: 2, label: 'AI scan', node: <AiScan companyId={companyId} workflows={wfs} /> },
  ];
  const defaults = tiles.map((t) => t.id);
  const order = resolveOrder(saved, defaults);

  return (
    <div className={s.page}>
      <div className={s.hero}>
        <div style={{ minWidth: 0 }}>
          <div className={s.eyebrow}>{NOW.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })}</div>
          <h1 className={s.greeting}>
            {greeting()}, {firstName(me)}
          </h1>
          <p className={p.intro}>How automation performs for {company.shortName}, in one eyesight: time, money, tokens and the road ahead.</p>
          <div className={p.today}>
            <span className={p.todayIcon} data-tone={breaking.length ? 'critical' : 'calm'}>
              {breaking.length ? <Flame /> : <Check />}
            </span>
            <span>
              {breaking.length ? (
                <>
                  <b>
                    {breaking.length} {breaking.length === 1 ? 'workflow is' : 'workflows are'} breaking:
                  </b>{' '}
                  {breaking.map((w, idx) => (
                    <span key={w.id}>
                      {idx > 0 && (idx === breaking.length - 1 ? ' and ' : ', ')}
                      {can('view-canvas') ? <a href={`/workflows/canvas?focus=${w.id}`}>{w.name}</a> : w.name}
                    </span>
                  ))}
                  . Viralistic is on it.
                </>
              ) : (
                <b>No decisions needed today.</b>
              )}{' '}
              {company.shortName} saved <b>{fmtInt(value.hoursSaved30d)} h</b> and <b>{fmtEuro(value.euroSaved30d)}</b> in 30 days across {live.length} {live.length === 1 ? 'vertical' : 'verticals'}, <b>{roi.multiple.toFixed(1)}x</b> on cost.
              <ComeBack items={upcoming} company={false} />
            </span>
          </div>
        </div>
        <div className={s.actions}>
          <Button variant="primary" onClick={() => openAsk({ companyId, assigneeId: partnerContact(companyId, 'process') })}>
            <Megaphone /> Escalate to Viralistic
          </Button>
          <Button variant="secondary" onClick={() => toast('Report sent')}>
            <Download /> Export
          </Button>
          <Button variant={customize ? 'brand' : 'ghost'} aria-pressed={customize} onClick={() => setCustomize((v) => !v)}>
            <SlidersHorizontal /> {customize ? 'Done' : 'Customize'}
          </Button>
          {customize && (
            <Button
              variant="ghost"
              onClick={() => {
                setSaved(null);
                toast('Layout reset');
              }}
            >
              <RotateCcw /> Reset layout
            </Button>
          )}
        </div>
      </div>

      <div className={s.statsWrap}>
        <TileGrid tiles={stats} order={stats.map((t) => t.id)} />
      </div>

      {detail && <StatDetail id={detail} company={company} value={value} cost={cost} roi={roi} series={series} scores={scores} onClose={() => setDetail(null)} />}

      {customize && <div className={s.hint}>Drag a tile by its handle, or anywhere on the tile, to a new place. Arrow keys on a handle move it one step. The layout is saved for you.</div>}

      <TileGrid tiles={tiles} order={order} onReorder={setSaved} customize={customize} />
    </div>
  );
}

/** A bit more about one headline number, opened by clicking its tile. */
function StatDetail({ id, company, value, cost, roi, series, scores, onClose }: { id: StatId; company: Company; value: ValueSummary; cost: ReturnType<typeof companyCost>; roi: ReturnType<typeof companyRoi>; series: ReturnType<typeof dailyValueSeries>; scores: VerticalScore[]; onClose: () => void }) {
  const dailyCost = cost.total / 30;
  const perVertical = (pickVal: (v: ValueSummary) => number, fmt: (n: number) => string) => {
    const max = Math.max(1, ...scores.map((x) => pickVal(x.value)));
    return (
      <div className={s.detailBars}>
        {scores.map((x) => (
          <a key={x.vertical.id} href={`/teams/${x.vertical.id}`} className={s.detailBar}>
            <span className={s.detailBarName}>{x.vertical.name}</span>
            <Bar value={pickVal(x.value) / max} tone="accent" />
            <b>{fmt(pickVal(x.value))}</b>
          </a>
        ))}
      </div>
    );
  };
  const costRows = [
    { label: 'Partner fee', v: cost.partner, tone: 'muted' as const },
    { label: 'Platform', v: cost.platform, tone: 'muted' as const },
    { label: 'Model tokens', v: cost.tokens, tone: 'muted' as const },
    { label: 'Saved', v: roi.saved, tone: 'good' as const },
  ];
  const costMax = Math.max(1, ...costRows.map((r) => r.v));
  const breakEven = Math.min(30, Math.round((cost.total / Math.max(1, roi.saved)) * 30));

  const content: Record<StatId, { title: string; sub: string; facts: [string, string][]; chart: React.ReactNode }> = {
    time: {
      title: 'Time saved, per vertical',
      sub: 'Runs that replaced manual work, times the minutes each run used to take.',
      facts: [
        ['Runs, 30 days', fmtInt(value.runs30d)],
        ['Per working day', `${fmtInt(value.hoursSaved30d / 22)} h`],
        ['Live since', shortDate(company.onboardedAt)],
      ],
      chart: perVertical((v) => v.hoursSaved30d, (n) => `${fmtInt(n)} h`),
    },
    money: {
      title: 'Money saved, per vertical',
      sub: `Hours saved at the agreed rate of ${fmtEuro(company.hourlyRate)} an hour.`,
      facts: [
        ['Hours saved', `${fmtInt(value.hoursSaved30d)} h`],
        ['Hourly rate', `${fmtEuro(company.hourlyRate)} / h`],
        ['Since go-live', fmtEuro(value.euroSavedTotal)],
      ],
      chart: perVertical((v) => v.euroSaved30d, fmtEuro),
    },
    roi: {
      title: 'What it costs, what it returns',
      sub: 'Partner, platform and model tokens together, against the value saved in the same month.',
      facts: [
        ['Cost per month', fmtEuro(cost.total)],
        ['Saved per month', fmtEuro(roi.saved)],
        ['Return', `${roi.multiple.toFixed(1)}x`],
      ],
      chart: (
        <div className={s.detailBars}>
          {costRows.map((r) => (
            <div key={r.label} className={s.detailBar}>
              <span className={s.detailBarName}>{r.label}</span>
              <Bar value={r.v / costMax} tone={r.tone} />
              <b>{fmtEuro(r.v)}</b>
            </div>
          ))}
        </div>
      ),
    },
    net: {
      title: 'Net value, day by day',
      sub: 'Value saved each day minus that day’s share of the monthly cost.',
      facts: [
        ['Every euro returns', fmtEuro(roi.multiple)],
        ['Break-even', `day ${breakEven} of the month`],
        ['Net per day', fmtEuro(roi.net / 30)],
      ],
      chart: (
        <div className={s.detailChart}>
          <Bars data={series.euro.map((e) => Math.max(0, e - dailyCost))} width={420} height={64} color="var(--success)" gap={3} radius={2} />
          <div className={s.detailAxis}>
            <span>30 days ago</span>
            <span>today</span>
          </div>
        </div>
      ),
    },
  };
  const c = content[id];
  return (
    <section id="detail" className={[s.detail, p.section].join(' ')} aria-live="polite">
      <div className={s.detailHead}>
        <div style={{ minWidth: 0 }}>
          <div className={s.detailTitle}>{c.title}</div>
          <div className={s.detailSub}>{c.sub}</div>
        </div>
        <button type="button" className={s.detailClose} onClick={onClose} aria-label="Close">
          <X />
        </button>
      </div>
      <div className={s.detailBody}>
        <dl className={s.facts}>
          {c.facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div style={{ minWidth: 0, flex: 1 }}>{c.chart}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Tiles with more inside than one number.                               */
/* ------------------------------------------------------------------ */
function TokensTile({ value, wfs, daily }: { value: ValueSummary; wfs: Workflow[]; daily: number[] }) {
  const peak = Math.max(0, ...daily);
  return (
    <>
      <TileHead
        title="Tokens"
        icon={<Cpu />}
        action={
          <span className={s.live}>
            <i /> live
          </span>
        }
      />
      <TileBody>
        <TokenCounter base={value.tokensTotal} perSecond={value.tokensPerSecond} />
        <div className={s.sub}>since go-live · {fmtCompact(value.tokensPerSecond * 3600)} per hour</div>
        <div className={s.minis}>
          <div className={s.mini}>
            <b>{fmtCompact(value.tokens30d)}</b>
            <span>this month</span>
          </div>
          <div className={s.mini}>
            <b>{fmtEuro(value.tokenCost30d)}</b>
            <span>model cost</span>
          </div>
          <div className={s.mini}>
            <b>
              {value.modelWorkflows}
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 450, color: 'var(--text-subtle)' }}>/{value.workflows}</span>
            </b>
            <span>call a model</span>
          </div>
        </div>
        <ModelBreakdown wfs={wfs} />
        {peak > 0 && (
          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <div className={s.scopeHead} style={{ marginTop: 0, marginBottom: 8 }}>
              <span>Tokens per day, 30 days</span>
              <span>
                peak <b>{fmtCompact(peak)}</b>
              </span>
            </div>
            <Bars data={daily} width={520} height={56} color="var(--track-strong)" gap={3} radius={2} />
          </div>
        )}
      </TileBody>
    </>
  );
}

function VerticalsTile({ companyId }: { companyId: string }) {
  const verticals = verticalsFor(companyId);
  const scores = verticalScores(companyId);
  const rows = verticals.map((v) => {
    const val = verticalValue(v);
    const kpis = kpisFor(companyId, v.id);
    return { v, triple: { tokens: val.tokens30d, hours: val.hoursSaved30d, euro: val.euroSaved30d }, hits: kpis.filter(kpiHit).length, total: kpis.length, adoption: scores.find((x) => x.vertical.id === v.id)?.adoption };
  });
  const max = tripleMax(rows.map((r) => r.triple));
  return (
    <>
      <TileHead
        title="Per vertical"
        icon={<Layers />}
        action={
          <a href="/teams" className={s.hint}>
            Teams <ArrowRight />
          </a>
        }
      />
      <TileBody flush>
        <div className={s.rows}>
          {rows.map(({ v, triple, hits, total, adoption }) => (
            <div key={v.id} className={s.row} style={{ alignItems: 'flex-start' }}>
              <div style={{ width: 150, flex: 'none', minWidth: 0 }}>
                <a href={`/teams/${v.id}`} className={s.rowName} style={{ display: 'block' }}>
                  {v.name}
                </a>
                <div style={{ marginTop: 5 }}>
                  <Badge tone={v.status === 'live' ? 'success' : 'neutral'} dot size="sm">
                    {VERTICAL_STATUS_LABEL[v.status]}
                  </Badge>
                </div>
                <div className={s.rowSub} style={{ marginTop: 6 }}>
                  {total ? `${hits}/${total} KPIs` : 'No KPI yet'}
                  {adoption !== undefined ? ` · adoption ${fmtPct(adoption, 0)}` : ''}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {v.status === 'live' ? <TripleBars value={triple} max={max} /> : <div className={s.empty}>{v.status === 'onboarding' ? `Onboarding since ${v.onboardedAt ? shortDate(v.onboardedAt) : 'recently'}` : 'Planned'}</div>}
              </div>
            </div>
          ))}
        </div>
      </TileBody>
    </>
  );
}

function RoadmapTile({ companyId }: { companyId: string }) {
  const project = projectFor(companyId);
  const company = COMPANIES.find((c) => c.id === companyId);
  if (!project) {
    return (
      <>
        <TileHead title="Roadmap" icon={<Compass />} />
        <TileBody>
          <div className={s.empty}>No project yet.</div>
        </TileBody>
      </>
    );
  }
  const current = phaseIndex(project.phase);
  const delivered = project.scope.filter((x) => x.status === 'delivered').length;
  const groups: { key: string; name: string; items: ScopeItem[] }[] = [];
  for (const item of project.scope) {
    const key = item.verticalId ?? 'company';
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const v: Vertical | undefined = item.verticalId ? verticalsFor(companyId).find((x) => x.id === item.verticalId) : undefined;
      g = { key, name: v?.name ?? 'Company wide', items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }
  const steps = project.nextSteps;
  const firstOpen = steps.findIndex((st) => !st.done);
  return (
    <>
      <TileHead
        title="Roadmap"
        icon={<Compass />}
        sub={`${PHASES[current]?.label ?? project.phase} since ${shortDate(project.phaseSince)}`}
        action={
          company ? (
            <a href={`/companies/${company.slug}`} className={s.hint}>
              Project <ArrowRight />
            </a>
          ) : undefined
        }
      />
      <TileBody>
        <div className={[p.roadmap, s.flatRoadmap].join(' ')} aria-label="Project trajectory">
          {PHASES.map((ph, i) => {
            const state = i < current ? 'done' : i === current ? 'current' : 'todo';
            return (
              <div key={ph.id} className={p.phase} data-state={state} title={ph.description} style={{ minWidth: 64 }}>
                <span className={p.phaseDot}>{state === 'done' ? <Check /> : i + 1}</span>
                <span className={p.phaseLabel}>{ph.label}</span>
              </div>
            );
          })}
        </div>
        <div className={s.scopeHead}>
          <span>Agreed scope</span>
          <span>
            <b>
              {delivered} of {project.scope.length}
            </b>{' '}
            delivered
          </span>
        </div>
        <div style={{ display: 'flex', marginTop: 6 }}>
          <Bar value={project.scope.length ? delivered / project.scope.length : 0} tone="good" height={6} />
        </div>
        <div className={s.scopeCols}>
          <div className={s.scopeGroups}>
            {groups.map((g) => (
              <div key={g.key} className={s.scopeGroup}>
                <h4>
                  <span className="truncate">{g.name}</span>
                  <span>
                    {g.items.filter((x) => x.status === 'delivered').length}/{g.items.length}
                  </span>
                </h4>
                {g.items.map((item) => (
                  <div key={item.id} className={s.scopeItem} data-status={item.status} title={item.status === 'delivered' && item.deliveredAt ? `Delivered ${shortDate(item.deliveredAt)}` : item.status === 'in-progress' ? 'In progress' : `Planned, agreed ${shortDate(item.agreedAt)}`}>
                    <span className={s.mark} data-status={item.status}>
                      {item.status === 'delivered' && <Check strokeWidth={3} />}
                    </span>
                    <span>{item.title}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className={s.scopeGroup}>
            <h4>
              <span>Progress and next steps</span>
              <span>{steps.filter((st) => !st.done).length} open</span>
            </h4>
            <div className={s.steps}>
              {steps.map((st, i) => {
                const owner = USERS.find((u) => u.id === st.ownerId);
                return (
                  <div key={`${st.title}-${i}`} className={s.step} data-first={i === firstOpen ? 'true' : undefined} data-done={st.done ? 'true' : undefined}>
                    {owner && <Avatar user={owner} size={20} title={`${owner.name} owns this`} />}
                    <b>{st.title}</b>
                    <time dateTime={st.at}>{shortDate(st.at)}</time>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </TileBody>
    </>
  );
}
