// team.floor.io: the site for the `team` command.
//
// Everything a page says comes from the reference at TEAM_REF (src/server/pages.ts), the
// prose through Marked and the blocks through the site's own renderer (markdown.ts), with
// highlight.js served from this site. The templates are Eta shells in src/server/shells/.
// Assets are content-hashed through dist/asset-manifest.json; scripts/build.ts writes them.
import { Eta } from 'eta';
import { extname, resolve, sep } from 'node:path';
import { IMMUTABLE_CACHE, SHORT_CACHE, isImmutableAsset, loadAssetManifest } from './src/server/assets';
import { materialSheets, type StylesheetBundle } from './src/server/css';
import { crewWords, descriptionFor, homePoints, homeSamples, info, inline, installMarkup, nav, pages } from './src/server/pages';
import { fenceHtml } from './src/server/markdown';
import { searchSite, suggestions } from './src/server/search';
import { jsonForScript, robotsTxt, SITE, SITE_NAME, sitemapXml, structuredData } from './src/server/seo';
import { root } from './src/server/team';

const eta = new Eta({ views: resolve(root, 'src/server/shells'), cache: process.env.NODE_ENV === 'production' });
const commonHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
// Logical path → content-hashed path. Written by scripts/write-asset-manifest.ts.
// Empty until the first build; the templates' own names are served then.
const assetManifest = loadAssetManifest();
const versionAssets = (body: string) => body.replace(/((?:src|href)=")(\/[^"?#]+)(")/g, (full, open, path, close) => {
  const hashed = assetManifest[path];
  return hashed ? `${open}${hashed}${close}` : full;
});
const html = (body: string, status = 200) => new Response(versionAssets(body), { status, headers: { ...commonHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': SHORT_CACHE } });
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!);

const escapeAttr = (text: string) => escapeHtml(text).replace(/'/g, '&#39;');

/** The previous and next links for a reference page, from the sidebar's own order. */
function pager(path: string): string {
  const order = nav.flatMap(group => group.items);
  const index = order.findIndex(item => item.href === path);
  if (index < 0) return '';
  const [prev, next] = [order[index - 1], order[index + 1]];
  if (!prev && !next) return '';
  const link = (item: { name: string; href: string }, rel: 'prev' | 'next') =>
    `<a href="${escapeAttr(item.href)}" rel="${rel}" class="page-nav__link page-nav__link--${rel}"><span class="page-nav__label">${rel === 'prev' ? '← Previous' : 'Next →'}</span><span class="page-nav__title">${escapeHtml(item.name)}</span></a>`;
  return `<nav class="page-nav" aria-label="Previous and next">${prev ? link(prev, 'prev') : '<span></span>'}${next ? link(next, 'next') : ''}</nav>`;
}

/** One page, in the site's frame: the head, the navigation, the footer, the search dialog. */
function shell(body: { path: string; title: string; description: string; content: string; css: StylesheetBundle; section?: string; isHome?: boolean; jsonLd?: string[] }): string {
  return eta.render('base', {
    path: body.path, title: body.title, description: body.description, css: body.css, section: body.section ?? 'Documentation',
    site: SITE, siteName: SITE_NAME,
    isHome: Boolean(body.isHome), jsonLd: body.jsonLd ?? [], nav, version: info.version, content: body.content, materialSheets, crewWords,
  });
}
/** A documentation page: the page's own content, wrapped with its table of contents and pager. */
function docPage(path: string, title: string, description: string, content: { html: string; toc: { title: string; id: string }[] }, options: { css?: StylesheetBundle; isHome?: boolean; section?: string; status?: number } = {}): Response {
  const inner = eta.render('page', {
    html: content.html, toc: content.toc,
    pager: options.isHome === undefined && path.startsWith('/docs/') ? pager(path) : '',
  });
  return html(shell({
    path, title, description, content: inner, css: options.css ?? 'page', section: options.section, isHome: options.isHome,
    jsonLd: structuredData(path, title.replace(/ — team$/, ''), description).map(jsonForScript),
  }), options.status ?? 200);
}
/** A page whose content is a template of its own: the home page and Privacy. */
function plainPage(path: string, title: string, description: string, template: string, data: Record<string, unknown> = {}): Response {
  return html(shell({
    path, title, description, content: eta.render(template, data), css: template === 'homepage' ? 'home' : 'page',
    section: '', isHome: template === 'homepage',
    jsonLd: structuredData(path, title.replace(/ — team$/, ''), description).map(jsonForScript),
  }));
}

const mime: Record<string, string> = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
/** The files browsers and link previews ask for at the root, from public/. */
const rootFiles = new Set(['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/og-image.png']);
const text = (body: string | null, type: string) => new Response(body, { headers: { ...commonHeaders, 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'public, max-age=3600' } });

export async function handleRequest(request: Request): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url);
  let path: string;
  try { path = decodeURIComponent(url.pathname); } catch { return new Response('Bad request', { status: 400 }); }
  if (/(?:^|\/)\.[^/]/.test(path)) return new Response('Not found', { status: 404 });

  const staticMatch = /^\/(styles|dist)\/(.+)$/.exec(path);
  if (staticMatch && extname(path)) {
    const base = resolve(root, staticMatch[1]!);
    const filePath = resolve(base, staticMatch[2]!);
    if (!filePath.startsWith(base + sep) || !mime[extname(filePath)]) return new Response('Not found', { status: 404 });
    const file = Bun.file(filePath);
    if (!await file.exists()) return new Response('Not found', { status: 404 });
    // A content hash in the name is cached for a year; a stable name — a stylesheet served
    // as it was written, or a hashed URL a page cached before the last build still asks for
    // — takes the short cache, the same as the HTML that names it.
    const immutable = isImmutableAsset(path);
    return new Response(request.method === 'HEAD' ? null : file, {
      headers: { ...commonHeaders, 'Content-Type': mime[extname(filePath)]!, 'Cache-Control': immutable ? IMMUTABLE_CACHE : SHORT_CACHE },
    });
  }
  if (rootFiles.has(path)) {
    const file = Bun.file(resolve(root, 'public', path.slice(1)));
    if (!await file.exists()) return new Response('Not found', { status: 404 });
    // Not versioned by name, so a day's cache: a new icon reaches everyone by the next day.
    return new Response(request.method === 'HEAD' ? null : file, { headers: { ...commonHeaders, 'Content-Type': mime[extname(path)]!, 'Cache-Control': 'public, max-age=86400' } });
  }
  if (path === '/robots.txt') return text(request.method === 'HEAD' ? null : robotsTxt(), 'text/plain');
  if (path === '/sitemap.xml') return text(request.method === 'HEAD' ? null : sitemapXml(), 'application/xml');
  // GET /api/search?q=…&limit=… — the search dialog's results. Without a query it answers
  // with the pages the dialog offers before anything is typed.
  if (path === '/api/search' || path === '/api/search/') {
    const query = url.searchParams.get('q') ?? '';
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10));
    const body = request.method === 'HEAD' ? null : JSON.stringify({ query, results: query ? searchSite(query, limit) : suggestions.slice(0, limit) });
    return new Response(body, { headers: { ...commonHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' } });
  }
  if (!path.endsWith('/') && !extname(path)) return new Response(null, { status: 308, headers: { Location: `${url.pathname}/${url.search}` } });

  let response: Response;
  if (path === '/') {
    response = plainPage('/', `team — a project's AI team, ${crewWords}`, descriptionFor('/'), 'homepage', {
      version: info.version,
      crewWords,
      tagline: inline(homePoints()[0]!.text),
      install: installMarkup(),
      points: homePoints().map(point => ({ title: point.title, html: inline(point.text) })),
      samples: homeSamples().map(sample => ({ label: sample.label, caption: inline(sample.caption), html: fenceHtml(sample.fence) })),
    });
  }
  else if (path === '/privacy/') response = plainPage(path, 'Privacy — team', descriptionFor('/privacy/'), 'privacy');
  else {
    const found = pages().find(entry => entry.path === path);
    response = found
      ? docPage(found.path, found.title, found.description, found, { section: found.section })
      : docPage(path, 'Page not found — team', 'That page isn\'t here.', { html: eta.render('not-found', {}), toc: [] }, { status: 404 });
  }
  return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
}

if (import.meta.main) {
  const server = Bun.serve({ port: Number(process.env.PORT || 4310), hostname: process.env.HOST || '127.0.0.1', fetch: handleRequest });
  console.log(`team.floor.io ready at ${server.url}`);
}
