import { useState, type ReactNode, type MouseEvent } from 'react';
import s from './ui.module.css';

/** Lightweight hover tooltip rendered in a fixed layer (no portal needed). */
export function Tooltip({ label, kbd, children, side = 'top' }: { label: ReactNode; kbd?: string; children: ReactNode; side?: 'top' | 'bottom' }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const show = (e: MouseEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: side === 'top' ? r.top - 8 : r.bottom + 8 + 28 });
  };
  return (
    <span className={s.tipWrap} onMouseEnter={show} onMouseLeave={() => setPos(null)}>
      {children}
      {pos && (
        <span className={s.tip} style={{ left: pos.x, top: pos.y }} role="tooltip">
          {label}
          {kbd && <kbd>{kbd}</kbd>}
        </span>
      )}
    </span>
  );
}
