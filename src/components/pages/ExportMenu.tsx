import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Mail, Send } from 'lucide-react';
import { COMPANIES, USERS } from '../../data';
import { toast, useSession } from '../../stores/session';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import s from './pages.module.css';

/** Export ▾ : download the report as PDF, or send it to a client contact. */
export function ExportMenu({ scope }: { scope: { kind: 'org' } | { kind: 'company'; companyId: string } }) {
  const [open, setOpen] = useState(false);
  const [send, setSend] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { visibleCompanies } = useSession();
  const [to, setTo] = useState<string>('');
  const [note, setNote] = useState('Hi, here is this week\'s report. The one breaking issue is already being handled.');

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const scopeName = scope.kind === 'org' ? 'all projects' : COMPANIES.find((c) => c.id === scope.companyId)?.shortName;
  const contacts = USERS.filter((u) => (scope.kind === 'company' ? u.companyId === scope.companyId : visibleCompanies.some((c) => c.id === u.companyId))).filter((u) => u.companyId !== 'viralistic');

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Button variant="secondary" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        Export <ChevronDown />
      </Button>
      {open && (
        <div className={s.menu} role="menu">
          <button
            type="button"
            className={s.menuItem}
            onClick={() => {
              setOpen(false);
              toast(`Report for ${scopeName} downloaded as PDF (demo)`);
            }}
          >
            <Download /> Download PDF
          </button>
          <button
            type="button"
            className={s.menuItem}
            onClick={() => {
              setOpen(false);
              setTo(contacts[0]?.id ?? '');
              setSend(true);
            }}
          >
            <Mail /> Send to client
          </button>
        </div>
      )}
      <Modal open={send} onClose={() => setSend(false)} title="Send report" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className={s.field}>
            <span>To</span>
            <div className={s.contacts}>
              {contacts.map((u) => (
                <button key={u.id} type="button" className={s.contact} aria-pressed={to === u.id} onClick={() => setTo(u.id)}>
                  <Avatar user={u} size={22} />
                  <span>
                    {u.name}
                    <small>{COMPANIES.find((c) => c.id === u.companyId)?.shortName}</small>
                  </span>
                </button>
              ))}
              {contacts.length === 0 && <span className={s.muted}>No client contacts in this scope.</span>}
            </div>
          </label>
          <label className={s.field}>
            <span>Message</span>
            <textarea className={s.textarea} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" onClick={() => setSend(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!to}
              onClick={() => {
                setSend(false);
                toast(`Report sent to ${USERS.find((u) => u.id === to)?.name.split(' ')[0]} (demo)`);
              }}
            >
              <Send /> Send PDF
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
