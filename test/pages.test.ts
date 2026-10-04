// The site's own pages: the list the routes serve, what each one says it is, and the
// pieces the home page is built from.
import { describe, expect, test } from 'bun:test';
import { bundleCss, materialSheets, tokens } from '../src/server/css';
import { commandNames } from '../src/server/reference';
import { contentReady, refInfo } from '../src/server/team';
import { descriptionFor, homePoints, homeSamples, info, installLine, nav, pages, readingOrder } from '../src/server/pages';

describe('the page list', () => {
  test('every page is a place of its own, with a title, a description and content', () => {
    const list = pages();
    expect(new Set(list.map(page => page.path)).size).toBe(list.length);
    for (const page of list) {
      expect(page.path.startsWith('/docs/')).toBe(true);
      expect(page.path.endsWith('/')).toBe(true);
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.description.length).toBeGreaterThan(0);
      expect(page.html.length).toBeGreaterThan(0);
      expect(page.section).toBe('Documentation');
    }
  });

  test('one page per command, and the docs\' own pages beside them', () => {
    const paths = pages().map(page => page.path);
    for (const name of commandNames()) expect(paths).toContain(`/docs/commands/${name}/`);
    expect(paths).toContain('/docs/');
    expect(paths).toContain('/docs/file/');
    expect(paths).toContain('/docs/safety/');
    expect(paths).toContain('/docs/clis/');
  });

  test('the navigation leads to every page, and the reading order is its order', () => {
    const linked = new Set(nav.flatMap(group => group.items.map(item => item.href)));
    for (const page of pages()) expect(linked.has(page.path)).toBe(true);
    expect(readingOrder).toEqual(nav.flatMap(group => group.items));
  });

  test('a description is the site\'s own words, and a page without one is a mistake', () => {
    expect(descriptionFor('/')).toContain('team');
    expect(() => descriptionFor('/nowhere/')).toThrow(/no description/);
  });
});

describe('the home page, from the reference', () => {
  test('the install line is the reference\'s own command', () => {
    expect(installLine()).toBe('npm install -g team');
  });

  test('three points, each one sentence of the reference', () => {
    const points = homePoints();
    expect(points.length).toBe(3);
    for (const point of points) {
      expect(point.title.length).toBeGreaterThan(0);
      expect(point.text.length).toBeGreaterThan(0);
      expect(point.text).not.toContain('\n');
    }
  });

  test('what team writes, and what a launch of a CLI still writes, travel together', () => {
    const point = homePoints().find(entry => entry.title === 'Safe by design')!;
    expect(point.text).toContain('vendor config');
    expect(point.text).toContain('project record');
    const safety = pages().find(page => page.path === '/docs/safety/')!.html;
    expect(safety).toContain('vendor config');
    expect(safety).toContain('project record');
  });

  test('three samples: the file, the plan and the reading, each a whole block of a tested page', () => {
    const samples = homeSamples();
    expect(samples.map(sample => sample.label)).toEqual(['The file', 'The plan', 'The reading']);
    expect(samples[0]!.fence.lang).toBe('yaml');
    expect(samples[1]!.fence.lang).toBe('console');
    expect(samples[2]!.fence.lang).toBe('console');
    expect(samples[0]!.fence.text).toContain('project:');
  });
});

describe('the safety page, from the reference', () => {
  test('the who-may-run-what table gives each command its own rule', () => {
    const safety = pages().find(page => page.path === '/docs/safety/')!.html;
    const row = (name: string) => new RegExp(`<td><code>team ${name}</code></td><td>([\\s\\S]*?)</td>`).exec(safety)?.[1] ?? '';
    expect(row('up')).toBe('the owner');
    expect(row('down')).toContain('the coordinator');
    expect(row('up')).not.toBe(row('down'));
  });
});

describe('the reference the site is built against', () => {
  test('the content was fetched, and it says which ref it is', () => {
    expect(contentReady()).toBe(true);
    const ref = refInfo();
    expect(ref.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(ref.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ref.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(info.version).toBe(ref.version);
  });
});

describe('material, split from the site\'s own sheets', () => {
  test('the theme, the tokens and the components the pages use, each a file of its own', () => {
    expect(materialSheets.map(sheet => sheet.url)).toEqual([
      '/dist/material/theme.css', '/dist/material/tokens.css', '/dist/material/button.css', '/dist/material/icon-button.css',
    ]);
    expect(materialSheets[0]!.read()).toContain('[data-theme=ocean]');
    for (const sheet of materialSheets) expect(sheet.read().length).toBeGreaterThan(0);
  });

  test('base.css\'s own page styles are left out, and its resets are scoped to the components', () => {
    const extracted = tokens();
    expect(extracted).toContain('--mtrl-ref-typeface');
    expect(extracted).toContain('@keyframes mtrl-ripple-expand');
    expect(extracted).toContain(':where(.mtrl-button,.mtrl-icon-button) :is(button)');
    expect(extracted).not.toContain('body{');
    // A base.css that moved stops the site instead of styling it wrongly.
    expect(() => tokens(':root{--other}')).toThrow(/tokens, ripple or resets not found/);
  });

  test('a page\'s bundle is the site\'s own sheets, joined, without a second copy of material', () => {
    const page = bundleCss('page');
    expect(page).toContain('--header-height');
    // material's theme, tokens and components stay in their own cached files.
    expect(page).not.toContain('--mtrl-ref-palette');
    expect(page).not.toContain('@keyframes mtrl-ripple-expand');
    expect(page).not.toContain('@import');
    expect(bundleCss('home').length).toBeGreaterThan(page.length);
  });
});
