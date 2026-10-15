import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { Kpi, Workflow } from '../../data/types';
import { USERS } from '../../data/users';
import { fmtKpi, kpiHit, kpiProgress, verticalById } from '../../data/verticals';
import { tokensByModel } from '../../lib/value';
import { fmtCompact, fmtEuro } from '../../lib/format';
import { AvatarGroup } from '../ui/Avatar';
import { Sparkline } from '../ui/Sparkline';
import { Bar, TileBody, TileHead } from './Tiles';
import { shortDate } from './util';
import s from './client.module.css';

/* ------------------------------------------------------------------ */
/* KPI tile: the KPI partner and client agreed on, as a tile.           */
/* ------------------------------------------------------------------ */
export function KpiCard({ kpi, showVertical = false, contribution }: { kpi: Kpi; showVertical?: boolean; contribution?: ReactNode }) {
  const hit = kpiHit(kpi);
  const progress = kpiProgress(kpi);
  const vertical = kpi.verticalId ? verticalById(kpi.verticalId) : undefined;
  const agreed = kpi.agreedByIds.map((id) => USERS.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u);
  const toGo = kpi.direction === 'down' ? kpi.current - kpi.target : kpi.target - kpi.current;
  return (
    <>
      <TileHead
        title={kpi.label}
        sub={showVertical ? (vertical ? vertical.name : 'Whole company') : undefined}
        action={
          <span className={s.hit} data-hit={hit ? 'true' : undefined} title={hit ? 'Target hit' : `${fmtKpi(kpi, Math.abs(toGo))} to go`}>
            {hit ? <Check strokeWidth={2.5} /> : `${Math.round(progress * 100)}`}
          </span>
        }
      />
      <TileBody>
        <div className={s.kpiVal}>
          {fmtKpi(kpi)}
          <small>target {fmtKpi(kpi, kpi.target)}</small>
        </div>
        <div style={{ marginTop: 10, display: 'flex' }}>
          <Bar value={progress} tone={hit ? 'good' : undefined} height={5} />
        </div>
        <div className={s.kpiMeta}>
          <span>
            Was <b>{fmtKpi(kpi, kpi.baseline)}</b>
          </span>
          <span>{kpi.direction === 'down' ? 'lower is better' : 'higher is better'}</span>
        </div>
        <div className={s.kpiFoot}>
          <Sparkline data={kpi.direction === 'down' ? kpi.series.map((v) => Math.max(...kpi.series) - v + 0.01) : kpi.series} width={88} height={22} color={hit ? 'var(--health-full)' : 'var(--text-subtle)'} />
          <span className={s.kpiAgreed} title={`Agreed ${shortDate(kpi.agreedAt)} by ${agreed.map((u) => u.name).join(' and ')}`}>
            agreed by <AvatarGroup users={agreed} size={16} max={3} />
          </span>
        </div>
        {contribution && <div className={s.contrib}>{contribution}</div>}
      </TileBody>
      <div className={s.hover}>
        <div>
          <span>{kpi.description}</span>
        </div>
        <div>
          <span>12 weeks ago</span>
          <b>{fmtKpi(kpi, kpi.series[0] ?? kpi.baseline)}</b>
        </div>
        <div>
          <span>Agreed</span>
          <b>{shortDate(kpi.agreedAt)}</b>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tokens vs hours vs euro as three thin bars, normalized to a maximum  */
/* so verticals or workflows can be compared at a glance.               */
/* ------------------------------------------------------------------ */
export interface Triple {
  tokens: number;
  hours: number;
  euro: number;
}
export function tripleMax(items: Triple[]): Triple {
  return items.reduce<Triple>((m, t) => ({ tokens: Math.max(m.tokens, t.tokens), hours: Math.max(m.hours, t.hours), euro: Math.max(m.euro, t.euro) }), { tokens: 1, hours: 1, euro: 1 });
}
export function TripleBars({ value, max }: { value: Triple; max: Triple }) {
  return (
    <div className={s.triple}>
      <span>tokens</span>
      <Bar value={value.tokens / max.tokens} tone="soft" />
      <em>{value.tokens ? fmtCompact(value.tokens) : '0'}</em>
      <span>hours</span>
      <Bar value={value.hours / max.hours} tone="muted" />
      <em>{fmtCompact(value.hours)} h</em>
      <span>euro</span>
      <Bar value={value.euro / max.euro} tone="accent" />
      <em>{fmtEuro(value.euro)}</em>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Where the tokens go, per model.                                      */
/* ------------------------------------------------------------------ */
export function ModelBreakdown({ wfs }: { wfs: Workflow[] }) {
  const rows = tokensByModel(wfs).filter((r) => r.tokens > 0);
  const max = Math.max(1, ...rows.map((r) => r.tokens));
  if (!rows.length) return <div className={s.empty}>No model steps in these workflows.</div>;
  return (
    <div className={s.models}>
      {rows.map((r) => (
        <div key={r.model} className={s.model} title={`${r.workflows} workflow${r.workflows === 1 ? '' : 's'} on ${r.label}`}>
          <b>{r.label}</b>
          <Bar value={r.tokens / max} tone="soft" height={5} />
          <em>
            {fmtCompact(r.tokens)} · {fmtEuro(r.cost)}
          </em>
        </div>
      ))}
    </div>
  );
}
