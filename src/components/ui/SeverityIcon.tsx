import { Gauge, Lightbulb, TriangleAlert } from 'lucide-react';
import type { Severity } from '../../data/types';
import { SEVERITY_COLOR } from '../../lib/health';

export function SeverityIcon({ severity, size = 14, filled }: { severity: Severity; size?: number; filled?: boolean }) {
  const Icon = severity === 'critical' ? TriangleAlert : severity === 'inefficient' ? Gauge : Lightbulb;
  if (filled) {
    return (
      <span style={{ width: size + 10, height: size + 10, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: SEVERITY_COLOR[severity], color: severity === 'minor' ? '#3b2d00' : '#fff', flex: 'none' }}>
        <Icon size={size} strokeWidth={2.25} />
      </span>
    );
  }
  return <Icon size={size} style={{ color: SEVERITY_COLOR[severity], flex: 'none' }} strokeWidth={2.25} />;
}
