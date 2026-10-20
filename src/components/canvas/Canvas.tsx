/**
 * LiveView canvas: a Figma-style infinite canvas showing every client's n8n
 * workflows as cards inside company sections. Zooming in reveals the editor;
 * zooming out is how you "close" a workflow.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Eye, MessageSquare, Share2 } from 'lucide-react';
import { COMMENTS } from '../../data/comments';
import { COMPANIES } from '../../data/companies';
import { USERS } from '../../data/users';
import { WORKFLOWS } from '../../data/workflows';
import type { Scope, Workflow } from '../../data/types';
import { buildLayout, decodeViewport, encodeViewport, nodeCenter } from '../../lib/layout';
import { canManage, canSeeCompany, canSeeWorkflow, companyMembers, highestRole, roleForCompany, usersWithAccess } from '../../lib/access';
import { $currentUser, $grants, $heatmap, $visibleCompanies, $visibleWorkflows, openShare, toast } from '../../stores/session';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { WorkflowPanel } from '../pages/WorkflowPanel';
import { Section } from './Section';
import { Sources } from './Sources';
import { Edges } from './Edges';
import { Markers } from './Markers';
import { CommentPins, DraftPin, type CanvasComment } from './Comments';
import { Cursors } from './Cursors';
import { Breadcrumb, deriveContext } from './Breadcrumb';
import { Toolbar } from './Toolbar';
import { Minimap } from './Minimap';
import { NewWorkflowButton, draftWorkflow } from './NewWorkflow';
import { buildScript, type CursorScript } from './cursorPaths';
import { $tier, $viewport, ViewportController } from './viewport';
import type { Selection, Tool } from './types';
import s from './canvas.module.css';

/** The floating rail is 380px wide and inset 16px; the camera centres fits in what is left of the canvas. */
const RAIL_W = 380 + 16;
const SECTION_HEADER_WORLD = 160;

const companyById = new Map(COMPANIES.map((c) => [c.id, c] as const));
const userById = new Map(USERS.map((u) => [u.id, u] as const));

const isTyping = (e: Event) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};

export function Canvas() {
  const me = useStore($currentUser);
  const grants = useStore($grants);
  const visibleCompanies = useStore($visibleCompanies);
  const visibleWorkflows = useStore($visibleWorkflows);
  const heat = useStore($heatmap);
  const tier = useStore($tier);

  const rootRef = useRef<HTMLDivElement>(null);
  const htmlRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const svgGRef = useRef<SVGGElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ctrl = useMemo(() => new ViewportController(), []);

  /* drafts created with "+ New workflow" live only in this view */
  const [drafts, setDrafts] = useState<Workflow[]>([]);
  const allWorkflows = useMemo(() => (drafts.length ? [...WORKFLOWS, ...drafts] : WORKFLOWS), [drafts]);
  const workflowById = useMemo(() => new Map(allWorkflows.map((w) => [w.id, w] as const)), [allWorkflows]);
  const workflowsByCompany = useMemo(() => new Map(COMPANIES.map((c) => [c.id, allWorkflows.filter((w) => w.companyId === c.id)] as const)), [allWorkflows]);

  const visibleIds = useMemo(() => {
    const ids = new Set(visibleWorkflows.map((w) => w.id));
    for (const d of drafts) ids.add(d.id);
    return ids;
  }, [visibleWorkflows, drafts]);
  // keyed on the company ids so grant edits that do not change the set keep the camera where it is
  const companyKey = visibleCompanies.map((c) => c.id).join(',');
  const layout = useMemo(() => {
    if (!companyKey) return null;
    const ids = new Set(companyKey.split(','));
    return buildLayout(COMPANIES.filter((c) => ids.has(c.id)), allWorkflows.filter((w) => ids.has(w.companyId)));
  }, [companyKey, allWorkflows]);

  const [selection, setSelectionState] = useState<Selection>(null);
  const [tool, setTool] = useState<Tool>('move');
  const [showConnections, setShowConnections] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [followId, setFollowId] = useState<string | null>(null);
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; workflowId: string } | null>(null);
  const [extraComments, setExtraComments] = useState<CanvasComment[]>([]);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);

  const railOpen = selection?.kind === 'workflow';

  const select = useCallback(
    (sel: Selection) => {
      ctrl.setRail(sel?.kind === 'workflow' ? RAIL_W : 0);
      setSelectionState(sel);
    },
    [ctrl],
  );

  /* ---------- camera helpers ---------- */
  const fitAll = useCallback(
    (animate = true) => {
      if (!layout) return;
      const v = ctrl.fit(layout.bounds, 80, 1.5);
      return animate ? ctrl.animateTo(v) : ctrl.set(v);
    },
    [layout, ctrl],
  );
  const fitSection = useCallback(
    (companyId: string, animate = true) => {
      const sec = layout?.sections.find((x) => x.companyId === companyId);
      if (!sec) return;
      const v = ctrl.fit(sec, 100, 1.5);
      return animate ? ctrl.animateTo(v) : ctrl.set(v);
    },
    [layout, ctrl],
  );
  const fitWorkflow = useCallback(
    (id: string, animate = true) => {
      const card = layout?.cards[id];
      if (!card) return;
      const v = ctrl.fit(card, 48, 1.5);
      return animate ? ctrl.animateTo(v) : ctrl.set(v);
    },
    [layout, ctrl],
  );
  const zoomToWorkflow = useCallback(
    (id: string) => {
      if (!layout?.cards[id] || !visibleIds.has(id)) return;
      select({ kind: 'workflow', id });
      fitWorkflow(id);
    },
    [layout, visibleIds, select, fitWorkflow],
  );

  /* ---------- mount: attach controller, size, initial camera, url sync ---------- */
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !htmlRef.current || !overlayRef.current || !svgGRef.current || !gridRef.current) return;
    ctrl.setSize(root.clientWidth, root.clientHeight);
    ctrl.attach({ root, html: htmlRef.current, overlay: overlayRef.current, svg: svgGRef.current, grid: gridRef.current });
    const ro = new ResizeObserver(() => ctrl.setSize(root.clientWidth, root.clientHeight));
    ro.observe(root);
    return () => {
      ro.disconnect();
      ctrl.detach();
    };
  }, [ctrl]);

  const initRef = useRef(false);
  const pendingDraftRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!layout) return;
    if (!initRef.current) {
      initRef.current = true;
      const params = new URLSearchParams(window.location.search);
      const focus = params.get('focus');
      if (focus && layout.cards[focus] && visibleIds.has(focus)) {
        select({ kind: 'workflow', id: focus });
        fitWorkflow(focus, false);
      } else if (focus && layout.sections.some((x) => x.companyId === focus)) {
        select({ kind: 'section', companyId: focus });
        fitSection(focus, false);
      } else {
        if (focus) toast('You do not have access to that');
        const v = decodeViewport(params.get('v'));
        if (v) ctrl.set(v);
        else fitAll(false);
      }
      return;
    }
    // a draft was just added: fly to it, keep everything else as it is
    const pending = pendingDraftRef.current;
    if (pending && layout.cards[pending]) {
      pendingDraftRef.current = null;
      select(null);
      fitWorkflow(pending, true);
      return;
    }
    // access changed (user switch): drop stale selection, refit
    setSelectionState((sel) => {
      if (sel?.kind === 'workflow' && !visibleIds.has(sel.id)) return null;
      if (sel?.kind === 'section' && !layout.sections.some((x) => x.companyId === sel.companyId)) return null;
      return sel;
    });
    setFollowId(null);
    fitAll(true);
  }, [layout]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ctrl.setRail(railOpen ? RAIL_W : 0);
  }, [railOpen, ctrl]);

  useEffect(() => {
    let timer: number | null = null;
    let last = '';
    const unsub = $viewport.subscribe(() => {
      if (timer != null) return;
      timer = window.setTimeout(() => {
        timer = null;
        const enc = encodeViewport(ctrl.vp);
        if (enc === last) return;
        last = enc;
        const url = new URL(window.location.href);
        url.searchParams.set('v', enc);
        url.searchParams.delete('focus');
        window.history.replaceState(null, '', url);
      }, 300);
    });
    return () => {
      unsub();
      if (timer != null) window.clearTimeout(timer);
    };
  }, [ctrl]);

  useEffect(() => {
    const off = ctrl.onInteract(() => setFollowId(null));
    return () => {
      off();
    };
  }, [ctrl]);

  /* ---------- wheel: pan, ctrl/cmd + wheel or pinch = zoom at cursor ---------- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest('[data-rail]')) return;
      e.preventDefault();
      ctrl.cancel();
      ctrl.interacted();
      const rect = root.getBoundingClientRect();
      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.deltaMode === 1) {
        dx *= 16;
        dy *= 16;
      } else if (e.deltaMode === 2) {
        dx *= rect.width;
        dy *= rect.height;
      }
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.min(1.25, Math.max(0.8, Math.exp(-dy * 0.01)));
        ctrl.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
      } else if (e.shiftKey && dx === 0) {
        ctrl.panBy(-dy, 0);
      } else {
        ctrl.panBy(-dx, -dy);
      }
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [ctrl]);

  /* ---------- keyboard ---------- */
  const escape = useCallback(() => {
    if (draft) return setDraft(null);
    if (openComment) return setOpenComment(null);
    if (followId) return setFollowId(null);
    if (selection) return select(null);
    if (!layout) return;
    const ctx = deriveContext(ctrl, layout, null, visibleIds);
    if (ctx.workflowId && ctx.companyId) fitSection(ctx.companyId);
    else if (ctx.companyId) fitAll();
  }, [draft, openComment, followId, selection, layout, ctrl, visibleIds, select, fitSection, fitAll]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || document.querySelector('[role="dialog"]')) return;
      if (e.key === 'Escape') return escape();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.shiftKey && e.code === 'Digit1') return void fitAll();
      if (e.shiftKey && e.code === 'Digit2') {
        if (selection?.kind === 'workflow') fitWorkflow(selection.id);
        else if (selection?.kind === 'section') fitSection(selection.companyId);
        else fitAll();
        return;
      }
      switch (e.key) {
        case 'v':
        case 'V':
          return setTool('move');
        case 'h':
        case 'H':
          return setTool('hand');
        case 'c':
        case 'C':
          return setTool('comment');
        case '+':
        case '=':
          ctrl.interacted();
          return void ctrl.zoomAroundCenter(1.25);
        case '-':
        case '_':
          ctrl.interacted();
          return void ctrl.zoomAroundCenter(1 / 1.25);
        case '0':
          ctrl.interacted();
          return void ctrl.zoomTo(1);
        case ' ':
          e.preventDefault();
          return setSpaceHeld(true);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
    };
  }, [escape, fitAll, fitSection, fitWorkflow, selection, ctrl]);

  /* ---------- pointer: drag = pan, click = select, double-click = fit ----------
     Touch is additive: one finger pans (or taps), a second finger turns the gesture
     into a pinch that zooms around the midpoint of the two fingers, and a double-tap
     on empty canvas zooms in one step. No inertia. */
  const drag = useRef<{ x: number; y: number; lx: number; ly: number; moved: boolean; target: Element; touch: boolean } | null>(null);
  /** active touch points by pointerId (at most two are tracked) */
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as Element;
    if (target.closest('[data-ui]') || target.closest('[data-rail]')) return;
    const touch = e.pointerType === 'touch';
    if (touch) {
      const pts = touches.current;
      if (pts.size >= 2) return; // a third finger changes nothing
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && drag.current) {
        // second finger: from here on the gesture is a pinch, never a tap
        e.currentTarget.setPointerCapture(e.pointerId);
        const d = drag.current;
        if (!d.moved) {
          d.moved = true;
          setPanning(true);
          ctrl.cancel();
          ctrl.interacted();
        }
        return;
      }
    }
    if (e.button === 1) e.preventDefault();
    drag.current = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, target, touch };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (e.pointerType === 'touch') {
      const pts = touches.current;
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      if (pts.size >= 2) {
        // pinch: zoom by the change in finger distance around the midpoint, then follow the midpoint
        const other = [...pts.entries()].find(([id]) => id !== e.pointerId)![1];
        const rect = e.currentTarget.getBoundingClientRect();
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y) || 1;
        const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y) || 1;
        const m0 = { x: (prev.x + other.x) / 2 - rect.left, y: (prev.y + other.y) / 2 - rect.top };
        const m1 = { x: (e.clientX + other.x) / 2 - rect.left, y: (e.clientY + other.y) / 2 - rect.top };
        ctrl.zoomAt(m0.x, m0.y, d1 / d0);
        ctrl.panBy(m1.x - m0.x, m1.y - m0.y);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        return;
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < (d.touch ? 8 : 4)) return;
      d.moved = true;
      setPanning(true);
      ctrl.cancel();
      ctrl.interacted();
    }
    ctrl.panBy(e.clientX - d.lx, e.clientY - d.ly);
    d.lx = e.clientX;
    d.ly = e.clientY;
  };
  const lastClick = useRef<{ t: number; x: number; y: number; el: Element | null } | null>(null);
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (e.pointerType === 'touch') {
      const pts = touches.current;
      if (!pts.has(e.pointerId)) return; // a finger we never tracked (landed on the chrome, or a third one)
      pts.delete(e.pointerId);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (pts.size > 0) {
        // one finger left after a pinch: keep panning from where it is now
        const rest = pts.values().next().value!;
        d.lx = rest.x;
        d.ly = rest.y;
        return;
      }
    }
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (d.moved) return setPanning(false);
    const t = d.target;
    // double-click detection (pointer capture retargets native dblclick to the root); fingers get more slop
    const now = performance.now();
    const prev = lastClick.current;
    const hit = t.closest('[data-section-label]') ?? t.closest('[data-wf]');
    const slop = d.touch ? 24 : 8;
    lastClick.current = hit || d.touch ? { t: now, x: e.clientX, y: e.clientY, el: hit } : null;
    if (prev && hit && prev.el === hit && now - prev.t < 400 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < slop && tool !== 'comment') {
      lastClick.current = null;
      const label = hit.getAttribute('data-section-label');
      if (label) return void fitSection(label);
      if (!hit.hasAttribute('data-locked')) return void fitWorkflow(hit.getAttribute('data-wf')!);
      return;
    }
    if (d.touch && !hit && prev && !prev.el && now - prev.t < 400 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < slop && tool !== 'comment') {
      // double-tap on empty canvas: zoom in one step around the finger
      lastClick.current = null;
      const rect = e.currentTarget.getBoundingClientRect();
      ctrl.interacted();
      return void ctrl.zoomAtAnimated(e.clientX - rect.left, e.clientY - rect.top, 1.25);
    }
    if (tool === 'comment') {
      const rect = e.currentTarget.getBoundingClientRect();
      const p = ctrl.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      setOpenComment(null);
      setDraft({ x: p.x, y: p.y, workflowId: t.closest('[data-wf]')?.getAttribute('data-wf') ?? '' });
      return;
    }
    setOpenComment(null);
    setDraft(null);
    if (tool === 'hand') return;
    const label = t.closest('[data-section-label]');
    if (label) return select({ kind: 'section', companyId: label.getAttribute('data-section-label')! });
    const card = t.closest('[data-wf]');
    if (card && card.hasAttribute('data-draft')) return toast('Draft workflow: build it in n8n first (demo)');
    if (card && !card.hasAttribute('data-locked')) return select({ kind: 'workflow', id: card.getAttribute('data-wf')! });
    select(null);
  };

  /* ---------- derived per-section data ---------- */
  const sectionMeta = useMemo(() => {
    const m = new Map<string, { members: typeof USERS; canManage: boolean; askName?: string }>();
    for (const c of visibleCompanies) {
      const admins = usersWithAccess({ kind: 'company', companyId: c.id }, grants).filter((e) => e.role === 'admin' && e.user.id !== me.id);
      const admin = admins.find((e) => !e.inherited) ?? admins[0];
      m.set(c.id, { members: companyMembers(c.id, grants).map((e) => e.user), canManage: canManage(roleForCompany(me.id, c.id, grants)), askName: admin?.user.name.split(' ')[0] });
    }
    return m;
  }, [visibleCompanies, grants, me.id]);

  const scripts = useMemo<CursorScript[]>(() => {
    if (!layout) return [];
    const out: CursorScript[] = [];
    for (const u of USERS) {
      if (!u.online || u.id === me.id || !u.presence) continue;
      const target = u.presence.viewing;
      const wf = workflowById.get(target);
      if (wf) {
        const card = layout.cards[wf.id];
        if (!card || !visibleIds.has(wf.id) || !canSeeWorkflow(u.id, wf, grants)) continue;
        out.push(buildScript(u, wf.id, wf.name, card, wf.nodes.map((n) => nodeCenter(card, n))));
      } else {
        const sec = layout.sections.find((x) => x.companyId === target);
        if (!sec || !canSeeCompany(u.id, target, grants)) continue;
        const anchors = sec.cards.filter((c) => visibleIds.has(c.workflowId)).map((c) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 }));
        out.push(buildScript(u, target, companyById.get(target)?.shortName ?? target, { x: sec.x, y: sec.y + SECTION_HEADER_WORLD, w: sec.w, h: sec.h - SECTION_HEADER_WORLD }, anchors));
      }
    }
    return out;
  }, [layout, visibleIds, grants, me.id, workflowById]);

  const comments = useMemo<CanvasComment[]>(() => [...COMMENTS.filter((c) => visibleIds.has(c.workflowId)), ...extraComments], [visibleIds, extraComments]);

  const onFollow = useCallback(
    (id: string | null) => {
      setFollowId(id);
      if (!id || !layout) return;
      const sc = scripts.find((x) => x.user.id === id);
      if (!sc) return;
      const card = layout.cards[sc.targetId];
      const sec = layout.sections.find((x) => x.companyId === sc.targetId);
      if (card) ctrl.animateTo(ctrl.fit(card, 72, 1));
      else if (sec) ctrl.animateTo(ctrl.fit(sec, 100, 1));
    },
    [layout, scripts, ctrl],
  );

  const shareView = () => {
    if (!layout) return openShare({ kind: 'org' });
    const ctx = deriveContext(ctrl, layout, selection, visibleIds);
    const scope: Scope = ctx.workflowId ? { kind: 'workflow', workflowId: ctx.workflowId } : ctx.companyId ? { kind: 'company', companyId: ctx.companyId } : { kind: 'org' };
    openShare(scope);
  };

  const myRole = highestRole(me.id, grants);
  const viewOnly = myRole === 'viewer' || myRole === 'commenter';
  const followUser = followId ? userById.get(followId) : undefined;
  const contextCompany = layout ? deriveContext(ctrl, layout, selection, visibleIds).companyId : null;

  return (
    <div
      ref={rootRef}
      className={s.root}
      data-tool={tool}
      data-space={spaceHeld}
      data-panning={panning}
      style={{ ['--rail' as string]: railOpen ? `${RAIL_W}px` : '0px' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={gridRef} className={s.grid} />
      <div ref={htmlRef} className={s.world}>
        {layout?.sections.map((sec) => {
          const company = companyById.get(sec.companyId)!;
          const meta = sectionMeta.get(sec.companyId)!;
          const selectedWf = selection?.kind === 'workflow' && layout.cards[selection.id]?.companyId === sec.companyId ? selection.id : null;
          return (
            <Section
              key={sec.companyId}
              section={sec}
              company={company}
              workflows={workflowsByCompany.get(sec.companyId) ?? []}
              visibleIds={visibleIds}
              members={meta.members}
              ownerById={userById}
              canManage={meta.canManage}
              askName={meta.askName}
              tier={tier}
              selected={selection?.kind === 'section' && selection.companyId === sec.companyId}
              selectedWf={selectedWf}
              heat={heat}
              showSources={showSources}
            />
          );
        })}
        {layout && showSources && <Sources sources={layout.sources} visibleIds={visibleIds} tier={tier} />}
      </div>
      <svg className={s.svgWorld} aria-hidden="true">
        <g ref={svgGRef}>{layout && <Edges layout={layout} workflowById={workflowById} visibleIds={visibleIds} selection={selection} showConnections={showConnections} />}</g>
      </svg>
      <div ref={overlayRef} className={s.overlay}>
        {layout && <Markers layout={layout} workflows={visibleWorkflows} onOpenPanel={(id) => select({ kind: 'workflow', id })} />}
        {layout && tier !== 'tiny' && <CommentPins layout={layout} comments={comments} workflowById={workflowById} openId={openComment} onOpen={setOpenComment} tier={tier} />}
        {draft && (
          <DraftPin
            pos={draft}
            me={me}
            onCancel={() => setDraft(null)}
            onPost={(text) => {
              if (!text.trim()) return;
              setExtraComments((prev) => [...prev, { id: `local-${Date.now()}`, workflowId: draft.workflowId, authorId: me.id, body: text.trim(), createdAt: new Date().toISOString(), resolved: false, replies: [], pos: { x: draft.x, y: draft.y } }]);
              setDraft(null);
              setTool('move');
              toast('Comment posted (demo)');
            }}
          />
        )}
      </div>

      {layout && <Cursors ctrl={ctrl} scripts={scripts} followId={followId} onFollow={onFollow} />}

      {layout ? (
        <>
          <Breadcrumb ctrl={ctrl} layout={layout} selection={selection} visibleIds={visibleIds} companyById={companyById} workflowById={workflowById} onFitAll={() => {
              select(null);
              fitAll();
            }}
            onFitSection={(id) => {
              select({ kind: 'section', companyId: id });
              fitSection(id);
            }}
            onFitWorkflow={(id) => fitWorkflow(id)}
          />
          <div className={s.topRight} data-ui>
            <Button variant="secondary" size="sm" onClick={shareView}>
              <Share2 /> Share this view
            </Button>
          </div>
          <div className={s.bottomRight} data-ui>
            {!viewOnly && (
              <NewWorkflowButton
                companies={visibleCompanies}
                defaultCompanyId={contextCompany}
                onCreate={(d) => {
                  const wf = draftWorkflow(d, me.id);
                  pendingDraftRef.current = wf.id;
                  setDrafts((prev) => [...prev, wf]);
                }}
              />
            )}
            <Minimap ctrl={ctrl} layout={layout} visibleIds={visibleIds} workflowById={workflowById} heat={heat} />
          </div>
          <Toolbar
            tool={tool}
            onTool={setTool}
            heat={heat}
            onHeat={() => $heatmap.set(!heat)}
            connections={showConnections}
            onConnections={() => setShowConnections((v) => !v)}
            sources={showSources}
            onSources={() => setShowSources((v) => !v)}
            onZoomIn={() => {
              ctrl.interacted();
              ctrl.zoomAroundCenter(1.25);
            }}
            onZoomOut={() => {
              ctrl.interacted();
              ctrl.zoomAroundCenter(1 / 1.25);
            }}
            onZoomReset={() => {
              ctrl.interacted();
              ctrl.zoomTo(1);
            }}
            onFit={() => fitAll()}
          />
          {viewOnly && (
            <div className={s.viewOnly} data-ui>
              {myRole === 'commenter' ? <MessageSquare /> : <Eye />}
              {myRole === 'commenter' ? 'Comment only' : 'View only'}
            </div>
          )}
          {followUser && (
            <div className={s.followPill} data-ui>
              <Avatar user={followUser} size={22} />
              Following {followUser.name.split(' ')[0]}
              <button type="button" onClick={() => setFollowId(null)}>
                Stop
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={s.empty}>Nothing to show for you yet. Ask an admin for access.</div>
      )}

      {railOpen && selection?.kind === 'workflow' && (
        <aside className={s.rail} data-rail data-ui aria-label="Workflow details">
          <WorkflowPanel workflowId={selection.id} onClose={() => select(null)} onFocus={zoomToWorkflow} showOpenGraph />
        </aside>
      )}
    </div>
  );
}
