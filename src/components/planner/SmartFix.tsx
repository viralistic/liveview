import { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { USERS, type Issue } from '../../data';
import { useSession, useStore } from '../../stores/session';
import { $proposals, proposalFor, requestFix, reviewFix } from '../../stores/fixes';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import s from './planner.module.css';

/**
 * Smart fix for one finding. Anyone can ask for a proposal; only the project's
 * technical owner can accept it. Render it under a finding (panel, popover, list).
 */
export function SmartFix({ issue, compact }: { issue: Issue; compact?: boolean }) {
  const { user: me } = useSession();
  const proposals = useStore($proposals);
  const p = proposalFor(issue.id, proposals);
  const [thinking, setThinking] = useState(false);
  const reviewer = p ? USERS.find((u) => u.id === p.reviewerId) : undefined;
  const iReview = p ? p.reviewerId === me.id : false;

  if (!p) {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={thinking}
        onClick={() => {
          setThinking(true);
          setTimeout(() => {
            requestFix(issue, me.id);
            setThinking(false);
          }, 900);
        }}
      >
        <Sparkles /> {thinking ? 'Thinking…' : 'Smart fix'}
      </Button>
    );
  }

  return (
    <div className={s.fix} data-compact={compact}>
      <div className={s.fixHead}>
        <Sparkles size={13} />
        <b>{p.summary}</b>
      </div>
      <ul className={s.fixChanges}>
        {p.changes.map((c, i) => (
          <li key={i}>
            <span>{c.nodeName}</span>
            {c.change}
          </li>
        ))}
      </ul>
      {!compact && (
        <div className={s.fixTest}>
          Test: {p.testPlan} · risk {p.risk}
        </div>
      )}
      <div className={s.fixReview}>
        {p.status === 'proposed' && reviewer && (
          <>
            <Avatar user={reviewer} size={20} />
            {iReview ? (
              <>
                <span>Your call as technical owner</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <Button size="sm" variant="primary" onClick={() => reviewFix(p.id, 'accepted')}>
                    <Check /> Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => reviewFix(p.id, 'rejected')}>
                    <X /> Reject
                  </Button>
                </span>
              </>
            ) : (
              <span>Waiting for {reviewer.name.split(' ')[0]} to accept</span>
            )}
          </>
        )}
        {p.status === 'accepted' && <span>Accepted. Applying in a staging container…</span>}
        {p.status === 'applied' && (
          <span style={{ color: 'var(--health-full)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Check size={13} /> Applied and tested in staging. Ready to go live.
          </span>
        )}
      </div>
    </div>
  );
}
