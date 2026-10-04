// links:check — every link the served pages carry goes somewhere.
//
// The pages are asked of the server itself (server.ts's handleRequest), so this checks
// the HTML as it is served: the header, the sidebar, the footer, the search dialog and
// the page bodies. An internal link must answer 200, an anchor must land on an id that
// page has, an external link must be https, and a new tab must not hand the opener on.
import { handleRequest } from '../server';
import { INTERNAL_PREFIXES, SITE, sitemapPages } from '../src/server/seo';

const problems: string[] = [];
const check = (condition: boolean, message: string) => { if (!condition) problems.push(message); };

const get = (path: string) => handleRequest(new Request(`${SITE}${path}`));
const cache = new Map<string, string>();
async function body(path: string): Promise<string> {
  if (!cache.has(path)) cache.set(path, await (await get(path)).text());
  return cache.get(path)!;
}
const status = async (path: string) => (await get(path)).status;

/** Every href of a page, with the text around it, so a failure names the link. */
function hrefs(html: string): { href: string; target: string }[] {
  return [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/g)].map(match => ({ href: match[1]!, target: match[0] }));
}

const ids = (html: string) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]!));

// ── the pages the site says it has ─────────────────────────────────────────────

const publicPages = sitemapPages().map(page => page.path);
for (const path of publicPages) {
  const response = await get(path);
  check(response.status === 200, `${path}: answered ${response.status}`);
  const html = await response.text();
  check(ids(html).has('content'), `${path}: no #content to skip to`);
  check(html.includes(`<title>`), `${path}: no title`);
}

// A route the site keeps for itself must not be indexed, and must not be linked to.
for (const prefix of INTERNAL_PREFIXES) {
  const robots = await body('/robots.txt');
  check(robots.includes(`Disallow: ${prefix}`), `robots.txt does not disallow ${prefix}`);
}

// ── every link on every page ───────────────────────────────────────────────────

for (const path of [...publicPages, '/nope/']) {
  const html = await body(path);
  for (const { href, target } of hrefs(html)) {
    if (href.startsWith('#')) {
      check(ids(html).has(href.slice(1)), `${path}: ${href} is not an id of the page`);
      continue;
    }
    if (/^(?:mailto|tel):/.test(href)) continue;
    if (/^https?:/.test(href)) {
      check(href.startsWith('https://'), `${path}: ${href} is not https`);
      // A link that opens a new tab must not hand the opener on; one that stays in
      // the tab needs no rel.
      if (/target="_blank"/.test(target)) check(/rel="[^"]*noopener/.test(target), `${path}: ${href} opens a new tab without rel="noopener"`);
      if (!href.startsWith(SITE) && INTERNAL_PREFIXES.some(prefix => href.includes(prefix))) problems.push(`${path}: links to ${href}`);
      continue;
    }
    check(href.startsWith('/'), `${path}: ${href} is neither absolute nor an anchor`);

    const [route, anchor = ''] = href.split('#');
    const answer = await status(route!);
    check(answer === 200, `${path}: ${href} answered ${answer}`);
    if (anchor && answer === 200) {
      const destination = await body(route!);
      check(ids(destination).has(anchor), `${path}: ${href} is not an id of ${route}`);
    }
  }
}

// The assets every page asks for, on the pages that are not in the sitemap either.
for (const path of ['/', '/privacy/', '/nope/']) {
  const html = await body(path);
  const wanted = [
    ...[...html.matchAll(/(?:src|href)="(\/(?:dist|styles)\/[^"]+)"/g)].map(match => match[1]!),
    ...[...html.matchAll(/href="(\/(?:favicon\.(?:svg|ico)|apple-touch-icon\.png|og-image\.png))"/g)].map(match => match[1]!),
  ];
  for (const asset of wanted) {
    const answer = await status(asset);
    check(answer === 200, `${path}: ${asset} answered ${answer}`);
  }
}

if (problems.length) {
  console.error(`links:check — ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const problem of [...new Set(problems)]) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`links:check passed: ${publicPages.length} pages, every link and asset answered.`);
