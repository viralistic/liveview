import { useMemo, useState } from 'react';
import { ArrowRight, AtSign, Check, Clock, Cpu, Euro, Gift, Layers, Rocket, RotateCcw, SlidersHorizontal, Trophy, Users, Workflow as WorkflowIcon } from 'lucide-react';
import type { Vertical } from '../../data/types';
import { companyById } from '../../data/companies';
import { USERS } from '../../data/users';
import { WORKFLOWS } from '../../data/workflows';
import { productById } from '../../data/products';
import { projectFor } from '../../data/projects';
import { VERTICAL_STATUS_LABEL, kpisFor, leaderboard, verticalById, verticalsFor } from '../../data/verticals';
import { workflowHealth } from '../../lib/health';
import { dailyValueSeries, verticalScores, verticalValue, workflowValue } from '../../lib/value';
import { daysAgo, fmtCompact, fmtEuro, fmtInt, fmtPct, greeting, NOW } from '../../lib/format';
import { toast, useSession } from '../../stores/session';
import { openAsk } from '../../stores/planner';
import { resolveOrder, useTileOrder } from '../../stores/client';
import { Avatar, AvatarGroup } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { HealthRing } from '../ui/HealthRing';
import { NodeIcon } from '../ui/NodeIcon';
import { ProductTag } from '../ui/ProductTag';
import { Bars } from '../ui/Sparkline';
import { PageHeader } from '../pages/shared';
import p from '../pages/pages.module.css';
import { Stat, TileBody, TileGrid, TileHead, type TileDef } from './Tiles';
import { KpiCard, TripleBars, tripleMax } from './ValueCharts';
import { BadgeIcons, RewardProgress, TeamLeaderboard } from './Leaderboard';
import { AiScan } from './AiScan';
import { firstName, partnerContact, shortDate, teamOf, verticalRank } from './util';
import s from './client.module.css';

/** The Head of AI of one vertical: the same dashboard, scoped to their team. */
export function VerticalDashboard() {
  const { user: me } = useSession();
  const vertical = (me.verticalId ? verticalById(me.verticalId) : undefined) ?? verticalsFor(me.companyId)[0];
  if (!vertical) return <PageHeader title="No vertical yet" lede="No vertical onboarded yet." />;
  return vertical.status === 'live' ? <LiveVertical vertical={vertical} /> : <OnboardingVertical vertical={vertical} />;
}

function LiveVertical({ vertical }: { vertical: Vertical }) {
  const { user: me, userId } = useSession();
  const company = companyById(vertical.companyId);
  const wfs = useMemo(() => WORKFLOWS.filter((w) => vertical.workflowIds.includes(w.id)), [vertical]);
  const value = useMemo(() => verticalValue(vertical), [vertical]);
  const series = useMemo(() => dailyValueSeries(wfs), [wfs]);
  const kpis = kpisFor(company.id, vertical.id);
  const rank = verticalRank(company.id, vertical.id);
  const score = verticalScores(company.id).find((x) => x.vertical.id === vertical.id);
  const board = leaderboard(vertical.id);
  const [customize, setCustomize] = useState(false);
  const [saved, setSaved] = useTileOrder(userId);
  const perWf = wfs.map((w) => {
    const v = workflowValue(w);
    return { w, triple: { tokens: v.tokens30d, hours: v.hoursSaved30d, euro: v.euroSaved30d } };
  });
  const max = tripleMax(perWf.map((x) => x.triple));

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
              <b>{fmtInt(value.hoursSavedTotal)} h</b> since go-live
            </>
          }
          spark={series.hours}
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
              <b>{fmtEuro(value.euroSavedTotal)}</b> since go-live
            </>
          }
          spark={series.euro}
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
              <b>{fmtEuro(value.tokenCost30d)}</b> model cost
            </>
          }
          spark={series.tokens}
          hover={
            <>
              <div>
                <span>Since go-live</span>
                <b>{fmtCompact(value.tokensTotal)} tokens</b>
              </div>
              <div>
                <span>Workflows with a model step</span>
                <b>
                  {value.modelWorkflows} of {value.workflows}
                </b>
              </div>
            </>
          }
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
            <>
              <b>{fmtInt(score?.score ?? 0)}</b> points ·{' '}
              <a href="/teams" style={{ color: 'var(--text)', fontWeight: 500 }}>
                leaderboard <ArrowRight size={11} style={{ display: 'inline', verticalAlign: -1 }} />
              </a>
            </>
          }
        />
      ),
    },
    {
      id: 'value',
      span: 2,
      label: 'Tokens vs time vs money',
      node: (
        <>
          <TileHead title="Tokens vs time vs money" icon={<Layers />} sub="per workflow" />
          <TileBody flush>
            <div className={s.rows}>
              {perWf.map(({ w, triple }) => (
                <div key={w.id} className={s.row} style={{ alignItems: 'flex-start' }}>
                  <div style={{ width: 150, flex: 'none', minWidth: 0 }}>
                    <a href={`/workflows/canvas?focus=${w.id}`} className={s.rowName} style={{ display: 'block' }}>
                      {w.name}
                    </a>
                    <div className={s.rowSub}>{w.trigger.label}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <TripleBars value={triple} max={max} />
                  </div>
                </div>
              ))}
            </div>
          </TileBody>
        </>
      ),
    },
    {
      id: 'workflows',
      span: 2,
      label: 'Workflows',
      node: (
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
                      {w.active ? `${fmtInt(w.stats.runs7d)} runs this week` : 'Inactive'} · {fmtPct(w.stats.successRate, 0)} success
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
      ),
    },
    ...kpis.map<TileDef>((k) => ({ id: `kpi:${k.id}`, label: k.label, node: <KpiCard kpi={k} /> })),
    {
      id: 'board',
      span: 2,
      label: 'Team leaderboard',
      node: (
        <>
          <TileHead
            title="Team leaderboard"
            icon={<Users />}
            sub={`${board.length} people · ${fmtInt(board.reduce((a, m) => a + m.points, 0))} points together`}
            action={
              <a href={`/teams/${vertical.id}`} className={s.hint}>
                Team page <ArrowRight />
              </a>
            }
          />
          <TileBody flush>
            <TeamLeaderboard verticalId={vertical.id} highlightId={me.id} compact />
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
          <TileHead title="Next rewards" icon={<Gift />} />
          <TileBody flush>
            <RewardProgress verticalId={vertical.id} />
          </TileBody>
        </>
      ),
    },
    { id: 'scan', span: 2, label: 'AI scan', node: <AiScan companyId={company.id} verticalId={vertical.id} workflows={wfs} /> },
  ];
  const defaults = tiles.map((t) => t.id);
  const order = resolveOrder(saved, defaults);

  return (
    <div className={s.page}>
      <div className={s.hero}>
        <div style={{ minWidth: 0 }}>
          <div className={s.eyebrow}>
            {NOW.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })} · {vertical.label}
          </div>
          <h1 className={s.greeting}>
            {greeting()}, {firstName(me)}
          </h1>
          <div className={s.line}>
            <span>{vertical.name} saved</span>
            <a href="#tile-time" className={s.pill}>
              {fmtInt(value.hoursSaved30d)} h
            </a>
            <span>and</span>
            <a href="#tile-money" className={s.pill}>
              {fmtEuro(value.euroSaved30d)}
            </a>
            <span>in 30 days</span>
            {rank && (
              <>
                <span>·</span>
                <a href="/teams" className={s.pill}>
                  {rank.rank === 1 && <Trophy />}#{rank.rank} of {rank.of} verticals <ArrowRight />
                </a>
              </>
            )}
          </div>
        </div>
        <div className={s.actions}>
          <Button variant="primary" onClick={() => openAsk({ companyId: company.id, assigneeId: partnerContact(company.id, 'process') })}>
            <AtSign /> Ask Viralistic
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
      <TileGrid tiles={tiles} order={order} onReorder={setSaved} customize={customize} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A vertical that is onboarding or planned: what is coming.            */
/* ------------------------------------------------------------------ */
const ONBOARDING_STAGES = ['Kick-off', 'Build', 'Test', 'Live'];

function OnboardingVertical({ vertical }: { vertical: Vertical }) {
  const { user: me } = useSession();
  const company = companyById(vertical.companyId);
  const project = projectFor(company.id);
  const products = vertical.plannedProductIds.map((id) => productById(id)).filter((x): x is NonNullable<typeof x> => !!x);
  const kpis = kpisFor(company.id, vertical.id);
  const team = teamOf(vertical);
  const scope = project?.scope.filter((x) => x.verticalId === vertical.id) ?? [];
  const kickoff =
    project?.nextSteps.find((st) => !st.done && (st.title.toLowerCase().includes(vertical.name.toLowerCase()) || st.ownerId === vertical.managerId)) ??
    { title: `${vertical.name} kick-off workshop`, at: daysAgo(-14), ownerId: partnerContact(company.id, 'process') ?? 'u-marrallisa' };
  const owner = USERS.find((u) => u.id === kickoff.ownerId);
  const stage = vertical.status === 'onboarding' ? 0 : -1;

  const tiles: TileDef[] = [
    {
      id: 'status',
      span: 2,
      label: 'Status',
      node: (
        <>
          <TileHead title="Where we are" icon={<Rocket />} action={<Badge tone="neutral" dot>{VERTICAL_STATUS_LABEL[vertical.status]}</Badge>} />
          <TileBody>
            <div className={[p.roadmap, s.flatRoadmap].join(' ')} aria-label="Onboarding stages">
              {ONBOARDING_STAGES.map((label, i) => {
                const state = i < stage ? 'done' : i === stage ? 'current' : 'todo';
                return (
                  <div key={label} className={p.phase} data-state={state}>
                    <span className={p.phaseDot}>{state === 'done' ? <Check /> : i + 1}</span>
                    <span className={p.phaseLabel}>{label}</span>
                  </div>
                );
              })}
            </div>
            <div className={s.sub}>
              {vertical.status === 'onboarding' ? (
                <>
                  Onboarding since <b>{vertical.onboardedAt ? shortDate(vertical.onboardedAt) : 'recently'}</b>. The first automation runs on real data before anything goes live.
                </>
              ) : (
                <>Planned. The kick-off workshop sets the scope, the team and the KPI.</>
              )}
            </div>
          </TileBody>
        </>
      ),
    },
    {
      id: 'next',
      span: 2,
      label: 'Next step',
      node: (
        <>
          <TileHead title="Next step" icon={<ArrowRight />} />
          <TileBody>
            <div className={s.step} data-first="true" style={{ padding: '12px 14px' }}>
              {owner && <Avatar user={owner} size={28} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 'var(--fs-md)' }}>{kickoff.title}</b>
                <span className={s.rowSub}>
                  {shortDate(kickoff.at)}
                  {owner ? ` · ${owner.name}` : ''}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Button variant="primary" size="sm" onClick={() => openAsk({ companyId: company.id, assigneeId: partnerContact(company.id, 'process') })}>
                <AtSign /> Ask Viralistic
              </Button>
              <Button variant="secondary" size="sm" onClick={() => toast('Invitation sent to the team (demo)')}>
                <Users /> Invite the team
              </Button>
            </div>
          </TileBody>
        </>
      ),
    },
    {
      id: 'products',
      span: 2,
      label: 'Planned products',
      node: (
        <>
          <TileHead title="Planned products" />
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
            {scope.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {scope.map((item) => (
                  <div key={item.id} className={s.scopeItem} data-status={item.status}>
                    <span className={s.mark} data-status={item.status}>
                      {item.status === 'delivered' && <Check strokeWidth={3} />}
                    </span>
                    <span>{item.title}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-subtle)', fontSize: 'var(--fs-2xs)' }}>{item.status === 'in-progress' ? 'in progress' : item.status}</span>
                  </div>
                ))}
              </div>
            )}
          </TileBody>
        </>
      ),
    },
    {
      id: 'expect',
      span: 2,
      label: 'What to expect',
      node: (
        <>
          <TileHead title="What to expect" />
          <TileBody>
            <ul className={s.expect}>
              <li>Kick-off workshop with Viralistic.</li>
              <li>First product on real data, nothing live by default.</li>
              <li>You test, Viralistic fixes, then go-live.</li>
              <li>Points and the leaderboard start at go-live.</li>
            </ul>
          </TileBody>
        </>
      ),
    },
    ...kpis.map<TileDef>((k) => ({ id: `kpi:${k.id}`, label: k.label, node: <KpiCard kpi={k} /> })),
    {
      id: 'team',
      span: kpis.length ? 1 : 2,
      label: 'Team',
      node: (
        <>
          <TileHead title="Team" icon={<Users />} sub={`${team.length} ${team.length === 1 ? 'person' : 'people'}`} />
          <TileBody flush style={{ paddingBottom: 6 }}>
            {team.length === 0 && <div className={s.empty} style={{ padding: '0 16px 10px' }}>Nobody on the team yet.</div>}
            {team.map((u) => {
              const st = leaderboard(vertical.id).find((m) => m.userId === u.id);
              return (
                <div key={u.id} className={s.row} style={{ padding: '8px 16px' }}>
                  <Avatar user={u} size={26} online={u.online} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={s.rowName}>{u.name}</div>
                    <div className={s.rowSub}>{u.id === vertical.managerId ? 'Head of AI' : u.title}</div>
                  </div>
                  {st && <BadgeIcons ids={st.badges} max={3} size={20} />}
                </div>
              );
            })}
          </TileBody>
        </>
      ),
    },
  ];

  return (
    <div className={s.page}>
      <div className={s.hero}>
        <div style={{ minWidth: 0 }}>
          <div className={s.eyebrow}>
            {NOW.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })} · {vertical.label}
          </div>
          <h1 className={s.greeting}>
            {greeting()}, {firstName(me)}
          </h1>
          <div className={s.line}>
            <span>{vertical.name} is</span>
            <span className={s.pill}>{VERTICAL_STATUS_LABEL[vertical.status].toLowerCase()}</span>
            <span>with</span>
            <a href="#tile-products" className={s.pill}>
              {products.length} planned {products.length === 1 ? 'product' : 'products'}
            </a>
            <span>and</span>
            <a href="#tile-team" className={s.pill}>
              <AvatarGroup users={team} size={16} max={3} /> {team.length} {team.length === 1 ? 'person' : 'people'}
            </a>
          </div>
        </div>
        <div className={s.actions}>
          <Button variant="primary" onClick={() => openAsk({ companyId: company.id, assigneeId: partnerContact(company.id, 'process') })}>
            <AtSign /> Ask Viralistic
          </Button>
          <Button variant="secondary" href="/teams">
            <Trophy /> Verticals leaderboard
          </Button>
        </div>
      </div>
      <TileGrid tiles={tiles} order={tiles.map((t) => t.id)} />
    </div>
  );
}
