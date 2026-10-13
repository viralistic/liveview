import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { COMPANIES, IMPORTANCE_HINT, IMPORTANCE_LABEL, USERS, WORKFLOWS, suggestImportance, type Importance } from '../../data';
import { useSession, useStore, toast } from '../../stores/session';
import { $ask, closeAsk, createTask } from '../../stores/planner';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { MentionInput, mentionedUsers } from '../ui/Mention';
import s from './planner.module.css';

/**
 * "Ask someone": tag people with @, the model suggests how important it is,
 * you can override, and the task lands on their calendar or in their inbox.
 */
export function AskComposer() {
  const prefill = useStore($ask);
  const { user: me } = useSession();
  const [text, setText] = useState('');
  const [override, setOverride] = useState<Importance | null>(null);
  const suggestion = useMemo(() => suggestImportance(text), [text]);
  const importance = override ?? suggestion.importance;
  const tagged = mentionedUsers(text);
  const wf = prefill?.workflowId ? WORKFLOWS.find((w) => w.id === prefill.workflowId) : undefined;
  const companyId = prefill?.companyId ?? wf?.companyId;

  useEffect(() => {
    if (!prefill) return;
    const who = prefill.assigneeId ? USERS.find((u) => u.id === prefill.assigneeId) : undefined;
    setText(who ? `@${who.name} ` : '');
    setOverride(null);
  }, [prefill]);

  if (!prefill) return null;

  const send = () => {
    if (!tagged.length) {
      toast('Tag someone with @ first');
      return;
    }
    const title = text.replace(/@[\w ]+?(?=\s|$)/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || (wf ? `Look at ${wf.name}` : 'New request');
    const created = tagged.map((u) => createTask({ title, body: text, assigneeId: u.id, createdById: me.id, importance, reason: override ? `${me.name.split(' ')[0]} marked it ${importance}` : suggestion.reason, workflowId: wf?.id, companyId }));
    const first = created[0]!;
    toast(
      first.status === 'planned' && first.plannedAt
        ? `Planned for ${tagged.map((u) => u.name.split(' ')[0]).join(' and ')}: ${new Date(first.plannedAt).toLocaleDateString('en-GB', { weekday: 'short' })} ${new Date(first.plannedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        : `Added to ${tagged.map((u) => u.name.split(' ')[0]).join(' and ')}'s inbox`,
    );
    closeAsk();
  };

  return (
    <Modal open onClose={closeAsk} title="Ask someone" width={560}>
      {(wf || companyId) && (
        <div className={s.context}>
          {wf ? wf.name : COMPANIES.find((c) => c.id === companyId)?.name}
          {wf && <span> · {COMPANIES.find((c) => c.id === wf.companyId)?.shortName}</span>}
        </div>
      )}
      <MentionInput value={text} onChange={setText} autoFocus rows={4} placeholder="@Mirza Iqbal the dealer leads stopped this morning, can you…" />
      <div className={s.importance}>
        <div className={s.suggest}>
          <Sparkles size={13} />
          <span>
            Suggested <b>{IMPORTANCE_LABEL[suggestion.importance]}</b> · {suggestion.reason}
          </span>
        </div>
        <div className={s.levels} role="radiogroup" aria-label="Importance">
          {(['high', 'medium', 'low'] as Importance[]).map((lvl) => (
            <button key={lvl} type="button" role="radio" aria-checked={importance === lvl} className={s.level} data-level={lvl} onClick={() => setOverride(lvl)}>
              <b>{IMPORTANCE_LABEL[lvl]}</b>
              <span>{IMPORTANCE_HINT[lvl]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={s.composerFoot}>
        <span className={s.muted}>{tagged.length ? `Goes to ${tagged.map((u) => u.name.split(' ')[0]).join(', ')}` : 'Tag someone with @'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={closeAsk}>
            Cancel
          </Button>
          <Button variant="primary" onClick={send} disabled={!tagged.length}>
            Send
          </Button>
        </div>
      </div>
    </Modal>
  );
}
