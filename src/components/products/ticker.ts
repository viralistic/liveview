/** One requestAnimationFrame loop shared by every live graph on the page. */
type Tick = (nowMs: number) => void;

const subs = new Set<Tick>();
let raf = 0;

function loop(now: number) {
  for (const fn of subs) fn(now);
  raf = subs.size ? requestAnimationFrame(loop) : 0;
}

export function subscribe(fn: Tick): () => void {
  subs.add(fn);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => {
    subs.delete(fn);
    if (!subs.size && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}
