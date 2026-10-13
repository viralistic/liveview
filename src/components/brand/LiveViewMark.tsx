import type { CSSProperties } from 'react';

/**
 * LiveView mark: a square with a dash running from the bottom-left to the
 * top-right. White on the black sidebar, ink on light surfaces.
 */
export function LiveViewMark({ size = 24, color = 'var(--sidebar-mark)', ink = 'var(--sidebar-mark-ink)', style }: { size?: number; color?: string; ink?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6" fill={color} />
      <path d="M7.5 16.5 L16.5 7.5" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
