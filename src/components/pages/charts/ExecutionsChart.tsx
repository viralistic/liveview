import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtCompact, fmtInt, NOW } from '../../../lib/format';

/**
 * Stacked bar chart of executions over the last 7 days (28 buckets of 6h).
 * Follows the dataviz rules: thin marks, 2px gaps between stacked segments,
 * rounded data-end anchored to the baseline, recessive grid, hover tooltip,
 * legend for 2+ series, text in text tokens never in series colour.
 */
export interface Series {
  id: string;
  label: string;
  color: string;
  values: number[]; // 28
}

const BUCKETS = 28;

export function ExecutionsChart({ series, height = 220, failures }: { series: Series[]; height?: number; failures?: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(320, e.contentRect.width));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const pad = { l: 44, r: 8, t: 10, b: 26 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const totals = useMemo(() => Array.from({ length: BUCKETS }, (_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0)), [series]);
  const max = Math.max(1, ...totals);
  const niceMax = niceCeil(max);
  const slot = plotW / BUCKETS;
  const bw = Math.max(4, slot - 4);
  const y = (v: number) => pad.t + plotH - (v / niceMax) * plotH;

  // day labels: buckets 0..27 → 7 days ending today
  const days = Array.from({ length: 7 }, (_, d) => {
    const date = new Date(NOW.getTime() - (6 - d) * 86_400_000);
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
  });
  const ticks = [0, 0.5, 1].map((f) => Math.round(niceMax * f));

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
        {/* grid */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border-subtle)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10.5} fill="var(--text-subtle)" fontFamily="var(--font-sans)">
              {fmtCompact(t)}
            </text>
          </g>
        ))}
        {/* bars */}
        {totals.map((total, i) => {
          const x = pad.l + i * slot + (slot - bw) / 2;
          let acc = 0;
          const segs = series
            .map((s) => {
              const v = s.values[i] ?? 0;
              const y0 = acc;
              acc += v;
              return { s, v, y0, y1: acc };
            })
            .filter((seg) => seg.v > 0);
          const dim = hover !== null && hover !== i;
          return (
            <g key={i} opacity={dim ? 0.45 : 1} style={{ transition: 'opacity 120ms' }}>
              {/* hit area */}
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={plotH} fill={hover === i ? 'rgba(0,0,0,0.035)' : 'transparent'} onMouseEnter={() => setHover(i)} rx={3} />
              {segs.map((seg, k) => {
                const top = y(seg.y1);
                const bottom = y(seg.y0);
                const h = Math.max(0, bottom - top - (k < segs.length - 1 ? 2 : 0));
                const isTop = k === segs.length - 1;
                const r = Math.min(4, bw / 2, h);
                const path = isTop
                  ? `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${bottom} Z`
                  : `M${x},${top + 2} H${x + bw} V${top + 2 + h} H${x} Z`;
                return <path key={seg.s.id} d={path} fill={seg.s.color} style={{ pointerEvents: 'none' }} />;
              })}
              {failures && failures[i]! > 0 && <circle cx={x + bw / 2} cy={y(total) - 7} r={2.2} fill="var(--danger)" style={{ pointerEvents: 'none' }} />}
            </g>
          );
        })}
        {/* baseline + x labels */}
        <line x1={pad.l} x2={width - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="var(--border-strong)" />
        {days.map((d, k) => (
          <text key={d} x={pad.l + k * 4 * slot + 2 * slot} y={height - 8} textAnchor="middle" fontSize={10.5} fill="var(--text-subtle)" fontFamily="var(--font-sans)">
            {d}
          </text>
        ))}
      </svg>
      {hover !== null && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(width - 190, Math.max(0, pad.l + hover * slot + slot / 2 - 90)),
            top: 0,
            width: 180,
            background: 'var(--primary)',
            color: '#fff',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 11.5,
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7, marginBottom: 4 }}>
            <span>{bucketLabel(hover)}</span>
            <span>{fmtInt(totals[hover]!)} runs</span>
          </div>
          {series.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flex: 'none' }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
              <span className="tnum">{fmtInt(s.values[hover] ?? 0)}</span>
            </div>
          ))}
          {failures && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: 4, paddingTop: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--danger)', flex: 'none' }} />
              <span style={{ flex: 1 }}>Failed</span>
              <span className="tnum">{fmtInt(failures[hover] ?? 0)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ series }: { series: Series[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      {series.map((s) => (
        <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function bucketLabel(i: number): string {
  const dayOffset = 6 - Math.floor(i / 4);
  const date = new Date(NOW.getTime() - dayOffset * 86_400_000);
  const hour = (i % 4) * 6;
  return `${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })} · ${String(hour).padStart(2, '0')}:00–${String(hour + 6).padStart(2, '0')}:00`;
}
function niceCeil(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return n * p;
}
