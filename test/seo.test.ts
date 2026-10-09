// SEO helpers: the sitemap, robots.txt and a page's structured data. The pages come from
// the one page list the routes serve, so a page that exists is listed, and one that does
// not is not.
import { describe, expect, test } from 'bun:test';
import { jsonForScript, robotsTxt, SITE, sitemapPages, sitemapXml, structuredData } from '../src/server/seo';
import { info, pages } from '../src/server/pages';

/** The public pages in the sitemap's own order: the home page, the docs, then Privacy. */
const publicPaths = ['/', ...pages().map(page => page.path), '/privacy/'];

describe('the sitemap', () => {
  test('every public page, once, and nothing else', () => {
    const paths = sitemapPages().map(page => page.path);
    expect(paths).toEqual(publicPaths);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.some(path => path.startsWith('/api/'))).toBe(false);
  });

  test('a lastmod is a date, and a priority is between 0 and 1', () => {
    for (const page of sitemapPages()) {
      expect(page.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(page.priority).toMatch(/^[01]\.\d$/);
      expect(Number.isNaN(Date.parse(page.lastmod))).toBe(false);
    }
  });

  test('the XML holds one url per page, on the site\'s own address', () => {
    const xml = sitemapXml();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]!);
    expect(locs).toEqual(publicPaths.map(path => SITE + path));
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    // One <url> per <lastmod>: a page with a date and no address would be a mistake.
    expect([...xml.matchAll(/<url>/g)].length).toBe(locs.length);
    expect([...xml.matchAll(/<lastmod>/g)].length).toBe(locs.length);
  });
});

describe('robots.txt', () => {
  test('the site is open, its search API is not, and the sitemap is named', () => {
    const robots = robotsTxt();
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});

describe('structured data', () => {
  test('the home page is the command itself, then the site', () => {
    const [app, site] = structuredData('/', 'team — a project\'s AI team, from any lab', 'the description') as Record<string, unknown>[];
    expect(app!['@type']).toBe('SoftwareApplication');
    expect(app!.name).toBe('team');
    expect(app!.description).toBe('the description');
    expect(app!.softwareVersion).toBe(info.version);
    expect(app!.license).toBe('https://opensource.org/licenses/MIT');
    expect(site!['@type']).toBe('WebSite');
    for (const object of [app!, site!]) expect(object['@context']).toBe('https://schema.org');
  });

  test('a documentation page is a trail home, through the docs, to itself', () => {
    const [trail] = structuredData('/docs/file/', 'The team file — team', 'x') as { itemListElement: { position: number; name: string; item: string }[] }[];
    expect(trail!.itemListElement.map(step => step.name)).toEqual(['Home', 'Documentation', 'The team file — team']);
    expect(trail!.itemListElement.map(step => step.item)).toEqual([`${SITE}/`, `${SITE}/docs/`, `${SITE}/docs/file/`]);
    expect(trail!.itemListElement.map(step => step.position)).toEqual([1, 2, 3]);
  });

  test('the docs index does not list itself twice', () => {
    const [trail] = structuredData('/docs/', 'Getting started — team', 'x') as { itemListElement: unknown[] }[];
    expect(trail!.itemListElement.length).toBe(2);
  });

  test('a page that is not documentation gets the site alone', () => {
    const data = structuredData('/privacy/', 'Privacy — team', 'x') as Record<string, unknown>[];
    expect(data.length).toBe(1);
    expect(data[0]!['@type']).toBe('WebSite');
  });

  test('JSON in a <script> cannot close the element', () => {
    const json = jsonForScript({ text: '</script><img src=x onerror=alert(1)>', and: '&' });
    expect(json).not.toContain('</script>');
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ text: '</script><img src=x onerror=alert(1)>', and: '&' });
  });
});
