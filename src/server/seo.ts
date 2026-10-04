// What search engines and link previews read: the public pages with their lastmod
// (sitemap.xml), robots.txt, and each page's JSON-LD. The pages come from the one page
// list the routes serve (src/server/pages.ts), so a new page is listed at once.
import { execFileSync } from 'node:child_process';
import { info, pages } from './pages';

export const SITE = 'https://team.floor.io';
/** Routes for the site's own use, never a page to index: robots.txt disallows them. */
export const INTERNAL_PREFIXES = ['/api/'];

/** The site's own last commit date per file, for a page's lastmod. */
function gitDates(): Map<string, string> {
  const dates = new Map<string, string>();
  try {
    const log = execFileSync('git', ['log', '--format=%cd', '--date=short', '--name-only', 'HEAD'], { cwd: new URL('../..', import.meta.url).pathname, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    let date = '';
    for (const line of log.split('\n')) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(line)) date = line;
      else if (line && date && !dates.has(line)) dates.set(line, date);
    }
  } catch { /* No git, or no history: the ref's own date stands in below. */ }
  return dates;
}
const dates = gitDates();
const today = new Date().toISOString().slice(0, 10);

/**
 * A page's lastmod: the newest of its own sources' commits, and the date of the
 * reference it is built against — a page of the docs changed when the reference did.
 */
function lastmod(files: string[]): string {
  const found = files.map(file => dates.get(file) ?? '');
  return [...found, info.date].reduce((latest, date) => (date > latest ? date : latest), '') || today;
}

export interface SitemapPage { path: string; lastmod: string; priority: string }
/** Every public page, from the routes' own list, with its sources' last commit. */
export function sitemapPages(): SitemapPage[] {
  return [
    { path: '/', lastmod: lastmod(['src/server/shells/homepage.eta']), priority: '1.0' },
    ...pages().map(page => ({ path: page.path, lastmod: lastmod(page.files), priority: page.priority })),
    { path: '/privacy/', lastmod: lastmod(['src/server/shells/privacy.eta']), priority: '0.3' },
  ];
}

const escapeXml = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
export function sitemapXml(): string {
  const urls = sitemapPages().map(page => `  <url><loc>${escapeXml(SITE + page.path)}</loc><lastmod>${page.lastmod}</lastmod><priority>${page.priority}</priority></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
export const robotsTxt = (): string =>
  `User-agent: *\nAllow: /\n${INTERNAL_PREFIXES.map(prefix => `Disallow: ${prefix}\n`).join('')}\nSitemap: ${SITE}/sitemap.xml\n`;

const author = { '@type': 'Organization', name: 'Floor IO', url: 'https://floor.io' };
/** Where the command itself lives: its repository, and the package on npm. */
const where = ['https://github.com/floor/team', 'https://www.npmjs.com/package/team'];
/**
 * A page's structured data: on the home page the command itself and the site; elsewhere
 * the trail Home → Documentation → page. `name` is the page's own name.
 */
export function structuredData(path: string, name: string, description: string): object[] {
  const site = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'team.floor.io', url: SITE, publisher: author };
  if (path === '/') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'team',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'macOS, Linux',
        url: SITE,
        description,
        author,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        softwareVersion: info.version || undefined,
        license: 'https://opensource.org/licenses/MIT',
        sameAs: where,
      },
      site,
    ];
  }
  if (!path.startsWith('/docs/')) return [site];
  const trail = [{ name: 'Home', path: '/' }, { name: 'Documentation', path: '/docs/' }, ...path === '/docs/' ? [] : [{ name, path }]];
  return [{
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: SITE + item.path })),
  }];
}

/** JSON for a <script> element: `<` escaped, so no text in it can close the element. */
export const jsonForScript = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
