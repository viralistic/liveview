/** Small inline charts. Pure SVG, no deps. */
export function Sparkline({ data, width = 96, height = 26, color = 'var(--text-muted)', fill = true, strokeWidth = 1.5 }: { data: number[]; width?: number; height?: number; color?: string; fill?: boolean; strokeWidth?: number }) {
  const max = Math.max(1, ...data);
  const step = width / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => [i * step, height - 2 - (v / max) * (height - 4)] as const);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L${width},${height} L0,${height} Z`;
  const id = `sp${Math.abs(hash(data.join(',')))}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ overflow: 'visible' }}>
      {fill && (
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.18" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Bars({ data, failures, width = 120, height = 28, color = 'var(--neutral-400)', failColor = 'var(--danger)', gap = 2, radius = 1.5 }: { data: number[]; failures?: number[]; width?: number; height?: number; color?: string; failColor?: string; gap?: number; radius?: number }) {
  const max = Math.max(1, ...data);
  const bw = (width - gap * (data.length - 1)) / data.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {data.map((v, i) => {
        const h = Math.max(v > 0 ? 2 : 1, (v / max) * height);
        const x = i * (bw + gap);
        const f = failures?.[i] ?? 0;
        const fh = v ? (f / v) * h : 0;
        return (
          <g key={i}>
            <rect x={x} y={height - h} width={bw} height={h} rx={radius} fill={color} opacity={v ? 1 : 0.5} />
            {fh > 0 && <rect x={x} y={height - fh} width={bw} height={fh} rx={radius} fill={failColor} />}
          </g>
        );
      })}
    </svg>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
