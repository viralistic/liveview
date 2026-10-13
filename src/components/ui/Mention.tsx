import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { USERS, type User } from '../../data';
import { Avatar } from './Avatar';

/** Renders "@Full Name" tokens in a text as pills. */
export function renderMentions(text: string): ReactNode[] {
  const names = USERS.map((u) => u.name).sort((a, b) => b.length - a.length);
  const re = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const user = USERS.find((u) => u.name === m![1]);
    out.push(
      <span key={k++} className="mention" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 6px 0 2px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 500, fontSize: '0.92em', verticalAlign: 'baseline', border: '1px solid var(--accent-border)', lineHeight: 1.6 }}>
        {user && <Avatar user={user} size={14} />}
        {m[1].split(' ')[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Names mentioned in a text. */
export function mentionedUsers(text: string): User[] {
  return USERS.filter((u) => text.includes(`@${u.name}`));
}

/**
 * Textarea with @-autocomplete. Typing "@" opens a people list; picking one
 * inserts "@Full Name". Tagged people show as chips under the box.
 */
export function MentionInput({ value, onChange, placeholder, rows = 3, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const matches = useMemo(() => (query === null ? [] : USERS.filter((u) => u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)), [query]);
  const tagged = mentionedUsers(value);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const detect = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = before.match(/(?:^|\s)@([\w ]{0,24})$/);
    setQuery(m ? m[1]! : null);
  };
  const pick = (u: User) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@([\w ]{0,24})$/, `@${u.name} `);
    const next = before + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder ?? 'Type @ to tag someone…'}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (query === null || matches.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex((i) => (i + 1) % matches.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            pick(matches[index]!);
          } else if (e.key === 'Escape') setQuery(null);
        }}
        onClick={(e) => detect(value, (e.target as HTMLTextAreaElement).selectionStart)}
        style={{ width: '100%', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', padding: '10px 12px', background: 'var(--surface)', color: 'var(--text)', fontSize: 'var(--fs-sm)', resize: 'vertical', outline: 'none', lineHeight: 1.5 }}
      />
      {query !== null && matches.length > 0 && (
        <div style={{ position: 'absolute', left: 8, top: '100%', marginTop: 4, width: 260, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 4, zIndex: 20 }} role="listbox">
          {matches.map((u, i) => (
            <button key={u.id} type="button" role="option" aria-selected={i === index} onMouseDown={(e) => { e.preventDefault(); pick(u); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 8, background: i === index ? 'var(--surface-3)' : 'transparent', textAlign: 'left' }}>
              <Avatar user={u} size={22} />
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{u.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-2xs)', color: 'var(--text-subtle)' }}>{u.title}</span>
            </button>
          ))}
        </div>
      )}
      {tagged.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {tagged.map((u) => (
            <span key={u.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px 2px 3px', borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: 'var(--fs-xs)', fontWeight: 500 }}>
              <Avatar user={u} size={16} /> {u.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
