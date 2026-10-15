import { useEffect, useRef } from 'react';
import { fmtInt } from '../../lib/format';
import s from './client.module.css';

/**
 * Cumulative token counter that ticks live. The base is deterministic (SSR
 * renders it), the ticking starts after mount and is sped up so the number
 * visibly moves. Writes straight to the DOM node, no re-renders per frame.
 */
export function TokenCounter({ base, perSecond, speed = 40 }: { base: number; perSecond: number; speed?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || perSecond <= 0) return;
    const start = performance.now();
    const paint = (now: number) => {
      el.textContent = fmtInt(base + perSecond * speed * ((now - start) / 1000));
    };
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      const id = setInterval(() => paint(performance.now()), 1000);
      return () => clearInterval(id);
    }
    let raf = 0;
    const tick = (now: number) => {
      paint(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [base, perSecond, speed]);
  return (
    <span ref={ref} className={[s.counter, 'tnum'].join(' ')} aria-live="off">
      {fmtInt(base)}
    </span>
  );
}

/** A calm count-up from zero to the value, once, after mount. */
export function CountUp({ value, duration = 900, format = fmtInt }: { value: number; duration?: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || value === 0) {
      el.textContent = format(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, format]);
  return (
    <span ref={ref} className="tnum">
      {format(value)}
    </span>
  );
}
