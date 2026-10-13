/** Figma-style comment pins anchored to nodes, with thread popovers and a draft pin for the Comment tool. */
import { useState } from 'react';
import { Check, Send } from 'lucide-react';
import type { Comment, User, Workflow } from '../../data/types';
import { userById } from '../../data/users';
import { NODE_SIZE, nodeWorldPos, type WorldLayout } from '../../lib/layout';
import type { Tier } from './viewport';
import { relTime } from '../../lib/format';
import { toast } from '../../stores/session';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import type { Pt } from './geometry';
import s from './canvas.module.css';

export interface CanvasComment extends Comment {
  /** free position for pins dropped on the canvas (no node) */
  pos?: Pt;
}

/** Where a pin sits: hanging off the node's bottom-right corner, or above the card's top-right corner when nodes are not drawn. */
export function commentAnchor(c: CanvasComment, layout: WorldLayout, workflowById: ReadonlyMap<string, Workflow>, tier: Tier): { p: Pt; dir: 'up' | 'down' } | null {
  if (c.pos) return { p: c.pos, dir: 'up' };
  const card = layout.cards[c.workflowId];
  const wf = workflowById.get(c.workflowId);
  if (!card || !wf) return null;
  const node = wf.nodes.find((n) => n.id === c.nodeId);
  if (!node || tier === 'tiny' || tier === 'compact') return { p: { x: card.x + card.w - 18, y: card.y + 2 }, dir: 'up' };
  const p = nodeWorldPos(card, node);
  // right of the node, just under its output line: sits in the column gap at editor zoom
  return { p: { x: p.x + NODE_SIZE + 2, y: p.y + NODE_SIZE / 2 + 4 }, dir: 'down' };
}

export function CommentPins({ layout, comments, workflowById, openId, onOpen, tier }: { layout: WorldLayout; comments: CanvasComment[]; workflowById: ReadonlyMap<string, Workflow>; openId: string | null; onOpen: (id: string | null) => void; tier: Tier }) {
  return (
    <>
      {comments.map((c) => {
        const a = commentAnchor(c, layout, workflowById, tier);
        if (!a) return null;
        const author = userById(c.authorId);
        const open = openId === c.id;
        return (
          <div key={c.id} className={s.anchor} style={{ left: a.p.x, top: a.p.y, zIndex: open ? 3 : 1 }} data-ui>
            <div className={s.pinWrap} data-dir={a.dir} data-small={tier !== 'full'}>
              <button type="button" className={s.pin} data-resolved={c.resolved} data-open={open} onClick={() => onOpen(open ? null : c.id)} aria-label={`Comment by ${author.name}`}>
                <Avatar user={author} size={tier === 'full' ? 20 : 16} />
                {c.replies.length > 0 && <span className={s.pinCount}>{c.replies.length + 1}</span>}
              </button>
              {open && <Thread comment={c} />}
            </div>
          </div>
        );
      })}
    </>
  );
}

function Thread({ comment }: { comment: CanvasComment }) {
  const author = userById(comment.authorId);
  const [text, setText] = useState('');
  const wf = comment.workflowId;
  const post = () => {
    if (!text.trim()) return;
    toast('Reply posted (demo)');
    setText('');
  };
  return (
    <div className={[s.pop, s.popThread].join(' ')} onPointerDown={(e) => e.stopPropagation()}>
      <div className={s.popHead}>
        <Avatar user={author} size={22} />
        <span className={s.popName}>{author.name}</span>
        {comment.resolved && (
          <span className={s.resolvedTag}>
            <Check size={10} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 2 }} />
            Resolved
          </span>
        )}
        <span className={s.popTime}>{relTime(comment.createdAt)}</span>
      </div>
      <div className={s.popBody}>{comment.body}</div>
      {comment.replies.map((r, i) => {
        const u = userById(r.authorId);
        return (
          <div key={i} className={s.reply}>
            <Avatar user={u} size={18} />
            <div style={{ minWidth: 0 }}>
              <div className={s.replyMeta}>
                <b>{u.name}</b> · {relTime(r.createdAt)}
              </div>
              <div className={s.replyBody}>{r.body}</div>
            </div>
          </div>
        );
      })}
      <div className={s.replyRow}>
        <input className={s.input} placeholder="Reply…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && post()} aria-label={`Reply on ${wf}`} />
        <Button size="sm" variant="primary" icon onClick={post} aria-label="Send reply">
          <Send />
        </Button>
      </div>
    </div>
  );
}

export function DraftPin({ pos, me, onPost, onCancel }: { pos: Pt; me: User; onPost: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  return (
    <div className={s.anchor} style={{ left: pos.x, top: pos.y, zIndex: 4 }} data-ui>
      <div className={s.pinWrap}>
        <span className={s.pin} data-open="true">
          <Avatar user={me} size={20} />
        </span>
        <div className={[s.pop, s.popThread].join(' ')} onPointerDown={(e) => e.stopPropagation()}>
          <div className={s.popHead}>
            <Avatar user={me} size={22} />
            <span className={s.popName}>{me.name}</span>
            <span className={s.popTime}>now</span>
          </div>
          <textarea
            className={s.textarea}
            style={{ marginTop: 8 }}
            placeholder="Add a comment…"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancel();
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onPost(text);
            }}
          />
          <div className={s.popFoot}>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={() => onPost(text)} disabled={!text.trim()}>
              Post
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
