import { useState } from 'react';
import { Check, Focus, Radio, Send, Server } from 'lucide-react';
import { IMPORTANCE_HINT, IMPORTANCE_LABEL, ROUTE_LABEL, SEVERITY_LABEL, USERS, projectFor, type Importance } from '../../data';
import { useSession, toast } from '../../stores/session';
import { acknowledgeSignal, latestSignal, sendSignal, useSignals, type Signal } from '../../stores/signals';
import { relTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { CompanyMark } from '../ui/CompanyMark';
import { Modal } from '../ui/Modal';
import { SeverityIcon } from '../ui/SeverityIcon';
import { defaultImportance, partnerOf, signalNote, type Incident } from './incidents';
import pg from '../pages/pages.module.css';
import v from './vendor.module.css';

const first = (name: string) => name.split(' ')[0]!;

/** Who signalled and when. Rendered only on the client (signals live in localStorage). */
export function SignalStateChip({ signal }: { signal: Signal }) {
  const by = USERS.find((u) => u.id === signal.byId);
  const ackBy = signal.acknowledgedById ? USERS.find((u) => u.id === signal.acknowledgedById) : undefined;
  const now = new Date();
  if (signal.status === 'acknowledged') {
    return (
      <span className={v.sigChip} data-status="acknowledged" title={signal.note}>
        <Check />
        Acknowledged{ackBy ? ` by ${first(ackBy.name)}` : ''}
        <span>· {relTime(signal.acknowledgedAt ?? signal.at, now)}</span>
      </span>
    );
  }
  return (
    <span className={v.sigChip} data-status="signalled" title={signal.note}>
      {by ? <Avatar user={by} size={16} /> : <Radio />}
      Signalled{by ? ` by ${first(by.name)}` : ''}
      <span>· {relTime(signal.at, now)}</span>
    </span>
  );
}

/** "Signal Viralistic": the allocated partner, the owners, an editable note and the importance. */
export function SignalDialog({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const { user: me } = useSession();
  const { issue, wf, company } = incident;
  const partner = partnerOf(company);
  const project = projectFor(company.id);
  const techOwner = project ? USERS.find((u) => u.id === project.technicalOwnerId) : undefined;
  const processOwner = project ? USERS.find((u) => u.id === project.processOwnerId) : undefined;
  const clientCto = USERS.find((u) => u.companyId === company.id && u.persona === 'client-head-ai');
  const selfHosted = company.route === 'self-hosted';
  const [note, setNote] = useState(() => signalNote(incident));
  const [importance, setImportance] = useState<Importance>(() => defaultImportance(issue.severity));
  const [notify, setNotify] = useState(false);

  const send = () => {
    const { task } = sendSignal({ issue, wf, company, byId: me.id, note: note.trim() || signalNote(incident), importance, notifiedId: notify && clientCto ? clientCto.id : undefined });
    const who = techOwner ? first(techOwner.name) : 'the partner';
    const where = task.status === 'planned' ? 'Planned in their calendar.' : 'Added to their inbox.';
    const extra = notify && clientCto ? ` ${first(clientCto.name)} notified by email.` : '';
    toast(`Signal sent to ${who} at ${partner?.shortName ?? 'the partner'}. ${where}${extra}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Signal ${partner?.shortName ?? 'the partner'}`} width={580}>
      <div className={v.sigContext}>
        <SeverityIcon severity={issue.severity} size={13} filled />
        <div style={{ minWidth: 0 }}>
          <b>{issue.action}</b>
          <span>
            <CompanyMark company={company} size={14} /> {company.shortName} · {wf.name} · {SEVERITY_LABEL[issue.severity]} · {issue.impact}
          </span>
        </div>
      </div>

      <div className={v.sigWho}>
        {partner && (
          <div className={v.sigParty}>
            <CompanyMark company={partner} size={28} />
            <div style={{ minWidth: 0 }}>
              <b>{partner.shortName}</b>
              <span>Allocated partner · {ROUTE_LABEL[company.route]}</span>
            </div>
          </div>
        )}
        {techOwner && (
          <div className={v.sigParty} data-primary="true">
            <Avatar user={techOwner} size={28} online={techOwner.online} />
            <div style={{ minWidth: 0 }}>
              <b>{techOwner.name}</b>
              <span>Technical owner · gets the task</span>
            </div>
          </div>
        )}
        {processOwner && (
          <div className={v.sigParty}>
            <Avatar user={processOwner} size={28} online={processOwner.online} />
            <div style={{ minWidth: 0 }}>
              <b>{processOwner.name}</b>
              <span>Process owner · in the loop</span>
            </div>
          </div>
        )}
      </div>

      {selfHosted && (
        <div className={v.localNote}>
          <Server />
          <div>
            <b>Local host: n8n supports this instance directly.</b> {company.shortName} runs n8n on its own servers under an enterprise agreement. The signal still goes to {partner?.shortName ?? 'the partner'}, who build and run the project.
          </div>
        </div>
      )}

      <label className={pg.field}>
        Note to {techOwner ? first(techOwner.name) : 'the partner'}
        <textarea className={pg.textarea} rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className={v.levels} role="radiogroup" aria-label="Importance">
        {(['high', 'medium', 'low'] as Importance[]).map((lvl) => (
          <button key={lvl} type="button" role="radio" aria-checked={importance === lvl} className={v.level} onClick={() => setImportance(lvl)}>
            <b>{IMPORTANCE_LABEL[lvl]}</b>
            <span>{IMPORTANCE_HINT[lvl]}</span>
          </button>
        ))}
      </div>

      {selfHosted && clientCto && (
        <label className={v.checkRow}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Also notify {clientCto.name} ({clientCto.title.includes('CTO') ? 'client CTO' : clientCto.title})
        </label>
      )}

      <div className={v.sigFoot}>
        <span>{importance === 'low' ? `Lands in ${techOwner ? first(techOwner.name) : 'their'}'s inbox` : `Planned in ${techOwner ? first(techOwner.name) : 'their'}'s calendar, ${importance === 'high' ? 'within a day' : 'within three working days'}`}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={send}>
            <Send /> Send signal
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The actions for one incident, depending on who is looking and where it stands:
 * open: Signal partner. Signalled: the state chip, Acknowledge, Open canvas.
 */
export function SignalActions({ incident, showState = true }: { incident: Incident; showState?: boolean }) {
  const { user: me, can, org } = useSession();
  const signals = useSignals();
  const [open, setOpen] = useState(false);
  const signal = latestSignal(incident.issue.id, signals);
  const canSignal = can('signal-partner');
  const canAck = can('signal-partner') || (org.kind === 'partner' && can('respond-incidents'));
  const canvas = can('view-canvas') ? `/workflows/canvas?focus=${incident.wf.id}` : undefined;

  return (
    <>
      {showState && signal && <SignalStateChip signal={signal} />}
      <div className={v.actionsRow}>
        {!signal && canSignal && (
          <Button size="sm" variant={incident.issue.severity === 'critical' ? 'primary' : 'secondary'} onClick={() => setOpen(true)}>
            <Radio /> Signal partner
          </Button>
        )}
        {signal && signal.status === 'signalled' && canAck && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              acknowledgeSignal(signal.id, me.id);
              toast('Acknowledged');
            }}
          >
            <Check /> Acknowledge
          </Button>
        )}
        {canvas && (
          <Button size="sm" variant={signal && !(signal.status === 'signalled' && canAck) ? 'secondary' : 'ghost'} href={canvas}>
            <Focus /> Open canvas
          </Button>
        )}
      </div>
      {open && <SignalDialog incident={incident} onClose={() => setOpen(false)} />}
    </>
  );
}
