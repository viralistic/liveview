import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import s from './ui.module.css';
import { Button } from './Button';

export function Modal({ open, onClose, title, children, width }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modal} role="dialog" aria-modal="true" style={width ? { width: `min(100%, ${width}px)` } : undefined}>
        <div className={s.modalHeader}>
          <h2 className={s.modalTitle}>{title}</h2>
          <Button variant="ghost" icon size="sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className={s.modalBody}>{children}</div>
      </div>
    </div>
  );
}
