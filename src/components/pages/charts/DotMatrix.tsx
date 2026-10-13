import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtInt, NOW } from '../../../lib/format';

/**
 * Dot-matrix chart: each column is a 6-hour bucket, each dot a slice of the
 * column's value. Failed runs are drawn as pink dots at the top of the column,
 * the current bucket as hollow rings. Reads like a punch card, hovers like a chart.
 */
export interface MatrixSeries {
  id: string;
  label: string;
  color: string;
  values: number[];
}

export function DotMatrix({
  values,
  failures,
  breakdown,
  rows = 9,
  height = 190,
  tone = 'dark',
  showAxis = true,
}: {
  values: number[];
  failures?: number[];
  breakdown?: MatrixSeries[];
  rows?: number;
  height?: number;
  tone?: 'dark' | 'light';
  showAxis?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(280, e.contentRect.width));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const cols = values.length;
  const max = Math.max(1, ...values);
  const axisH = showAxis ? 22 : 0;
  const plotH = height - axisH;
  const colStep = width / cols;
  const rowStep = plotH / rows;
  const r = Math.max(2.2, Math.min(colStep, rowStep) * 0.3);
  const ink = tone === 'dark' ? '#ffffff' : 'var(--text)';
  const faint = tone === 'dark' ? 'rgba(255,255,255,0.13)' : 'var(--track)';
  const pink = tone === 'dark' ? '#ff4f85' : 'var(--accent)';

  const columns = useMemo(
    () =>
      values.map((v, i) => {
        const n = v > 0 ? Math.max(1, Math.round((v / max) * rows)) : 0;
        const f = failures?.[i] ?? 0;
        const fn = v > 0 && f > 0 ? Math.max(1, Math.round((f / v) * n)) : 0;
        return { n, fn: Math.min(n, fn) };
      }),
    [values, failures, max, rows],
  );

  const days = Array.from({ length: Math.ceil(cols / 4) }, (_, d) => {
    const date = new Date(NOW.getTime() - (Math.ceil(cols / 4) - 1 - d) * 86_400_000);
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
  });

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
        {columns.map((c, i) => {
          const cx = i * colStep + colStep / 2;
          const isLast = i === cols - 1;
          const dim = hover !== null && hover !== i;
          return (
            <g key={i} opacity={dim ? 0.45 : 1} style={{ transition: 'opacity 120ms' }}>
              <rect x={i * colStep} y={0} width={colStep} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
              {Array.from({ length: rows }, (_, j) => {
                const cy = plotH - rowStep / 2 - j * rowStep;
                const filled = j < c.n;
                const failed = filled && j >= c.n - c.fn;
                if (!filled) return <circle key={j} cx={cx} cy={cy} r={r * 0.75} fill={faint} style={{ pointerEvents: 'none' }} />;
                if (isLast) return <circle key={j} cx={cx} cy={cy} r={r} fill="none" stroke={failed ? pink : ink} strokeWidth={1.4} style={{ pointerEvents: 'none' }} />;
                return <circle key={j} cx={cx} cy={cy} r={hover === i ? r * 1.18 : r} fill={failed ? pink : ink} opacity={failed ? 1 : 0.9} style={{ pointerEvents: 'none', transition: 'r 120ms' }} />;
              })}
            </g>
          );
        })}
        {showAxis &&
          days.map((d, k) => (
            <text key={d} x={k * 4 * colStep + 2 * colStep} y={height - 6} textAnchor="middle" fontSize={10.5} fill={tone === 'dark' ? 'rgba(255,255,255,0.45)' : 'var(--text-subtle)'} fontFamily="var(--font-sans)">
              {d}
            </text>
          ))}
      </svg>
      {hover !== null && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(width - 196, Math.max(0, hover * colStep + colStep / 2 - 92)),
            top: -6,
            width: 186,
            background: tone === 'dark' ? '#ffffff' : 'var(--primary)',
            color: tone === 'dark' ? '#0a0a0a' : 'var(--primary-fg)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 11.5,
            boxShadow: 'var(--shadow-lg)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.65, marginBottom: 4 }}>
            <span>{bucketLabel(hover, cols)}</span>
            <span className="tnum">{fmtInt(values[hover]!)} runs</span>
          </div>
          {breakdown?.map((b) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: b.color, flex: 'none' }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</span>
              <span className="tnum">{fmtInt(b.values[hover] ?? 0)}</span>
            </div>
          ))}
          {failures && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.6, borderTop: '1px solid rgba(127,127,127,0.25)', marginTop: 4, paddingTop: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: pink, flex: 'none' }} />
              <span style={{ flex: 1 }}>Failed</span>
              <span className="tnum">{fmtInt(failures[hover] ?? 0)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function bucketLabel(i: number, cols: number): string {
  const dayOffset = Math.ceil(cols / 4) - 1 - Math.floor(i / 4);
  const date = new Date(NOW.getTime() - dayOffset * 86_400_000);
  const hour = (i % 4) * 6;
  return `${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })} · ${String(hour).padStart(2, '0')}–${String(hour + 6).padStart(2, '0')}h`;
}
