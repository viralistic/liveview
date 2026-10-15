import { Lock } from 'lucide-react';
import s from './ui.module.css';

/** Accessible on/off switch. `locked` shows why it cannot change. */
export function Switch({ checked, onChange, disabled, locked, label }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean; locked?: boolean; label?: string }) {
  const off = disabled || locked;
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={off} className={s.switch} data-locked={locked ? 'true' : undefined} onClick={() => !off && onChange?.(!checked)}>
      <span className={s.switchKnob}>{locked && <Lock />}</span>
    </button>
  );
}
