import { useEffect, useRef, useState } from 'react';
import { Box, CalendarDays, Check, ChevronDown, ChevronRight, ChevronsUpDown, History, KeyRound, LayoutDashboard, LayoutGrid, Lightbulb, List, PanelLeftClose, PanelLeftOpen, Pin, Plus, RotateCcw, Users, Waypoints, Workflow } from 'lucide-react';
import { COMPANIES, USERS, ROLE_LABEL } from '../../data';
import { $pinned, $sidebarCollapsed, openShare, resetDemo, switchUser, togglePin, toast, useStore, useSession } from '../../stores/session';
import { companyMembers, highestRole, isOrgAdmin, roleForCompany, visibleWorkflows } from '../../lib/access';
import { LiveViewMark } from '../brand/LiveViewMark';
import { Avatar } from '../ui/Avatar';
import s from './shell.module.css';

export type NavKey = 'overview' | 'planner' | 'workflows' | 'improvements' | 'products' | 'changelog' | 'users' | 'credentials' | 'company' | 'companies' | 'none';
export type WorkflowView = 'grid' | 'list' | 'canvas' | 'graph';

const VIEWS: { id: WorkflowView; label: string; href: string; icon: React.ReactNode }[] = [
  { id: 'grid', label: 'Grid', href: '/workflows/grid', icon: <LayoutGrid /> },
  { id: 'list', label: 'List', href: '/workflows', icon: <List /> },
  { id: 'canvas', label: 'Canvas', href: '/workflows/canvas', icon: <Workflow /> },
  { id: 'graph', label: 'Graph', href: '/workflows/graph', icon: <Waypoints /> },
];

export function Sidebar({ active, activeCompanyId, activeView }: { active: NavKey; activeCompanyId?: string; activeView?: WorkflowView }) {
  const collapsed = useStore($sidebarCollapsed);
  const { user, grants, visibleCompanies: companies } = useSession();
  const pinned = useStore($pinned);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(active === 'workflows');
  const [projectsOpen, setProjectsOpen] = useState(true);
  const footerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.querySelector('.app')?.setAttribute('data-collapsed', String(collapsed));
    document.documentElement.toggleAttribute('data-sidebar-collapsed', collapsed);
  }, [collapsed]);

  useEffect(() => {
    if (!switcherOpen && !workspaceOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!footerRef.current?.contains(e.target as Node)) setSwitcherOpen(false);
      if (!headRef.current?.contains(e.target as Node)) setWorkspaceOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [switcherOpen, workspaceOpen]);

  const visibleWfs = visibleWorkflows(user.id, grants);
  const criticalCount = visibleWfs.reduce((a, w) => a + w.issues.filter((i) => i.severity === 'critical').length, 0);
  const pinnedCompanies = companies.filter((c) => pinned.includes(c.id));
  const otherCompanies = companies.filter((c) => !pinned.includes(c.id));
  const admin = isOrgAdmin(user.id, grants);
  const userRole = highestRole(user.id, grants);
  const roleLine = `${admin ? 'Owner' : userRole ? ROLE_LABEL[userRole] : 'No access'} · ${COMPANIES.find((c) => c.id === user.companyId)?.shortName ?? ''}`;

  const renderProject = (c: (typeof COMPANIES)[number]) => {
    const isPinned = pinned.includes(c.id);
    const partial = !roleForCompany(user.id, c.id, grants);
    const members = companyMembers(c.id, grants);
    const breaking = visibleWfs.filter((w) => w.companyId === c.id).some((w) => w.issues.some((i) => i.severity === 'critical'));
    return (
      <a key={c.id} href={`/companies/${c.slug}`} className={s.company} aria-current={active === 'company' && activeCompanyId === c.id ? 'page' : undefined} title={collapsed ? c.name : `${c.name} · ${members.length} people`}>
        <span className={s.companyMark}>{c.initials}</span>
        <span className={s.companyName}>
          {c.shortName}
          {partial ? <span className={s.partial}> · partial</span> : null}
        </span>
        {breaking && <span className={s.breakingDot} title="Something is breaking" />}
        <span className={s.members} aria-label={`${members.length} people`}>
          {members.slice(0, 3).map((m) => (
            <Avatar key={m.user.id} user={m.user} size={16} />
          ))}
        </span>
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
      </a>
    );
  };

  return (
    <aside className={[s.sidebar, collapsed ? s.collapsed : ''].join(' ')}>
      {/* workspace switcher, like a team picker */}
      <div className={s.head} ref={headRef}>
        <button type="button" className={s.workspace} onClick={() => setWorkspaceOpen((v) => !v)} aria-haspopup="menu" aria-expanded={workspaceOpen}>
          <LiveViewMark size={30} />
          <span className={s.workspaceMeta}>
            <span className={s.workspaceLabel}>Viralistic</span>
            <span className={s.workspaceName}>LiveView</span>
          </span>
          <ChevronsUpDown />
        </button>
        <button type="button" className={s.collapseBtn} onClick={() => $sidebarCollapsed.set(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
        {workspaceOpen && (
          <div className={s.workspaceMenu} role="menu">
            <button type="button" className={s.workspaceItem} aria-current="true" onClick={() => setWorkspaceOpen(false)}>
              <LiveViewMark size={26} />
              <span>Viralistic LiveView</span>
              <Check />
            </button>
            <button type="button" className={s.workspaceItem} onClick={() => { setWorkspaceOpen(false); toast('Personal workspace is empty (demo)'); }}>
              <LiveViewMark size={26} color="var(--sidebar-chip)" ink="var(--sidebar-fg)" />
              <span>Personal</span>
              <kbd>⌘2</kbd>
            </button>
            <div className={s.workspaceDivider} />
            <button type="button" className={s.workspaceItem} onClick={() => { setWorkspaceOpen(false); toast('Workspace creation is not part of the demo'); }}>
              <span className={s.workspaceAdd}>
                <Plus />
              </span>
              <span>Add new workspace</span>
            </button>
          </div>
        )}
      </div>

      <nav className={s.scroll}>
        <a href="/" className={s.navItem} aria-current={active === 'overview' ? 'page' : undefined} title={collapsed ? 'Overview' : undefined}>
          <LayoutDashboard />
          {!collapsed && 'Overview'}
          {!collapsed && criticalCount > 0 && <span className={s.navAlert}>{criticalCount}</span>}
        </a>

        <a href="/planner" className={s.navItem} aria-current={active === 'planner' ? 'page' : undefined} title={collapsed ? 'Planner' : undefined}>
          <CalendarDays />
          {!collapsed && 'Planner'}
        </a>

        <div className={s.navGroup}>
          <a href="/workflows/canvas" className={s.navItem} aria-current={active === 'workflows' ? 'page' : undefined} title={collapsed ? 'Workflows' : undefined}>
            <Waypoints />
            {!collapsed && 'Workflows'}
            {!collapsed && <span className={s.navCount}>{visibleWfs.length}</span>}
            {!collapsed && (
              <button
                type="button"
                className={s.caret}
                aria-label={viewsOpen ? 'Hide views' : 'Show views'}
                aria-expanded={viewsOpen}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setViewsOpen((v) => !v);
                }}
              >
                {viewsOpen ? <ChevronDown /> : <ChevronRight />}
              </button>
            )}
          </a>
          {viewsOpen && !collapsed && (
            <div className={s.subNav}>
              {VIEWS.map((v) => (
                <a key={v.id} href={v.href} className={s.subItem} aria-current={active === 'workflows' && activeView === v.id ? 'page' : undefined}>
                  {v.icon}
                  {v.label}
                </a>
              ))}
            </div>
          )}
        </div>

        <a href="/improvements" className={s.navItem} aria-current={active === 'improvements' ? 'page' : undefined} title={collapsed ? 'Improvements' : undefined}>
          <Lightbulb />
          {!collapsed && 'Improvements'}
        </a>
        <a href="/products" className={[s.navItem, s.navProduct].join(' ')} aria-current={active === 'products' ? 'page' : undefined} title={collapsed ? 'Products' : undefined}>
          <Box />
          {!collapsed && 'Products'}
        </a>
        <a href="/changelog" className={s.navItem} aria-current={active === 'changelog' ? 'page' : undefined} title={collapsed ? 'Changelog' : undefined}>
          <History />
          {!collapsed && 'Changelog'}
        </a>
        <a href="/users" className={s.navItem} aria-current={active === 'users' ? 'page' : undefined} title={collapsed ? 'Users & access' : undefined}>
          <Users />
          {!collapsed && 'Users & access'}
        </a>
        <a href="/credentials" className={s.navItem} aria-current={active === 'credentials' ? 'page' : undefined} title={collapsed ? 'Credentials' : undefined}>
          <KeyRound />
          {!collapsed && 'Credentials'}
        </a>

        <div className={s.stripe} />
        <div className={s.sectionLabel}>
          <button type="button" className={s.sectionToggle} onClick={() => setProjectsOpen((v) => !v)} aria-expanded={projectsOpen}>
            {projectsOpen ? <ChevronDown /> : <ChevronRight />}
            <span>Projects</span>
          </button>
          {admin && (
            <button type="button" aria-label="Onboard a project" onClick={() => openShare({ kind: 'org' })} title="Onboard a project">
              <Plus />
            </button>
          )}
        </div>
        {(projectsOpen || collapsed) && (
          <>
            {pinnedCompanies.map(renderProject)}
            {pinnedCompanies.length > 0 && otherCompanies.length > 0 && <div className={s.projectDivider} aria-hidden="true" />}
            {otherCompanies.map(renderProject)}
          </>
        )}
        {companies.length < COMPANIES.length && !collapsed && projectsOpen && (
          <div className={s.lockedHint}>
            {COMPANIES.length - companies.length} more hidden for {user.isYou ? 'you' : user.name.split(' ')[0]}.
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
