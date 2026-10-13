/** Demo clock: the dashboard "now" is fixed so SSR and client agree. */
export const NOW = new Date('2026-10-13T14:32:00+02:00');

export function minutesAgo(min: number): string {
  return new Date(NOW.getTime() - min * 60_000).toISOString();
}
export function hoursAgo(h: number): string {
  return minutesAgo(h * 60);
}
export function daysAgo(d: number): string {
  return minutesAgo(d * 24 * 60);
}

export function relTime(iso: string, now: Date = NOW): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < -45_000) {
    const ahead = -diff;
    const h = Math.round(ahead / 3_600_000);
    if (h < 1) return 'in a few minutes';
    if (h < 24) return `in ${h}h`;
    const d = Math.round(h / 24);
    if (d < 14) return `in ${d}d`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  const s = Math.round(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function fmtInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}
export function fmtCompact(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1_000_000) return Math.round(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1) + 'M';
}
export function fmtPct(n: number, digits = 1): string {
  return (n * 100).toFixed(digits) + '%';
}
export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.round((ms % 60_000) / 1000);
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return m ? `${h}h ${m}m` : `${h}h`;
}
export function fmtEuro(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
}
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' });
}
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
export function greeting(now: Date = NOW): string {
  const h = Number(now.toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/Amsterdam' }));
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
