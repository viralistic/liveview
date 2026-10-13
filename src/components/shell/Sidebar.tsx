import { useEffect, useRef, useState } from 'react';
import { ChevronsUpDown, KeyRound, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Pin, Plus, RotateCcw, Users, Waypoints } from 'lucide-react';
import { COMPANIES, USERS, ROLE_LABEL } from '../../data';
import { $pinned, $sidebarCollapsed, openShare, resetDemo, switchUser, togglePin, useStore, useSession } from '../../stores/session';
import { companyMembers, highestRole, isOrgAdmin, roleForCompany, visibleWorkflows } from '../../lib/access';
import { companyHealth, healthTone } from '../../lib/health';
import { N8nMark, N8nWordmark } from '../brand/N8nLogo';
import { Avatar } from '../ui/Avatar';
import s from './shell.module.css';

export type NavKey = 'overview' | 'workflows' | 'users' | 'credentials' | 'company' | 'none';

const toneColor = { good: 'var(--green-500)', warn: 'var(--yellow-500)', bad: 'var(--red-500)' } as const;

export function Sidebar({ active, activeCompanyId }: { active: NavKey; activeCompanyId?: string }) {
  const collapsed = useStore($sidebarCollapsed);
  const { user } = useSession();
  const { grants } = useSession();
  const pinned = useStore($pinned);
  const { visibleCompanies: companies } = useSession();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);

  // keep the grid in sync with the collapsed state
  useEffect(() => {
    document.querySelector('.app')?.setAttribute('data-collapsed', String(collapsed));
    document.documentElement.toggleAttribute('data-sidebar-collapsed', collapsed);
  }, [collapsed]);

  useEffect(() => {
    if (!switcherOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!footerRef.current?.contains(e.target as Node)) setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [switcherOpen]);

  const visibleWfs = visibleWorkflows(user.id, grants);
  const criticalCount = visibleWfs.reduce((a, w) => a + w.issues.filter((i) => i.severity === 'critical').length, 0);
  const pinnedCompanies = companies.filter((c) => pinned.includes(c.id));
  const otherCompanies = companies.filter((c) => !pinned.includes(c.id));
  const admin = isOrgAdmin(user.id, grants);
  const userRole = highestRole(user.id, grants);
  const roleLine = `${admin ? 'Owner' : userRole ? ROLE_LABEL[userRole] : 'No access'} · ${COMPANIES.find((c) => c.id === user.companyId)?.shortName ?? ''}`;

  const nav = [
    { key: 'overview' as NavKey, href: '/', label: 'Overview', icon: <LayoutDashboard />, right: criticalCount ? <span className={s.navAlert}>{criticalCount}</span> : null },
    { key: 'workflows' as NavKey, href: '/workflows', label: 'All workflows', icon: <Waypoints />, right: <span className={s.navCount}>{visibleWfs.length}</span> },
    { key: 'users' as NavKey, href: '/users', label: 'Users & access', icon: <Users />, right: <span className={s.navCount}>{USERS.length}</span> },
    { key: 'credentials' as NavKey, href: '/credentials', label: 'Credentials', icon: <KeyRound />, right: null },
  ];

  const renderProject = (c: (typeof COMPANIES)[number]) => {
    const health = companyHealth(c.id);
    const isPinned = pinned.includes(c.id);
    const partial = !roleForCompany(user.id, c.id, grants);
    const members = companyMembers(c.id, grants);
    return (
      <a key={c.id} href={`/companies/${c.slug}`} className={s.company} aria-current={active === 'company' && activeCompanyId === c.id ? 'page' : undefined} title={collapsed ? c.name : `${c.name} · ${members.length} people`}>
        <span className={s.companyMark}>
          {c.initials}
          <i style={{ background: c.color }} />
        </span>
        <span className={s.companyName}>
          {c.shortName}
          {partial ? <span style={{ color: 'var(--sidebar-fg-subtle)', fontWeight: 450 }}> · partial</span> : null}
        </span>
        <span className={s.members} aria-label={`${members.length} people`}>
          {members.slice(0, 3).map((m) => (
            <Avatar key={m.user.id} user={m.user} size={16} />
          ))}
        </span>
        <span className={s.companyMeta}>
          <button
            type="button"
            className={s.pinBtn}
            data-pinned={isPinned}
            aria-label={isPinned ? 'Unpin project' : 'Pin project to top'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              togglePin(c.id);
            }}
          >
            <Pin style={isPinned ? { fill: 'currentColor' } : undefined} />
          </button>
          <span className={s.healthDot} style={{ background: toneColor[healthTone(health)] }} title={`Health ${health}`} />
        </span>
      </a>
    );
  };

  return (
    <aside className={[s.sidebar, collapsed ? s.collapsed : ''].join(' ')}>
      <div className={s.brandRow}>
        <a href="/" className={s.brand} aria-label="LiveView home">
          <N8nMark size={14} />
          {!collapsed && (
            <>
              <N8nWordmark size={14} color="#fff" />
              <span className={s.brandDivider} />
              <span className={s.product}>LiveView</span>
              <span className={s.productTag}>beta</span>
            </>
          )}
        </a>
        <button type="button" className={s.collapseBtn} onClick={() => $sidebarCollapsed.set(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
      </div>

      <nav className={s.scroll}>
        {nav.map((n) => (
          <a key={n.key} href={n.href} className={s.navItem} aria-current={active === n.key ? 'page' : undefined} title={collapsed ? n.label : undefined}>
            {n.icon}
            {!collapsed && n.label}
            {!collapsed && n.right}
          </a>
        ))}

        <div className={s.stripe} />
        <div className={s.sectionLabel}>
          <span>Projects</span>
          {admin && (
            <button type="button" aria-label="Onboard a project" onClick={() => openShare({ kind: 'org' })} title="Onboard a project">
              <Plus />
            </button>
          )}
        </div>
        {pinnedCompanies.map(renderProject)}
        {pinnedCompanies.length > 0 && otherCompanies.length > 0 && <div className={s.projectDivider} aria-hidden="true" />}
        {otherCompanies.map(renderProject)}
        {companies.length < COMPANIES.length && !collapsed && (
          <div className={s.lockedHint}>
            {COMPANIES.length - companies.length} more {COMPANIES.length - companies.length === 1 ? 'project is' : 'projects are'} hidden for {user.isYou ? 'you' : user.name.split(' ')[0]}.
          </div>
        )}
      </nav>

      <div className={s.footer} ref={footerRef}>
        {switcherOpen && (
          <div className={s.switcher} role="menu">
            <div className={s.switcherHead}>
              <span>Switch user · demo</span>
              <button type="button" onClick={() => { resetDemo(); setSwitcherOpen(false); }} title="Reset demo data">
                <RotateCcw size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                Reset
              </button>
            </div>
            {USERS.map((u) => {
              const r = highestRole(u.id, grants);
              return (
                <button key={u.id} type="button" className={s.switchItem} aria-current={u.id === user.id ? 'true' : undefined} onClick={() => { switchUser(u.id); setSwitcherOpen(false); }}>
                  <Avatar user={u} size={26} />
                  <span className={s.userMeta}>
                    <span className={s.userName}>
                      {u.name}
                      {u.online && <span className={s.onlineDot} />}
                    </span>
                    <span className={s.userRole}>{u.title} · {COMPANIES.find((c) => c.id === u.companyId)?.shortName}</span>
                  </span>
                  <span className={s.roleChip}>{isOrgAdmin(u.id, grants) ? 'Owner' : r ? ROLE_LABEL[r] : 'None'}</span>
                </button>
              );
            })}
          </div>
        )}
        <button type="button" className={s.userBtn} onClick={() => setSwitcherOpen((v) => !v)} aria-haspopup="menu" aria-expanded={switcherOpen}>
          <Avatar user={user} size={30} online={user.online} />
          <span className={s.userMeta}>
            <span className={s.userName}>
              {user.name}
              <span className={s.youTag}>you</span>
            </span>
            <span className={s.userRole}>{roleLine}</span>
          </span>
          <ChevronsUpDown />
        </button>
      </div>
    </aside>
  );
}
