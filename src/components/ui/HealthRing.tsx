import { Check } from 'lucide-react';
import { healthColor } from '../../lib/health';

/**
 * Health as a ring. Full health is fluorescent, low health is blended pink.
 * With `checkWhenHealthy`, a healthy score renders as a plain check mark.
 */
export function HealthRing({ score, size = 40, stroke = 3.5, showLabel = true, checkWhenHealthy = false }: { score: number; size?: number; stroke?: number; showLabel?: boolean; checkWhenHealthy?: boolean }) {
  if (checkWhenHealthy && score >= 90) {
    return (
      <span style={{ width: size, height: size, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', color: 'var(--health-full)', border: '1.5px solid var(--health-full)', flex: 'none' }} title={`Health ${score}/100`}>
        <Check size={Math.round(size * 0.5)} strokeWidth={2.5} />
      </span>
    );
  }
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-grid', placeItems: 'center', flex: 'none' }} title={`Health ${score}/100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={healthColor(score)}
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
