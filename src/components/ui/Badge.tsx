import type { ReactNode } from 'react';
import s from './ui.module.css';

export type Tone = 'neutral' | 'outline' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'dark';
const toneClass: Record<Tone, string> = {
  neutral: s.neutral!,
  outline: s.outline!,
  success: s.success!,
  warning: s.warning!,
  danger: s.dangerB!,
  info: s.info!,
  brand: s.brandB!,
  dark: s.dark!,
};

export function Badge({ tone = 'neutral', dot, children, size, style, title }: { tone?: Tone; dot?: boolean; children: ReactNode; size?: 'sm'; style?: React.CSSProperties; title?: string }) {
  return (
    <span className={[s.badge, toneClass[tone], size === 'sm' ? s.badgeSm : ''].join(' ')} style={style} title={title}>
      {dot && <span className={s.badgeDot} />}
      {children}
    </span>
  );
}
