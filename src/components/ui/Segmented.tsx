import type { ReactNode } from 'react';
import s from './ui.module.css';

export interface SegItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  href?: string;
}
export function Segmented({ items, value, onChange, dark }: { items: SegItem[]; value: string; onChange?: (id: string) => void; dark?: boolean }) {
  return (
    <div className={[s.seg, dark ? s.segDark : ''].join(' ')} role="tablist">
      {items.map((it) =>
        it.href ? (
          <a key={it.id} href={it.href} className={s.segItem} aria-current={it.id === value ? 'true' : undefined}>
            {it.icon}
            {it.label}
          </a>
        ) : (
          <button key={it.id} type="button" className={s.segItem} data-active={it.id === value} onClick={() => onChange?.(it.id)}>
            {it.icon}
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}
