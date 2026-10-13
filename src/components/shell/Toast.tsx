import { Check } from 'lucide-react';
import { $toast, useStore } from '../../stores/session';
import s from './shell.module.css';

export function Toast() {
  const t = useStore($toast);
  if (!t) return null;
  return (
    <div className={s.toast} key={t.id} role="status">
      <Check />
      {t.text}
    </div>
  );
}
