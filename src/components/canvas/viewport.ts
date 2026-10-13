/**
 * Viewport controller: owns the camera, writes transforms straight to the DOM
 * (no React re-render per frame) and publishes the camera on a nanostore for
 * the few light components that need it (breadcrumb, zoom %, minimap).
 */
import { atom, computed } from 'nanostores';
import { fitRect, type Rect, type Viewport } from '../../lib/layout';
import type { Pt } from './geometry';

export const MIN_ZOOM = 0.04;
export const MAX_ZOOM = 3;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Level of detail, derived from zoom. */
export type Tier = 'tiny' | 'compact' | 'mini' | 'mini2' | 'full';
export function tierOf(z: number): Tier {
  if (z < 0.11) return 'tiny';
  if (z < 0.22) return 'compact';
  if (z < 0.45) return 'mini';
  if (z < 0.55) return 'mini2';
  return 'full';
}
export const MARKER_ZOOM = 0.45;

export const $viewport = atom<Viewport>({ x: 0, y: 0, z: 0.5 });
export const $tier = computed($viewport, (v) => tierOf(v.z));
export const $markersVisible = computed($viewport, (v) => v.z >= MARKER_ZOOM);
/** hovered workflow id (atom so cards + edges can react without re-rendering the tree) */
export const $hoverWf = atom<string | null>(null);

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

interface Els {
  root: HTMLElement;
  html: HTMLElement;
  overlay: HTMLElement;
  svg: SVGGElement;
  grid: HTMLElement;
}

export class ViewportController {
  vp: Viewport = { x: 0, y: 0, z: 0.5 };
  w = 1;
  h = 1;
  railW = 0;
  private els: Els | null = null;
  private raf: number | null = null;
  private interactListeners = new Set<() => void>();
  private followTarget: Pt | null = null;

  attach(els: Els) {
    this.els = els;
    this.apply();
  }
  detach() {
    this.els = null;
    this.cancel();
  }
  setSize(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
  }
  setRail(px: number) {
    this.railW = px;
  }
  /** visible width (the right rail covers part of the canvas) */
  get effW() {
    return Math.max(1, this.w - this.railW);
  }

  onInteract(fn: () => void) {
    this.interactListeners.add(fn);
    return () => this.interactListeners.delete(fn);
  }
  /** call when the person pans/zooms by hand (stops follow mode) */
  interacted() {
    this.followTarget = null;
    for (const l of this.interactListeners) l();
  }

  set(v: Viewport) {
    this.vp = { x: v.x, y: v.y, z: clampZoom(v.z) };
    this.apply();
    $viewport.set(this.vp);
  }

  private apply() {
    const e = this.els;
    if (!e) return;
    const { x, y, z } = this.vp;
    const tx = -x * z;
    const ty = -y * z;
    const t = `translate(${tx}px, ${ty}px) scale(${z})`;
    e.html.style.transform = t;
    e.overlay.style.transform = t;
    e.svg.setAttribute('transform', `translate(${tx} ${ty}) scale(${z})`);
    const rs = e.root.style;
    rs.setProperty('--z', String(z));
    rs.setProperty('--inv', String(1 / z));
    rs.setProperty('--sw', String(1 / z));
    rs.setProperty('--dash', `${6 / z} ${5 / z}`);
    // dot grid: keep dots 14-28px apart on screen, fade when far out
    let spacing = 24;
    while (spacing * z < 14) spacing *= 2;
    const s = spacing * z;
    const gs = e.grid.style;
    gs.backgroundSize = `${s}px ${s}px`;
    gs.backgroundPosition = `${tx % s}px ${ty % s}px`;
    gs.opacity = String(Math.min(1, Math.max(0.35, (z - 0.05) / 0.3)));
  }

  cancel() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  /** Animate to a camera. Centre + log-zoom interpolation so the motion reads as one move. */
  animateTo(target: Viewport, dur = 450): Promise<void> {
    this.cancel();
    const from = { ...this.vp };
    const to = { x: target.x, y: target.y, z: clampZoom(target.z) };
    if (dur <= 0) {
      this.set(to);
      return Promise.resolve();
    }
    const c0 = this.centerOf(from);
    const c1 = this.centerOf(to);
    const start = performance.now();
    return new Promise((resolve) => {
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const k = easeOut(t);
        const z = from.z * Math.pow(to.z / from.z, k);
        const cx = c0.x + (c1.x - c0.x) * k;
        const cy = c0.y + (c1.y - c0.y) * k;
        this.set({ x: cx - this.effW / 2 / z, y: cy - this.h / 2 / z, z });
        if (t < 1) this.raf = requestAnimationFrame(step);
        else {
          this.raf = null;
          resolve();
        }
      };
      this.raf = requestAnimationFrame(step);
    });
  }

  centerOf(v: Viewport): Pt {
    return { x: v.x + this.effW / 2 / v.z, y: v.y + this.h / 2 / v.z };
  }
  center(): Pt {
    return this.centerOf(this.vp);
  }
  /** world rect currently visible (excluding the rail) */
  visibleRect(): Rect {
    const { x, y, z } = this.vp;
    return { x, y, w: this.effW / z, h: this.h / z };
  }
  fit(rect: Rect, padding = 80, maxZoom = 1.5): Viewport {
    return fitRect(rect, this.effW, this.h, padding, maxZoom);
  }
  screenToWorld(sx: number, sy: number): Pt {
    return { x: this.vp.x + sx / this.vp.z, y: this.vp.y + sy / this.vp.z };
  }
  worldToScreen(p: Pt): Pt {
    return { x: (p.x - this.vp.x) * this.vp.z, y: (p.y - this.vp.y) * this.vp.z };
  }
  zoomAt(sx: number, sy: number, factor: number) {
    const z1 = clampZoom(this.vp.z * factor);
    const w = this.screenToWorld(sx, sy);
    this.set({ x: w.x - sx / z1, y: w.y - sy / z1, z: z1 });
  }
  zoomAroundCenter(factor: number, dur = 220) {
    const z1 = clampZoom(this.vp.z * factor);
    const c = this.center();
    return this.animateTo({ x: c.x - this.effW / 2 / z1, y: c.y - this.h / 2 / z1, z: z1 }, dur);
  }
  zoomTo(z1: number, dur = 300) {
    const c = this.center();
    const z = clampZoom(z1);
    return this.animateTo({ x: c.x - this.effW / 2 / z, y: c.y - this.h / 2 / z, z }, dur);
  }
  panBy(dx: number, dy: number) {
    this.set({ x: this.vp.x - dx / this.vp.z, y: this.vp.y - dy / this.vp.z, z: this.vp.z });
  }
  /** Follow mode: ease the camera towards a world point every frame. */
  followPoint(p: Pt) {
    this.followTarget = p;
    if (this.raf != null) return; // an explicit animation is running; let it finish
    const { z } = this.vp;
    const tx = p.x - this.effW / 2 / z;
    const ty = p.y - this.h / 2 / z;
    const k = 0.14;
    this.set({ x: this.vp.x + (tx - this.vp.x) * k, y: this.vp.y + (ty - this.vp.y) * k, z });
  }
}
