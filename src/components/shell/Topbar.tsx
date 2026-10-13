import { useEffect, useMemo, useState } from 'react';
import { Bell, Building2, ChevronRight, Monitor, Moon, Search, Share2, Sun, Waypoints, Workflow, Users as UsersIcon, KeyRound, LayoutDashboard } from 'lucide-react';
import type { Scope } from '../../data/types';
import { COMPANIES, USERS, WORKFLOWS } from '../../data';
import { openShare, useSession, $theme, applyTheme, cycleTheme, useStore } from '../../stores/session';
import { canSeeCompany, canSeeWorkflow, roleForScope, canManage } from '../../lib/access';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { Modal } from '../ui/Modal';
import { Tooltip } from '../ui/Tooltip';
import s from './shell.module.css';

export interface Crumb {
  label: string;
  href?: string;
}
export interface TopbarContext {
  companyId?: string;
  workflowId?: string;
}

export function Topbar({ crumbs, shareScope, context }: { crumbs: Crumb[]; shareScope?: Scope; context?: TopbarContext }) {
  const { user } = useSession();
  const { grants } = useSession();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const theme = useStore($theme);
  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // who else is online *and allowed to see* what you are looking at
  const others = USERS.filter((u) => u.online && u.id !== user.id).filter((u) => {
    if (context?.workflowId) {
      const wf = WORKFLOWS.find((w) => w.id === context.workflowId);
      return wf ? canSeeWorkflow(u.id, wf, grants) : true;
    }
    if (context?.companyId) return canSeeCompany(u.id, context.companyId, grants);
    return true;
  });

  const scope: Scope = shareScope ?? { kind: 'org' };
  const myRole = roleForScope(user.id, scope, grants);
  const shareLabel = canManage(myRole) ? 'Share' : 'Share';
  const last = crumbs[crumbs.length - 1];

  return (
    <header className={s.topbar}>
      <nav className={s.crumbs} aria-label="Breadcrumb">
        {crumbs.slice(0, -1).map((c, i) => (
          <span key={i} style={{ display: 'contents' }}>
            {c.href ? <a href={c.href}>{c.label}</a> : <span>{c.label}</span>}
            <ChevronRight />
          </span>
        ))}
        {last && <span className={s.crumbCurrent}>{last.label}</span>}
      </nav>

      <div className={s.topRight}>
        <button type="button" className={s.search} onClick={() => setPaletteOpen(true)} aria-label="Search">
          <Search />
          <span>Search…</span>
          <Kbd>⌘K</Kbd>
        </button>
        <span className={s.divider} />
        <div className={s.presence} aria-label={`${others.length} people online`}>
          {others.slice(0, 3).map((u) => (
            <Tooltip key={u.id} label={`${u.name} · ${u.title}`} side="bottom">
              <span className={s.presenceAv}>
                <Avatar user={u} size={20} />
              </span>
            </Tooltip>
          ))}
          {others.length > 0 && (
            <span className={s.liveCount}>
              <span className="pulse" style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--health-full)', display: 'inline-block' }} />
              {others.length}
            </span>
          )}
        </div>
        <Button variant="primary" onClick={() => openShare(scope)}>
          <Share2 />
          {shareLabel}
        </Button>
        <Tooltip label={theme === 'system' ? 'Theme: system' : theme === 'dark' ? 'Theme: dark' : 'Theme: light'} side="bottom">
          <button type="button" className={s.iconBtn} aria-label="Switch theme" onClick={cycleTheme}>
            {theme === 'dark' ? <Moon /> : theme === 'light' ? <Sun /> : <Monitor />}
          </button>
        </Tooltip>
        <button type="button" className={s.iconBtn} aria-label="Notifications">
          <Bell />
          <span className={s.bellDot} />
        </button>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const { user } = useSession();
  const { grants } = useSession();
  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  const items = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const pages = [
      { group: 'Pages', label: 'Overview', href: '/', icon: <LayoutDashboard size={15} /> },
      { group: 'Pages', label: 'All workflows', href: '/workflows', icon: <Waypoints size={15} /> },
      { group: 'Pages', label: 'Canvas view', href: '/workflows/canvas', icon: <Waypoints size={15} /> },
      { group: 'Pages', label: 'Graph view', href: '/workflows/graph', icon: <Waypoints size={15} /> },
      { group: 'Pages', label: 'Users & access', href: '/users', icon: <UsersIcon size={15} /> },
      { group: 'Pages', label: 'Credentials', href: '/credentials', icon: <KeyRound size={15} /> },
    ];
    const companies = COMPANIES.filter((c) => canSeeCompany(user.id, c.id, grants)).map((c) => ({ group: 'Companies', label: c.name, href: `/companies/${c.slug}`, icon: <Building2 size={15} /> }));
    const wfs = WORKFLOWS.filter((w) => canSeeWorkflow(user.id, w, grants)).map((w) => ({
      group: 'Workflows',
      label: w.name,
      hint: COMPANIES.find((c) => c.id === w.companyId)?.shortName,
      href: `/workflows/canvas?focus=${w.id}`,
      icon: <Workflow size={15} />,
    }));
    const all = [...pages, ...companies, ...wfs] as { group: string; label: string; href: string; icon: React.ReactNode; hint?: string }[];
    return ql ? all.filter((i) => i.label.toLowerCase().includes(ql) || i.hint?.toLowerCase().includes(ql)) : all.slice(0, 14);
  }, [q, user.id, grants]);

  return (
    <Modal open={open} onClose={onClose} title={<span className="sr-only">Search</span>} width={600}>
      <div style={{ margin: '-16px -20px -20px' }}>
        <div className={s.paletteInput}>
          <Search />
          <input autoFocus placeholder="Search workflows, companies, pages…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Kbd>esc</Kbd>
        </div>
        <div className={s.paletteList}>
          {items.length === 0 && <div style={{ padding: 20, color: 'var(--text-muted)' }}>No results for “{q}”</div>}
          {['Pages', 'Companies', 'Workflows'].map((g) => {
            const rows = items.filter((i) => i.group === g);
            if (!rows.length) return null;
            return (
              <div key={g}>
                <div className={s.paletteGroup}>{g}</div>
                {rows.map((i) => (
                  <a key={i.href + i.label} href={i.href} className={s.paletteItem}>
                    <span style={{ color: 'var(--text-subtle)', display: 'grid' }}>{i.icon}</span>
                    {i.label}
                    {i.hint && <small>{i.hint}</small>}
                  </a>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
