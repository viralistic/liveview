import { useEffect, useRef, useState } from 'react';
import { Box, CalendarDays, Check, ChevronDown, ChevronRight, ChevronsUpDown, History, KeyRound, LayoutDashboard, LayoutGrid, Lightbulb, List, Map as MapIcon, Menu, PanelLeftClose, PanelLeftOpen, Pin, Plus, RotateCcw, Server, Settings2, Siren, Users, UsersRound, Waypoints, Workflow, X } from 'lucide-react';
import { COMPANIES, ROUTE_LABEL, USERS, VERTICAL_STATUS_LABEL, verticalsFor } from '../../data';
import type { NavId } from '../../data/personas';
import { $mobileNav, $pinned, $sidebarCollapsed, closeMobileNav, openMobileNav, resetDemo, switchUser, togglePin, toast, useIsMobile, useStore, useSession } from '../../stores/session';
import { $newProjects, openNewProject, openProjectSettings } from '../../stores/projects';
import { companyMembers, roleForCompany, visibleWorkflows } from '../../lib/access';
import { personaGroups, personaOf, roleLine } from '../../lib/persona';
import { orgOfUser } from '../../data/orgs';
import { LiveViewMark } from '../brand/LiveViewMark';
import { Avatar } from '../ui/Avatar';
import s from './shell.module.css';

export type NavKey = 'overview' | 'planner' | 'incidents' | 'instances' | 'teams' | 'workflows' | 'improvements' | 'products' | 'changelog' | 'users' | 'credentials' | 'company' | 'companies' | 'none';
export type WorkflowView = 'grid' | 'list' | 'canvas' | 'graph';

const VIEWS: { id: WorkflowView; label: string; href: string; icon: React.ReactNode }[] = [
  { id: 'grid', label: 'Grid', href: '/workflows/grid', icon: <LayoutGrid /> },
  { id: 'list', label: 'List', href: '/workflows', icon: <List /> },
  { id: 'canvas', label: 'Canvas', href: '/workflows/canvas', icon: <Workflow /> },
  { id: 'graph', label: 'Graph', href: '/workflows/graph', icon: <Waypoints /> },
];

/** Top-level navigation. Which items exist depends on the persona (data/personas.ts). */
const NAV: Record<Exclude<NavId, 'workflows' | 'roadmap'>, { label: string; href: string; icon: React.ReactNode; key: NavKey }> = {
  overview: { label: 'Overview', href: '/', icon: <LayoutDashboard />, key: 'overview' },
  planner: { label: 'Planner', href: '/planner', icon: <CalendarDays />, key: 'planner' },
  incidents: { label: 'Incidents', href: '/incidents', icon: <Siren />, key: 'incidents' },
  instances: { label: 'Instances', href: '/instances', icon: <Server />, key: 'instances' },
  teams: { label: 'Teams', href: '/teams', icon: <UsersRound />, key: 'teams' },
  improvements: { label: 'Improvements', href: '/improvements', icon: <Lightbulb />, key: 'improvements' },
  products: { label: 'Products', href: '/products', icon: <Box />, key: 'products' },
  changelog: { label: 'Changelog', href: '/changelog', icon: <History />, key: 'changelog' },
  users: { label: 'Users & access', href: '/users', icon: <Users />, key: 'users' },
  credentials: { label: 'Credentials', href: '/credentials', icon: <KeyRound />, key: 'credentials' },
};

export function Sidebar({ active, activeCompanyId, activeView, activeVerticalId }: { active: NavKey; activeCompanyId?: string; activeView?: WorkflowView; activeVerticalId?: string }) {
  const collapsedPref = useStore($sidebarCollapsed);
  const isMobile = useIsMobile();
  const mobileOpen = useStore($mobileNav);
  // on a phone the sidebar is a drawer: never collapsed, closed until opened
  const collapsed = collapsedPref && !isMobile;
  const { user, grants, persona, org, can, visibleCompanies: companies } = useSession();
  const pinned = useStore($pinned);
  const newProjects = useStore($newProjects);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(active === 'workflows');
  const [listOpen, setListOpen] = useState(true);
  const footerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.querySelector('.app')?.setAttribute('data-collapsed', String(collapsed));
    document.documentElement.toggleAttribute('data-sidebar-collapsed', collapsed);
  }, [collapsed]);

  // drawer: close on Escape, lock page scroll while open
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMobileNav();
    window.addEventListener('keydown', onKey);
    document.documentElement.setAttribute('data-drawer', 'open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.removeAttribute('data-drawer');
    };
  }, [mobileOpen]);

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
  const myCompany = COMPANIES.find((c) => c.id === user.companyId);

  const navItem = (id: NavId) => {
    if (id === 'workflows') {
      return (
        <div className={s.navGroup} key={id}>
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
      );
    }
    if (id === 'roadmap') {
      const href = myCompany ? `/companies/${myCompany.slug}` : '/companies';
      const current = active === 'company' && activeCompanyId === user.companyId;
      return (
        <a key={id} href={href} className={s.navItem} aria-current={current ? 'page' : undefined} title={collapsed ? 'Roadmap & scope' : undefined}>
          <MapIcon />
          {!collapsed && 'Roadmap & scope'}
        </a>
      );
    }
    const n = NAV[id];
    return (
      <a key={id} href={n.href} className={[s.navItem, id === 'products' ? s.navProduct : ''].join(' ')} aria-current={active === n.key ? 'page' : undefined} title={collapsed ? n.label : undefined}>
        {n.icon}
        {!collapsed && n.label}
        {!collapsed && id === 'overview' && criticalCount > 0 && can('respond-incidents') && <span className={s.navAlert}>{criticalCount}</span>}
        {!collapsed && id === 'incidents' && criticalCount > 0 && <span className={s.navAlert}>{criticalCount}</span>}
      </a>
    );
  };

  /* ---- the list under the stripe: projects, instances, teams or assigned workflows ---- */
  const pinnedCompanies = companies.filter((c) => pinned.includes(c.id));
  const otherCompanies = companies.filter((c) => !pinned.includes(c.id));

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
          className={s.gearBtn}
          aria-label={`${c.shortName} settings`}
          title="Project settings"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openProjectSettings(c.id);
          }}
        >
          <Settings2 />
        </button>
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

  const renderInstance = (c: (typeof COMPANIES)[number]) => {
    const breaking = visibleWfs.filter((w) => w.companyId === c.id).some((w) => w.issues.some((i) => i.severity === 'critical'));
    return (
      <a key={c.id} href={`/instances#${c.id}`} className={s.company} aria-current={active === 'instances' && activeCompanyId === c.id ? 'page' : undefined} title={collapsed ? c.name : `${c.name} · ${ROUTE_LABEL[c.route]} · n8n ${c.n8nVersion}`}>
        <span className={s.companyMark}>{c.initials}</span>
        <span className={s.companyName}>{c.shortName}</span>
        {breaking && <span className={s.breakingDot} title="Something is breaking" />}
        <span className={s.routeTag} data-route={c.route}>
          {c.route === 'partner' ? 'Partner' : 'Local'}
        </span>
      </a>
    );
  };

  const renderTeam = (v: ReturnType<typeof verticalsFor>[number]) => {
    const people = [...(v.managerId ? [v.managerId] : []), ...v.memberIds].map((id) => USERS.find((u) => u.id === id)!).filter(Boolean);
    const mine = user.verticalId === v.id;
    return (
      <a key={v.id} href={`/teams/${v.id}`} className={s.company} aria-current={active === 'teams' && activeVerticalId === v.id ? 'page' : undefined} title={collapsed ? v.name : `${v.name} · ${VERTICAL_STATUS_LABEL[v.status]}`}>
        <span className={s.companyMark} data-status={v.status}>
          {v.name.slice(0, 2).toUpperCase()}
        </span>
        <span className={s.companyName}>
          {v.name}
          {mine ? <span className={s.partial}> · you</span> : null}
        </span>
        {v.status !== 'live' && <span className={s.statusTag}>{VERTICAL_STATUS_LABEL[v.status]}</span>}
        <span className={s.members} aria-label={`${people.length} people`}>
          {people.slice(0, 3).map((u) => (
            <Avatar key={u.id} user={u} size={16} />
          ))}
        </span>
      </a>
    );
  };

  const renderAssigned = (w: (typeof visibleWfs)[number]) => {
    const c = COMPANIES.find((x) => x.id === w.companyId);
    const breaking = w.issues.some((i) => i.severity === 'critical');
    return (
      <a key={w.id} href={`/workflows/canvas?focus=${w.id}`} className={s.company} title={collapsed ? w.name : `${w.name} · ${c?.shortName}`}>
        <span className={s.companyMark}>{c?.initials}</span>
        <span className={s.companyName}>{w.name}</span>
        {breaking && <span className={s.breakingDot} title="Something is breaking" />}
      </a>
    );
  };

  const listKind = persona.sideList;
  const listLabel = listKind === 'projects' ? 'Projects' : listKind === 'instances' ? 'Instances' : listKind === 'teams' ? 'Teams' : 'Assigned';
  const teams = listKind === 'teams' ? verticalsFor(user.companyId) : [];

  const tabs = persona.nav.filter((n) => n !== 'roadmap').slice(0, 4);
  const tabMeta = (id: NavId): { label: string; href: string; icon: React.ReactNode; key: NavKey } =>
    id === 'workflows' ? { label: 'Workflows', href: '/workflows/canvas', icon: <Waypoints />, key: 'workflows' } : NAV[id as Exclude<NavId, 'workflows' | 'roadmap'>];

  return (
    <>
    {mobileOpen && <div className={s.backdrop} onClick={closeMobileNav} aria-hidden="true" />}
    <nav className={s.tabbar} aria-label="Primary">
      {tabs.map((id) => {
        const t = tabMeta(id);
        return (
          <a key={id} href={t.href} className={s.tab} aria-current={active === t.key ? 'page' : undefined}>
            {t.icon}
            {t.label === 'Users & access' ? 'Users' : t.label}
          </a>
        );
      })}
      <button type="button" className={s.tab} onClick={openMobileNav} aria-label="Open menu">
        <Menu />
        Menu
      </button>
    </nav>
    <aside
      className={[s.sidebar, collapsed ? s.collapsed : ''].join(' ')}
      data-open={mobileOpen ? 'true' : undefined}
      onClick={(e) => {
        if (isMobile && (e.target as HTMLElement).closest('a[href]')) closeMobileNav();
      }}
    >
      {/* workspace switcher: the organization you belong to */}
      <div className={s.head} ref={headRef}>
        <button type="button" className={s.workspace} onClick={() => setWorkspaceOpen((v) => !v)} aria-haspopup="menu" aria-expanded={workspaceOpen}>
          <LiveViewMark size={30} />
          <span className={s.workspaceMeta}>
            <span className={s.workspaceLabel}>{org.shortName}</span>
            <span className={s.workspaceName}>LiveView</span>
          </span>
          <ChevronsUpDown />
        </button>
        <button type="button" className={s.collapseBtn} onClick={() => $sidebarCollapsed.set(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
        <button type="button" className={s.drawerClose} onClick={closeMobileNav} aria-label="Close menu">
          <X />
        </button>
        {workspaceOpen && (
          <div className={s.workspaceMenu} role="menu">
            <button type="button" className={s.workspaceItem} aria-current="true" onClick={() => setWorkspaceOpen(false)}>
              <LiveViewMark size={26} />
              <span>{org.shortName} LiveView</span>
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
        {persona.nav.map(navItem)}

        <div className={s.stripe} />
        <div className={s.sectionLabel}>
          <button type="button" className={s.sectionToggle} onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen}>
            {listOpen ? <ChevronDown /> : <ChevronRight />}
            <span>{listLabel}</span>
          </button>
          {can('manage-access') && listKind === 'projects' && (
            <button type="button" aria-label="New project" onClick={openNewProject} title="New project">
              <Plus />
            </button>
          )}
          {can('manage-access') && listKind === 'teams' && (
            <button type="button" aria-label="Onboard a vertical" onClick={() => toast('Onboarding a new vertical starts with a workshop. Ask Viralistic (demo).')} title="Onboard a vertical">
              <Plus />
            </button>
          )}
        </div>
        {(listOpen || collapsed) && listKind === 'projects' && (
          <>
            {pinnedCompanies.map(renderProject)}
            {pinnedCompanies.length > 0 && otherCompanies.length > 0 && <div className={s.projectDivider} aria-hidden="true" />}
            {otherCompanies.map(renderProject)}
            {newProjects.map((p) => (
              <button key={p.id} type="button" className={s.company} onClick={() => openProjectSettings(p.id)} title={collapsed ? p.settings.name : `${p.settings.name} · onboarding`}>
                <span className={s.companyMark} data-status="onboarding">
                  {p.settings.name.slice(0, 2).toUpperCase()}
                </span>
                <span className={s.companyName}>{p.settings.name}</span>
                <span className={s.statusTag}>Onboarding</span>
                <span className={s.gearBtn} style={{ opacity: 1 }}>
                  <Settings2 />
                </span>
              </button>
            ))}
          </>
        )}
        {(listOpen || collapsed) && listKind === 'instances' && companies.map(renderInstance)}
        {(listOpen || collapsed) && listKind === 'teams' && teams.map(renderTeam)}
        {(listOpen || collapsed) && listKind === 'assigned' && visibleWfs.map(renderAssigned)}
        {listKind === 'projects' && companies.length < COMPANIES.length && !collapsed && listOpen && (
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
            <div className={s.switcherScroll}>
              {personaGroups(USERS).map((g) => (
                <div key={g.kind}>
                  <div className={s.switcherGroup}>{g.label}</div>
                  {g.users.map((u) => (
                    <button key={u.id} type="button" className={s.switchItem} aria-current={u.id === user.id ? 'true' : undefined} onClick={() => { switchUser(u.id); setSwitcherOpen(false); }}>
                      <Avatar user={u} size={26} interactive={false} />
                      <span className={s.userMeta}>
                        <span className={s.userName}>
                          {u.name}
                          {u.online && <span className={s.onlineDot} />}
                        </span>
                        <span className={s.userRole}>
                          {u.title}
                          {g.kind === 'client' ? ` · ${orgOfUser(u).shortName}` : ''}
                        </span>
                      </span>
                      <span className={s.roleChip} title={personaOf(u).label}>
                        {personaOf(u).short}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <button type="button" className={s.userBtn} onClick={() => setSwitcherOpen((v) => !v)} aria-haspopup="menu" aria-expanded={switcherOpen}>
          <Avatar user={user} size={30} online={user.online} interactive={false} />
          <span className={s.userMeta}>
            <span className={s.userName}>
              {user.name}
              <span className={s.youTag}>you</span>
            </span>
            <span className={s.userRole}>{roleLine(user)}</span>
          </span>
          <ChevronsUpDown />
        </button>
      </div>
    </aside>
    </>
  );
}
