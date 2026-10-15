/**
 * Network view of a product's forks, like GitHub's network graph: one lane for
 * main with a dot per commit (version tags above), a lane per fork that
 * branches off main at the commit it was forked from, forks of forks nested
 * under their parent, and merged forks curving back into their parent lane.
 * Columns are time slots (one per distinct event), so the graph never overlaps.
 * SVG, theme-aware through tokens; lines draw in on mount.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CornerDownRight, GitBranch } from 'lucide-react';
import { FORK_STATUS_LABEL, type Commit, type Fork, type Product } from '../../data/types';
import { userById } from '../../data/users';
import { relTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import s from './products.module.css';

const LANE_H = 30;
const TOP = 24;
const BOTTOM = 10;
const PAD_L = 18;
const PAD_R = 22;
const DEFAULT_W = 760;

interface Lane {
  fork: Fork | null;
  depth: number;
  parentIndex: number;
}

/** main first, then forks by creation date, each followed by its own forks. */
function orderLanes(forks: Fork[]): Lane[] {
  const lanes: Lane[] = [{ fork: null, depth: 0, parentIndex: -1 }];
  const byCreated = [...forks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ids = new Set(forks.map((f) => f.id));
  const add = (f: Fork, depth: number, parentIndex: number) => {
    const idx = lanes.length;
    lanes.push({ fork: f, depth, parentIndex });
    for (const c of byCreated) if (c.parentForkId === f.id) add(c, depth + 1, idx);
  };
  for (const f of byCreated) if (!f.parentForkId || !ids.has(f.parentForkId)) add(f, 1, 0);
  return lanes;
}

const T = (iso: string) => new Date(iso).getTime();
const r1 = (n: number) => Math.round(n * 10) / 10;

interface LaneGeo {
  lane: Lane;
  y: number;
  /** times of this lane's own dots (branch point first) */
  dotTimes: number[];
  path: string;
  mergePath?: string;
  proposedPath?: string;
  xStart: number;
  xEnd: number;
}

export function ForkNetwork({ product, commits, forks, version, activeId, onOpen }: { product: Product; commits: Commit[]; forks: Fork[]; version: number; activeId?: string | null; onOpen: (fork: Fork) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(DEFAULT_W);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setW(Math.max(320, Math.floor(e.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const asc = [...commits].sort((a, b) => a.at.localeCompare(b.at));
    const lanes = orderLanes(forks);
    const times = new Set<number>();
    for (const c of asc) times.add(T(c.at));

    // own dots per fork: branch point, then commits ahead spread until the last update
    const own = new Map<string, { dots: number[]; tip: number; end: number; merge?: number }>();
    for (const l of lanes) {
      const f = l.fork;
      if (!f) continue;
      const created = T(f.createdAt);
      const updated = Math.max(T(f.updatedAt), created + 1);
      const dots = [created];
      for (let i = 0; i < f.commitsAhead; i++) dots.push(Math.round(created + ((i + 1) / (f.commitsAhead + 1)) * (updated - created)));
      const tip = dots[dots.length - 1]!;
      let merge: number | undefined;
      let end = Math.max(updated, tip);
      if (f.status === 'merged') {
        const mc = asc.find((c) => c.forkId === f.id);
        merge = mc ? T(mc.at) : updated;
        if (merge <= tip) merge = tip + 1;
        end = tip;
        times.add(merge);
      }
      for (const t of dots) times.add(t);
      times.add(end);
      own.set(f.id, { dots, tip, end, merge });
    }
    const cols = Array.from(times).sort((a, b) => a - b);
    const idx = new Map(cols.map((t, i) => [t, i] as const));
    const step = (w - PAD_L - PAD_R) / Math.max(1, cols.length - 1);
    const X = (t: number) => PAD_L + (idx.get(t) ?? 0) * step;
    const Y = (laneIndex: number) => TOP + laneIndex * LANE_H + LANE_H / 2;

    const laneGeos: LaneGeo[] = lanes.map((lane, i) => ({ lane, y: Y(i), dotTimes: [], path: '', xStart: PAD_L, xEnd: w - PAD_R }));
    const mainTimes = asc.map((c) => T(c.at));
    if (asc.length) laneGeos[0]!.xStart = X(mainTimes[0]!);
    laneGeos[0]!.dotTimes = mainTimes;
    laneGeos[0]!.path = `M${r1(laneGeos[0]!.xStart)} ${Y(0)} L${r1(w - PAD_R)} ${Y(0)}`;

    lanes.forEach((lane, i) => {
      const f = lane.fork;
      if (!f) return;
      const o = own.get(f.id)!;
      const parent = laneGeos[lane.parentIndex]!;
      const created = o.dots[0]!;
      const parentDots = lane.parentIndex === 0 ? mainTimes : parent.dotTimes;
      const before = parentDots.filter((t) => t <= created);
      const branchT = before.length ? before[before.length - 1]! : parentDots[0];
      const xb = branchT !== undefined ? X(branchT) : PAD_L;
      let xc = X(created);
      if (xc <= xb) xc = xb + step * 0.9;
      const yP = parent.y;
      const yF = Y(i);
      const dx = Math.max(6, (xc - xb) * 0.55);
      const xEnd = Math.max(xc, X(o.end));
      const g = laneGeos[i]!;
      g.dotTimes = o.dots;
      g.xStart = xb;
      g.xEnd = xEnd;
      g.path = `M${r1(xb)} ${r1(yP)} C${r1(xb + dx)} ${r1(yP)}, ${r1(xc - dx)} ${r1(yF)}, ${r1(xc)} ${r1(yF)} L${r1(xEnd)} ${r1(yF)}`;
      const xTip = Math.max(xc, X(o.tip));
      if (o.merge !== undefined) {
        const xm = Math.max(xTip + step * 0.8, X(o.merge));
        const dm = Math.max(6, (xm - xTip) * 0.55);
        g.mergePath = `M${r1(xTip)} ${r1(yF)} C${r1(xTip + dm)} ${r1(yF)}, ${r1(xm - dm)} ${r1(yP)}, ${r1(xm)} ${r1(yP)}`;
        g.xEnd = xTip;
      } else if (f.status === 'pr-open') {
        const xm = Math.min(w - PAD_R, xEnd + step * 1.6);
        const dm = Math.max(6, (xm - xEnd) * 0.55);
        g.proposedPath = `M${r1(xEnd)} ${r1(yF)} C${r1(xEnd + dm)} ${r1(yF)}, ${r1(xm - dm)} ${r1(yP)}, ${r1(xm)} ${r1(yP)}`;
      }
    });

    // version tags on main: the current one always, older ones when there is room
    const tagged = asc.filter((c) => c.version).sort((a, b) => b.at.localeCompare(a.at));
    const shownTags = new Set<string>();
    let lastX = Infinity;
    for (const c of tagged) {
      const x = X(T(c.at));
      if (c.version === version || lastX - x >= 26) {
        shownTags.add(c.sha);
        lastX = x;
      }
    }

    const h = TOP + lanes.length * LANE_H + BOTTOM;
    return { asc, lanes, laneGeos, X, h, shownTags, step };
  }, [commits, forks, version, w]);

  const { asc, lanes, laneGeos, X, h, shownTags } = geo;
  const active = hover ?? activeId ?? null;
  const dimming = hover !== null;
  const delayFor = (i: number, x: number) => Math.round(120 + i * 70 + (x / Math.max(1, w)) * 520);

  return (
    <div className={s.net} data-dim={dimming}>
      <div className={s.netLabels} style={{ paddingTop: TOP - LANE_H / 2 + 1 }}>
        {lanes.map((lane, i) => {
          const f = lane.fork;
          if (!f) {
            return (
              <div key="main" className={s.netLabel} data-main="true" style={{ height: LANE_H }}>
                <span className={s.netMainMark}>
                  <GitBranch />
                </span>
                <span className={s.netName}>
                  <b>main</b>
                  <span className={s.netMuted}> · v{version}</span>
                </span>
              </div>
            );
          }
          const author = userById(f.authorId);
          return (
            <button
              key={f.id}
              type="button"
              className={s.netLabel}
              style={{ height: LANE_H, paddingLeft: 6 + (lane.depth - 1) * 16 }}
              data-active={active === f.id}
              data-status={f.status}
              onMouseEnter={() => setHover(f.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onOpen(f)}
              title={`${f.name} · ${FORK_STATUS_LABEL[f.status]} · ${author.name} · updated ${relTime(f.updatedAt)}`}
            >
              {lane.depth > 1 && <CornerDownRight className={s.netNest} />}
              <Avatar user={author} size={18} />
              <span className={s.netName}>{f.name}</span>
              <span className={s.netStatusDot} data-status={f.status} aria-hidden="true" />
              {i === 0 ? null : null}
            </button>
          );
        })}
      </div>
      <div className={s.netCanvas} ref={ref}>
        <svg className={s.netSvg} width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMinYMid meet" role="img" aria-label={`${forks.length} forks of ${product.name}`}>
          {/* fork lanes first so main draws on top of the branch points */}
          {laneGeos.map((g, i) => {
            const f = g.lane.fork;
            if (!f) return null;
            const laneDelay = 120 + i * 70;
            return (
              <g key={f.id} className={s.netLane} data-status={f.status} data-active={active === f.id} onMouseEnter={() => setHover(f.id)} onMouseLeave={() => setHover(null)} onClick={() => onOpen(f)} style={{ cursor: 'pointer' }}>
                <path className={s.netHit} d={g.path} />
                <path className={s.netPath} d={g.path} pathLength={1} style={{ '--d': laneDelay } as CSSProperties} />
                {g.mergePath && <path className={[s.netPath, s.netMerge].join(' ')} d={g.mergePath} pathLength={1} style={{ '--d': laneDelay + 420 } as CSSProperties} />}
                {g.proposedPath && <path className={[s.netPath, s.netProposed].join(' ')} d={g.proposedPath} pathLength={1} style={{ '--d': laneDelay + 420 } as CSSProperties} />}
                {g.dotTimes.map((t, k) => {
                  const x = k === 0 ? Math.max(X(t), g.xStart + 1) : Math.max(X(t), g.xStart + 1);
                  const xx = k === 0 ? Math.min(Math.max(x, g.xStart + 6), g.xEnd) : Math.min(x, g.xEnd);
                  return (
                    <circle key={k} className={s.netDot} data-branch={k === 0} cx={r1(k === 0 ? Math.max(xx, X(t) <= g.xStart ? g.xStart + geo.step * 0.9 : X(t)) : xx)} cy={g.y} r={k === 0 ? 3.4 : 3} style={{ '--d': delayFor(i, xx) } as CSSProperties}>
                      <title>{k === 0 ? `Forked ${relTime(f.createdAt)} by ${userById(f.authorId).name.split(' ')[0]}` : `Commit ${k} of ${f.commitsAhead} ahead`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
          {/* main */}
          <g className={s.netLane} data-main="true">
            <path className={[s.netPath, s.netMainPath].join(' ')} d={laneGeos[0]!.path} pathLength={1} style={{ '--d': 0 } as CSSProperties} />
            {asc.map((c) => {
              const x = X(T(c.at));
              const current = c.version === version;
              const author = userById(c.authorId);
              return (
                <g key={c.sha} className={s.netCommit} data-current={current} data-merge={!!c.forkId} style={{ '--d': delayFor(0, x) } as CSSProperties}>
                  <circle cx={r1(x)} cy={laneGeos[0]!.y} r={current ? 4.2 : 3.4}>
                    <title>{`${c.version ? `v${c.version} · ` : ''}${c.message} · ${author.name.split(' ')[0]} · ${relTime(c.at)}`}</title>
                  </circle>
                  {c.version && shownTags.has(c.sha) && (
                    <text className={s.netTag} x={r1(x)} y={laneGeos[0]!.y - 9} textAnchor="middle">
                      v{c.version}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        {forks.length === 0 && <div className={s.netEmpty}>No forks yet. Fork this product to make a variant with another tool in one of its nodes.</div>}
      </div>
    </div>
  );
}
