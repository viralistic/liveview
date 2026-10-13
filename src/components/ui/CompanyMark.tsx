import type { Company } from '../../data/types';
import s from './ui.module.css';

/** Compact company identity: initials on the company accent. */
export function CompanyMark({ company, size = 24, mono }: { company: Company; size?: number; mono?: boolean }) {
  return (
    <span
      className={s.mark}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.42)),
        borderRadius: Math.max(5, size * 0.3),
        background: mono ? 'rgba(255,255,255,0.1)' : company.color,
        color: '#fff',
        border: mono ? '1px solid rgba(255,255,255,0.08)' : undefined,
      }}
      aria-hidden="true"
    >
      {company.initials}
    </span>
  );
}
