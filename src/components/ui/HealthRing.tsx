import { healthTone } from '../../lib/health';

const toneColor = { good: 'var(--success)', warn: 'var(--warning)', bad: 'var(--danger)' } as const;

export function HealthRing({ score, size = 40, stroke = 3.5, showLabel = true }: { score: number; size?: number; stroke?: number; showLabel?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = healthTone(score);
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-grid', placeItems: 'center', flex: 'none' }} title={`Health ${score}/100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--neutral-200)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneColor[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * score) / 100} ${c}`}
          style={{ transition: 'stroke-dasharray 600ms var(--ease-out)' }}
        />
      </svg>
      {showLabel && (
        <span className="tnum" style={{ fontSize: Math.max(9, size * 0.3), fontWeight: 600, letterSpacing: '-0.02em', position: 'relative' }}>
          {score}
        </span>
      )}
    </span>
  );
}
