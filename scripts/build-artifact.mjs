/**
 * Post-processes `dist/` (built with ARTIFACT=1) into `dist-artifact/`:
 * every page gets a relative <base href> so all URLs can be root-relative
 * without a leading slash. That lets the site run from any sub-path,
 * including hosts that serve a bundle of files next to an index page.
 *
 *   ARTIFACT=1 npx astro build && node scripts/build-artifact.mjs
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SRC = 'dist';
const OUT = 'dist-artifact';

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const files = await walk(SRC);
const htmlFiles = files.filter((f) => f.endsWith('.html') && !f.endsWith('404.html'));

// route ("/workflows/canvas") → file ("workflows/canvas.html")
const routes = new Map();
for (const f of htmlFiles) {
  const rel = path.relative(SRC, f).split(path.sep).join('/');
  let route = '/' + rel.replace(/\.html$/, '');
  if (route.endsWith('/index')) route = route.slice(0, -'/index'.length) || '/';
  routes.set(route, rel);
}
const routeList = [...routes.entries()].sort((a, b) => b[0].length - a[0].length);

function rewriteLink(href) {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const m = href.match(/^([^?#]*)(.*)$/);
  const p = m[1].replace(/\/$/, '') || '/';
  const file = routes.get(p);
  return file ? './' + file + m[2] : href;
}

function rewriteHtml(html, depth, isRoot) {
  html = html.replace(/(href|src|component-url|renderer-url)="\/(_astro|app)\//g, '$1="./$2/');
  html = html.replace(/href="\/favicon\.svg"/g, 'href="./favicon.svg"');
  html = html.replace(/href="(\/[^"]*)"/g, (_, h) => `href="${rewriteLink(h)}"`);
  const base = `<base href="${depth ? '../'.repeat(depth) : './'}">`;
  if (isRoot) {
    // the host wraps the root page in its own document skeleton
    html = html
      .replace(/<!doctype html>/i, '')
      .replace(/<html[^>]*>/i, '')
      .replace(/<\/html>/i, '')
      .replace(/<head>/i, '')
      .replace(/<\/head>/i, '')
      .replace(/<body[^>]*>/i, '')
      .replace(/<\/body>/i, '');
    html = html.replace(/<title>[^<]*<\/title>/, '<title>LiveView for n8n</title>');
    html = base + '\n' + html.trim() + '\n';
  } else {
    html = html.replace(/<head>/i, '<head>' + base);
  }
  return html;
}

function rewriteJs(js) {
  // internal links inside React code: "/workflows/canvas?focus=" , `/companies/${x}` etc.
  for (const [route, file] of routeList) {
    if (route === '/') continue;
    js = js.replace(new RegExp('([\'"`])' + route.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?=[?"\'`#])', 'g'), '$1./' + file);
  }
  // dynamic company links: `/companies/${e.slug}` → `./companies/${e.slug}.html`
  js = js.replace(/`\/companies\/\$\{([^}]+)\}`/g, '`./companies/${$1}.html`');
  js = js.replace(/"\/companies\/"\.concat\(([^)]+)\)/g, '"./companies/".concat($1,".html")');
  // home links
  js = js.replace(/href:"\/"/g, 'href:"./index.html"');
  js = js.replace(/href:'\/'/g, "href:'./index.html'");
  // any remaining absolute asset refs
  js = js.replace(/(["'`])\/(_astro|app)\//g, '$1./$2/');
  js = js.replace(/(["'`])\/favicon\.svg/g, '$1./favicon.svg');
  return js;
}

function rewriteCss(css) {
  return css.replace(/url\(\/(?:_astro|app)\//g, 'url(');
}

await fs.rm(OUT, { recursive: true, force: true });
let count = 0;
for (const f of files) {
  const rel = path.relative(SRC, f);
  if (rel === '404.html') continue;
  const dest = path.join(OUT, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  if (f.endsWith('.html')) {
    const depth = rel.split(path.sep).length - 1;
    const html = await fs.readFile(f, 'utf8');
    await fs.writeFile(dest, rewriteHtml(html, depth, rel === 'index.html'));
  } else if (f.endsWith('.js')) {
    await fs.writeFile(dest, rewriteJs(await fs.readFile(f, 'utf8')));
  } else if (f.endsWith('.css')) {
    await fs.writeFile(dest, rewriteCss(await fs.readFile(f, 'utf8')));
  } else {
    await fs.copyFile(f, dest);
  }
  count++;
}
const leftovers = [];
for (const f of await walk(OUT)) {
  if (!/\.(html|js|css)$/.test(f)) continue;
  const txt = await fs.readFile(f, 'utf8');
  const bad = txt.match(/(["'`(])\/(?:_astro|app|workflows|companies|users|credentials|favicon)\b/g);
  if (bad) leftovers.push(`${path.relative(OUT, f)}: ${[...new Set(bad)].join(' ')}`);
}
console.log(`wrote ${count} files to ${OUT}/ (${routes.size} pages)`);
if (leftovers.length) {
  console.log('absolute references left:\n  ' + leftovers.join('\n  '));
} else console.log('no absolute internal references left');
