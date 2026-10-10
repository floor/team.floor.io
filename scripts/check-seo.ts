// seo:check — what a crawler and a link preview read is there, once, and true.
//
// The pages are asked of the server itself (server.ts's handleRequest), so this reads
// the HTML as it is served: the title, the description, the canonical URL, the Open
// Graph and Twitter tags, and the structured data. Then the files those tags point at:
// sitemap.xml, robots.txt and the images in public/, whose bytes are read rather than
// trusted — an og:image that is 800×420 makes every preview of the site wrong.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { handleRequest } from '../server';
import { descriptionFor, info } from '../src/server/pages';
import { SITE, SITE_NAME, sitemapPages } from '../src/server/seo';

const root = resolve(import.meta.dir, '..');
const problems: string[] = [];
const check = (condition: boolean, message: string) => { if (!condition) problems.push(message); };

const get = (path: string) => handleRequest(new Request(`${SITE}${path}`));
const cache = new Map<string, string>();
async function body(path: string): Promise<string> {
  if (!cache.has(path)) cache.set(path, await (await get(path)).text());
  return cache.get(path)!;
}

/** One tag's content, e.g. `og:title`: `meta(html, 'property', 'og:title')`. */
function meta(html: string, attribute: 'property' | 'name' | 'rel', key: string): string {
  const tag = new RegExp(`<${attribute === 'rel' ? 'link' : 'meta'}\\b[^>]*\\b(?:property|name|rel)="${key}"[^>]*>`).exec(html)?.[0] ?? '';
  return /\bcontent="([^"]*)"|\bhref="([^"]*)"/.exec(tag)?.slice(1).find(Boolean) ?? '';
}
const count = (html: string, pattern: RegExp): number => [...html.matchAll(new RegExp(pattern.source, 'g'))].length;

// ── every page: one title, one description, one canonical, a preview ───────────

const pageList = sitemapPages();
const titles = new Map<string, string>();
const descriptions = new Map<string, string>();
for (const page of pageList) {
  const html = await body(page.path);
  const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1]?.trim() ?? '';
  const description = meta(html, 'name', 'description');
  const canonical = meta(html, 'rel', 'canonical');
  const ogImage = `${SITE}/og-image.png`;

  check(html.startsWith('<!doctype html>'), `${page.path}: no doctype`);
  check(/<html lang="en"/.test(html), `${page.path}: no lang="en"`);
  check(/<meta name="viewport"/.test(html), `${page.path}: no viewport`);
  check(count(html, /<title>/g) === 1, `${page.path}: ${count(html, /<title>/g)} titles`);
  check(count(html, /<h1\b/g) === 1, `${page.path}: ${count(html, /<h1\b/g)} h1 headings, one page has one`);
  check(title.length > 0 && title.length <= 70, `${page.path}: the title is ${title.length} characters: ${JSON.stringify(title)}`);
  // A page's name ends the title; the home page is the site's own name.
  check(page.path === '/' || title.endsWith('— team'), `${page.path}: the title does not end with "— team": ${JSON.stringify(title)}`);
  check(description.length > 0, `${page.path}: no description`);
  check(canonical === SITE + page.path, `${page.path}: canonical is ${JSON.stringify(canonical)}`);
  check(descriptions.get(description) === undefined, `${page.path}: the same description as ${descriptions.get(description)}`);
  check(titles.get(title) === undefined, `${page.path}: the same title as ${titles.get(title)}`);
  titles.set(title, page.path);
  descriptions.set(description, page.path);

  check(meta(html, 'property', 'og:type') === 'website', `${page.path}: og:type`);
  check(meta(html, 'property', 'og:site_name') === SITE_NAME, `${page.path}: og:site_name`);
  check(meta(html, 'property', 'og:url') === canonical, `${page.path}: og:url is not the canonical URL`);
  check(meta(html, 'property', 'og:title') === title, `${page.path}: og:title is not the title`);
  check(meta(html, 'property', 'og:description') === description, `${page.path}: og:description is not the description`);
  check(meta(html, 'property', 'og:image') === ogImage, `${page.path}: og:image`);
  check(meta(html, 'property', 'og:image:width') === '1200' && meta(html, 'property', 'og:image:height') === '630', `${page.path}: og:image dimensions`);
  check(meta(html, 'property', 'og:image:alt').length > 0, `${page.path}: og:image:alt is empty`);
  check(meta(html, 'name', 'twitter:card') === 'summary_large_image', `${page.path}: twitter:card`);
  check(meta(html, 'name', 'twitter:title') === title, `${page.path}: twitter:title is not the title`);
  check(meta(html, 'name', 'twitter:description') === description, `${page.path}: twitter:description is not the description`);
  check(meta(html, 'name', 'twitter:image') === ogImage, `${page.path}: twitter:image`);

  // ── the structured data parses, and says what the page is ──────────────────
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  check(scripts.length > 0, `${page.path}: no structured data`);
  const parsed: Record<string, unknown>[] = [];
  for (const [, json] of scripts) {
    try {
      const value = JSON.parse(json!) as Record<string, unknown> | Record<string, unknown>[];
      parsed.push(...(Array.isArray(value) ? value : [value]));
    } catch (error) {
      problems.push(`${page.path}: the structured data does not parse: ${(error as Error).message}`);
    }
  }
  check(parsed.length >= scripts.length, `${page.path}: ${scripts.length} structured data blocks held ${parsed.length} objects`);
  for (const object of parsed) {
    check(object['@context'] === 'https://schema.org', `${page.path}: structured data without a schema.org context`);
  }
  const website = parsed.find(object => object['@type'] === 'WebSite');
  if (website) {
    check(website.name === SITE_NAME, `${page.path}: the WebSite name is ${JSON.stringify(website.name)}`);
    check(website.url === SITE, `${page.path}: the WebSite url is ${JSON.stringify(website.url)}`);
  }
  const trail = parsed.find(object => object['@type'] === 'BreadcrumbList');
  if (page.path.startsWith('/docs/')) {
    check(Boolean(trail), `${page.path}: a documentation page without a breadcrumb trail`);
    const items = (trail?.itemListElement ?? []) as { position: number; name: string; item: string }[];
    // Home → Documentation, and then the page itself unless the page is the docs index.
    check(items.length === (page.path === '/docs/' ? 2 : 3), `${page.path}: the breadcrumb trail has ${items.length} steps`);
    check(items[0]?.item === `${SITE}/` && items[1]?.item === `${SITE}/docs/`, `${page.path}: the breadcrumb trail does not start Home, Documentation`);
    check(items.at(-1)?.item === SITE + page.path, `${page.path}: the breadcrumb trail does not end on this page`);
    check(items.every((item, index) => item.position === index + 1), `${page.path}: the breadcrumb positions are out of order`);
    check(items.every(item => item.item.startsWith(SITE)), `${page.path}: a breadcrumb step leaves the site`);
    check(trail?.itemListElement === items, `${page.path}: the breadcrumb trail is not a list`);
  }
  if (page.path === '/') {
    const app = parsed.find(object => object['@type'] === 'SoftwareApplication');
    check(Boolean(app), '/: no SoftwareApplication');
    check(app?.name === 'team', '/: the application is not named team');
    check(app?.softwareVersion === info.version, `/: softwareVersion is ${JSON.stringify(app?.softwareVersion)}, the reference is ${info.version}`);
    check(app?.description === descriptionFor('/'), '/: the application does not carry the page\'s description');
    const sameAs = (app?.sameAs ?? []) as string[];
    check(sameAs.includes('https://github.com/floor/teamcli') && sameAs.includes('https://www.npmjs.com/package/team'), '/: the application does not name its repository and package');
    // The bundle's own name may follow a version, so the number is what is held to the ref.
    const bundle = info.version.replace(/\D+.*$/, '');
    check(html.includes(bundle), `/: the page does not show the reference's version ${info.version}`);
  }
}

// ── robots.txt and sitemap.xml ────────────────────────────────────────────────

const robots = await body('/robots.txt');
check(/^User-agent: \*/m.test(robots), 'robots.txt: no user-agent group');
check(/^Allow: \/$/m.test(robots), 'robots.txt: the site is not allowed');
check(/^Disallow: \/api\/$/m.test(robots), 'robots.txt: the search API is not disallowed');
check(robots.includes(`Sitemap: ${SITE}/sitemap.xml`), 'robots.txt: no sitemap');

const sitemap = await body('/sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]!);
check(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'sitemap.xml: no XML declaration');
check(/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sitemap), 'sitemap.xml: not a urlset of the sitemap schema');
const wanted = pageList.map(page => SITE + page.path);
check(locs.length === wanted.length, `sitemap.xml: ${locs.length} urls, the site has ${wanted.length} public pages`);
check(locs.every(loc => wanted.includes(loc)), `sitemap.xml: an unknown url: ${locs.find(loc => !wanted.includes(loc))}`);
check(new Set(locs).size === locs.length, 'sitemap.xml: a url is listed twice');
check(!sitemap.includes('/api/'), 'sitemap.xml: lists the search API');
for (const [, lastmod] of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
  check(/^\d{4}-\d{2}-\d{2}$/.test(lastmod!) && !Number.isNaN(Date.parse(lastmod!)), `sitemap.xml: lastmod ${JSON.stringify(lastmod)} is not a date`);
}
check(count(sitemap, /<url>/g) === count(sitemap, /<lastmod>/g), 'sitemap.xml: a url without a lastmod');
check([...sitemap.matchAll(/<priority>([^<]+)<\/priority>/g)].every(([, priority]) => /^[01]\.\d$/.test(priority!)), 'sitemap.xml: a priority is not between 0 and 1');

// ── the images the tags point at ──────────────────────────────────────────────

/** A PNG's size, read from its IHDR: the file itself, not what the tag claims. */
function pngSize(name: string): { width: number; height: number } | null {
  const bytes = readFileSync(resolve(root, 'public', name));
  if (bytes.subarray(0, 8).toString('latin1') !== '\x89PNG\r\n\x1a\n') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const og = pngSize('og-image.png');
check(Boolean(og), 'public/og-image.png is not a PNG');
check(og?.width === 1200 && og?.height === 630, `og-image.png is ${og?.width}×${og?.height}, and every tag says 1200×630`);
const touch = pngSize('apple-touch-icon.png');
check(touch?.width === 180 && touch?.height === 180, `apple-touch-icon.png is ${touch?.width}×${touch?.height}, iOS wants 180×180`);

const svg = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');
check(svg.includes('viewBox="0 0 32 32"'), 'favicon.svg: no viewBox');
check(svg.includes('prefers-color-scheme'), 'favicon.svg: one fixed scheme, so it disappears in the other');
check(svg.includes(`<title>`) || svg.includes('aria-label'), 'favicon.svg: nothing names the mark');

const ico = readFileSync(resolve(root, 'public', 'favicon.ico'));
check(ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1, 'favicon.ico: not an icon file');
const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, index) => ico.readUInt8(6 + 16 * index));
check(sizes.includes(16) && sizes.includes(32), `favicon.ico holds ${JSON.stringify(sizes)}: a browser asks for 16 and 32`);

// ── one report ────────────────────────────────────────────────────────────────

if (problems.length) {
  console.error(`seo:check — ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const problem of [...new Set(problems)]) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`seo:check passed: ${pageList.length} pages, their titles, descriptions, previews and structured data; sitemap.xml, robots.txt and the four images.`);
