import { Gauge, Lightbulb, TriangleAlert } from 'lucide-react';
import type { Severity } from '../../data/types';

/**
 * Dashboard marker for a finding. Deliberately quiet: breaking is pink,
 * everything else is grey. The canvas is the only place with hot colours.
 */
export function SeverityIcon({ severity, size = 14, filled }: { severity: Severity; size?: number; filled?: boolean }) {
  const Icon = severity === 'critical' ? TriangleAlert : severity === 'inefficient' ? Gauge : Lightbulb;
  const color = severity === 'critical' ? 'var(--accent)' : 'var(--text-subtle)';
  if (filled) {
    return (
      <span
        style={{
          width: size + 10,
          height: size + 10,
          borderRadius: '50%',
          display: 'inline-grid',
          placeItems: 'center',
          background: severity === 'critical' ? 'var(--accent-soft)' : 'var(--surface-3)',
          color,
          flex: 'none',
        }}
      >
        <Icon size={size} strokeWidth={2.25} />
      </span>
    );
  }
  return <Icon size={size} style={{ color, flex: 'none' }} strokeWidth={2.25} />;
}
