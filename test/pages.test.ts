// The site's own pages: the list the routes serve, what each one says it is, and the
// pieces the home page is built from.
import { describe, expect, test } from 'bun:test';
import { bundleCss, materialSheets, tokens } from '../src/server/css';
import { decodeEntities, fences } from '../src/server/markdown';
import { commandNames, commandPage, commandTable } from '../src/server/reference';
import { handleRequest } from '../server';
import { contentReady, read, refInfo } from '../src/server/team';
import { descriptionFor, headline, headlineAccent, headlineLead, homePoints, homeSamples, homeTitle, info, INSTALL_PACKAGE, installCommands, installLine, installMarkup, nav, pages, readingOrder, versionLine } from '../src/server/pages';

/** The text a page shows of a block: the tags out, the entities decoded, as docs:check reads it. */
function blockText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\n$/, '');
}
/** Every block a page shows, in order: its terminals and its code blocks. */
function blocks(html: string): string[] {
  return [...html.matchAll(/<pre class="(?:example__code|term)"[^>]*>([\s\S]*?)<\/pre>/g)].map(match => blockText(match[1]!));
}
/** A reference page's fences, as the site renders them; the fixture's own is left out. */
function referenceBlocks(markdown: string): string[] {
  return fences(markdown).filter(fence => fence.lang !== 'fixture').map(fence => fence.text.replace(/\n$/, ''));
}

describe('the page list', () => {
  const list = pages();
  const byPath = new Map(list.map(page => [page.path, page]));

  test('every page is a place of its own, with a title, a description and content', () => {
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
    for (const name of commandNames()) expect(byPath.has(`/docs/commands/${name}/`), name).toBe(true);
    for (const path of ['/docs/', '/docs/file/', '/docs/file/tasks/', '/docs/file/seats/', '/docs/file/delivery-order/', '/docs/file/grant/', '/docs/file/delegates/', '/docs/file/tempo/', '/docs/concepts/registry/', '/docs/commands/', '/docs/safety/', '/docs/clis/']) {
      expect(byPath.has(path), path).toBe(true);
    }
    expect(list.length).toBe(commandNames().length + 12);
  });

  test('every page is reached — the navigation, or a link from a page — and the reading order is the navigation\'s own', () => {
    const inNav = new Set(nav.flatMap(group => group.items.map(item => item.href)));
    for (const page of list) {
      const reached = inNav.has(page.path) || list.some(other => other !== page && other.html.includes(`href="${page.path}"`));
      expect(reached, page.path).toBe(true);
    }
    expect(readingOrder).toEqual(nav.flatMap(group => group.items));
  });

  test('a description is the site\'s own words, one line, and a page without one is a mistake', () => {
    expect(descriptionFor('/')).toBe('Set up and run a team of specialized AI agents in herdr: you set the roster, agents do the work, and you decide.');
    expect(() => descriptionFor('/nowhere/')).toThrow(/no description/);
    for (const path of ['/', '/privacy/', ...list.map(page => page.path)]) {
      const description = descriptionFor(path);
      expect(description.length, path).toBeLessThanOrEqual(160);
      expect(description.includes('\n'), path).toBe(false);
    }
  });

  test('every page has a title of its own, ending in the site\'s name; a command page is named for its command', () => {
    expect(new Set(list.map(page => page.title)).size).toBe(list.length);
    for (const page of list) expect(page.title.endsWith(' — team'), page.path).toBe(true);
    for (const name of commandNames()) expect(byPath.get(`/docs/commands/${name}/`)!.title).toBe(`team ${name} — team`);
  });

  test('a page names this site teamcli.io', async () => {
    for (const path of ['/', '/docs/commands/', '/privacy/', '/robots.txt', '/sitemap.xml']) {
      const body = await (await handleRequest(new Request(`https://teamcli.io${path}`))).text();
      expect(body).not.toContain('team.floor.io');
      expect(body).not.toContain('teamcli.' + 'org');
      expect(body).not.toContain('@teamcli/cli');
      if (path === '/robots.txt' || path === '/sitemap.xml' || path === '/') expect(body).toContain('https://teamcli.io');
    }
  });

  test('the headline is two lines over a subline', async () => {
    expect(headlineLead).toBe('Ship with a team that');
    expect(headlineAccent).toBe('never sleeps.');
    expect(homeTitle).toBe('TeamCLI: specialized agents for your project');
    expect(homeTitle.length).toBeLessThanOrEqual(70);
    const html = await (await handleRequest(new Request('http://localhost/'))).text();
    expect(html).toContain(`<title>${homeTitle}</title>`);
    expect(html).toContain(`<h1 class="hero__name" id="hero-title">${headlineLead}<br><span class="hero__accent">${headlineAccent}</span></h1>`);
    expect(html).toContain('<p class="hero__tagline">Specialized agents, from any lab.</p>');
    expect(html).not.toContain('Agents propose. You decide.');
    expect(html).toContain('name="description" content="Set up and run a team of specialized AI agents in herdr: you set the roster, agents do the work, and you decide."');
    const own = [headline, headlineLead, headlineAccent, homeTitle, versionLine(),
      ...['/', '/privacy/', '/docs/', '/docs/file/', '/docs/commands/', '/docs/concepts/registry/', '/docs/safety/', '/docs/clis/'].map(descriptionFor),
      ...commandNames().map(name => descriptionFor(`/docs/commands/${name}/`))];
    for (const text of own) {
      expect(text.toLowerCase()).not.toContain('vendor');
      expect(text.toLowerCase()).not.toContain('crew');
      expect(text.toLowerCase()).not.toContain('any lab');
    }
  });

  test('a missing page counts the commands the site lists', async () => {
    const html = await (await handleRequest(new Request('http://localhost/no-such-page/'))).text();
    expect(html).toContain(`All ${commandNames().length} commands →`);
    expect(commandNames().length).toBe(39);
    expect(html).not.toContain('eleven');
    expect(descriptionFor('/docs/commands/add/')).toBe('Starts one declared seat, or a temporary one beside the team with --temporary --like <seat> --until <result:path|merged:branch>.');
    expect(descriptionFor('/docs/commands/release/')).toBe('Checks a release on npm and GitHub. When the file has the pairs: Linear milestone, qualifying status update, and the release marker in the public activity file.');
    expect(descriptionFor('/docs/commands/release/').length).toBeLessThanOrEqual(160);
    expect(descriptionFor('/docs/safety/')).toBe('Why team is safe to run: the owner outside herdr, the live file as the record, grants and delegates the owner alone, and what team never does.');
    expect(descriptionFor('/docs/file/')).toBe('The team file, section by section: tasks, seats, delivery order, grant, delegates and tempo — then the format by example and its other fields.');
    expect(descriptionFor('/docs/concepts/registry/')).toBe('The agent, team and project records this machine keeps: what each field means, and why an id is the identity.');
    expect(descriptionFor('/docs/commands/up/')).toBe('Starts the session, a workspace and each seat the file declares, plus the watch; --dry-run prints the plan and the refusals.');
    expect(descriptionFor('/docs/file/').length).toBeLessThanOrEqual(160);
    expect(descriptionFor('/docs/commands/up/').length).toBeLessThanOrEqual(160);
    const home = await (await handleRequest(new Request('http://localhost/'))).text();
    expect(home).toContain('Six sections of <code>.agents/team.yaml</code>, then the format and the other fields.');
    expect(home).not.toContain('Every field of');
  });
});

describe('the home page, from the reference', () => {
  test('the install line is the reference\'s own command', () => {
    expect(installLine()).toBe('npm install -g team');
  });

  test('the install block is a tablist, and every command installs the one package', async () => {
    const commands = installCommands();
    expect(commands.map(item => item.command)).toEqual([
      `bun add -g ${INSTALL_PACKAGE}`,
      `npm install -g ${INSTALL_PACKAGE}`,
      `pnpm add -g ${INSTALL_PACKAGE}`,
      `yarn global add ${INSTALL_PACKAGE}`,
    ]);
    expect(new Set(commands.map(item => item.command.split(' ').at(-1))).size).toBe(1);
    const html = installMarkup();
    expect(html).toContain('role="tablist"');
    expect([...html.matchAll(/role="tab"/g)].length).toBe(commands.length);
    expect([...html.matchAll(/role="tabpanel"/g)].length).toBe(commands.length);
    for (const item of commands) {
      expect(html).toContain(`data-command="${item.command}"`);
      expect(html).toContain(`aria-controls="install-panel-${item.id}"`);
      expect(html).toContain(`id="install-panel-${item.id}"`);
    }
    expect(html).toContain('class="doc-install__copy');
    expect(html).not.toContain('@teamcli/cli');
    const page = await (await handleRequest(new Request('http://localhost/'))).text();
    expect(page).toContain('["bun","npm","pnpm","yarn"]');
    expect(page).toContain('data-command="yarn global add team"');
    expect(html).toContain('aria-selected="true"');
    expect([...html.matchAll(/aria-selected="true"/g)].length).toBe(1);
  });

  test('three home points, each a single block of prose', () => {
    const points = homePoints();
    expect(points.length).toBe(3);
    for (const point of points) {
      expect(point.title.length).toBeGreaterThan(0);
      expect(point.text.length).toBeGreaterThan(0);
      expect(point.text).not.toContain('\n');
    }
  });

  test('the landing sums up safety in its own words; the exact claims stay on the safety page', () => {
    const point = homePoints().find(entry => entry.title === 'Safe by design')!;
    expect(point.text).toContain('what only you can');
    expect(point.text).toContain('stops at the edge');
    expect(point.text.toLowerCase()).not.toContain('vendor');
    expect(point.text.toLowerCase()).not.toContain('crew');
    const safety = pages().find(page => page.path === '/docs/safety/')!.html;
    expect(safety).toContain('lab&#39;s config');
    expect(safety).toContain('project record');
  });

  test('three samples: the file, the plan and the reading, each a whole block of a tested page', () => {
    const samples = homeSamples();
    expect(samples.map(sample => sample.label)).toEqual(['The file', 'The plan', 'The reading']);
    expect(samples[0]!.fence.lang).toBe('yaml');
    expect(samples[1]!.fence.lang).toBe('console');
    expect(samples[2]!.fence.lang).toBe('console');
    expect(samples[0]!.fence.text).toContain('project:');
    expect(samples[1]!.fence.text).toContain('team down --dry-run');
    expect(samples[2]!.fence.text).toContain('team status');
  });
});

describe('the command pages, one per reference page', () => {
  const byPath = new Map(pages().map(page => [page.path, page]));

  test('each command page shows exactly its reference page\'s blocks, once each and in order', () => {
    for (const name of commandNames()) {
      const page = byPath.get(`/docs/commands/${name}/`)!;
      expect(blocks(page.html), name).toEqual(referenceBlocks(commandPage(name)));
    }
  });

  test('the reference\'s internal notes and its development-only note never reach a page', () => {
    for (const page of byPath.values()) {
      expect(page.html.includes('docs/internal'), page.path).toBe(false);
      expect(page.html.includes('TEAMCLI_DEV_MODE'), page.path).toBe(false);
    }
  });

  test('no page serves a command the reference no longer has', () => {
    expect(byPath.has('/docs/commands/approve/')).toBe(false);
    const served = [...byPath.keys()].filter(path => path.startsWith('/docs/commands/') && path !== '/docs/commands/').map(path => path.split('/')[3]!);
    expect(new Set(served).size).toBe(commandNames().length);
    expect(served.every(name => commandNames().includes(name))).toBe(true);
  });

  test('the command index lists them all, each with a summary and who may run it', () => {
    const index = byPath.get('/docs/commands/')!;
    expect([...index.html.matchAll(/class="doc-entry__name"><code>team ([a-z-]+)<\/code>/g)].map(match => match[1])).toEqual(commandNames());
    expect([...index.html.matchAll(/class="doc-entry__who">/g)].length).toBe(commandNames().length);
    expect(index.html).toContain('<span class="doc-entry__who">the owner</span>');
  });
});

describe('the docs beside the commands', () => {
  const byPath = new Map(pages().map(page => [page.path, page]));

  test('the team file hub is the example file section by section, then the format and its other fields', () => {
    const hub = byPath.get('/docs/file/')!;
    expect(hub.html).toContain('<h1 id="the-team-file">The team file</h1>');
    expect(hub.html).toContain('The sections');
    expect(hub.html).toContain('The format, by example');
    expect(hub.html).toContain('More fields');
    expect((hub.html.match(/class="doc-entry"/g) ?? []).length).toBe(6);
  });

  test('each card of the hub is a page of its own, carrying its section', () => {
    const hub = byPath.get('/docs/file/')!;
    const cards = [...hub.html.matchAll(/<a class="doc-entry" href="(\/docs\/file\/[a-z-]+\/)"/g)].map(match => match[1]!);
    expect(cards.length).toBe(6);
    for (const path of cards) {
      const page = byPath.get(path);
      expect(page, path).toBeTruthy();
      expect(page!.html).toContain('Part of <a href="/docs/file/">the team file</a>');
    }
  });

  test('the delivery order page keeps the section\'s fence and its rules, and leaves the nested example out', () => {
    const page = byPath.get('/docs/file/delivery-order/')!;
    expect(blocks(page.html).length).toBe(1);
    expect(page.html).toContain('read outermost first');
    expect((page.html.match(/<li>/g) ?? []).length).toBe(3);
  });

  test('the registries page is the reference\'s page whole', () => {
    const page = byPath.get('/docs/concepts/registry/')!;
    expect(page.html).toContain('The agent, team and project registries');
    expect(blocks(page.html)).toEqual(referenceBlocks(read('docs/concepts/registry.md')));
  });

  test('getting started installs the package and walks the first run', () => {
    const page = byPath.get('/docs/')!;
    expect(page.html).toContain('<h1 id="getting-started">Getting started</h1>');
    expect(page.html).toContain('The file is private to each clone');
    expect(page.html).toContain('Your first team in five minutes');
  });

  test('the CLIs page names each profile with its sign-in check', () => {
    const page = byPath.get('/docs/clis/')!;
    for (const cli of ['claude-code', 'codex', 'cursor', 'antigravity']) expect(page.html, cli).toContain(`<td><code>${cli}</code></td>`);
    expect(page.html).toContain('team doctor --login');
  });
});

describe('the safety page, from the reference', () => {
  const safety = pages().find(page => page.path === '/docs/safety/')!;

  test('the who-may-run-what table gives each command its own rule', () => {
    const row = (name: string) => new RegExp(`<td><code>team ${name}</code></td><td>([\\s\\S]*?)</td>`).exec(safety.html)?.[1] ?? '';
    expect(row('up')).toContain("the owner or the team's lead seat, or a delegate entry naming <code>up</code>");
    expect(row('up')).toContain("a verified grant admits the orchestrator's seat");
    expect(row('down')).toBe("the owner or the team's lead seat, or a delegate entry");
    expect(row('up')).not.toBe(row('down'));
    expect([...safety.html.matchAll(/<td><code>team [a-z-]+<\/code><\/td><td>/g)].length).toBe(commandTable().length);
  });

  test('the grants and the delegates are the owner\'s alone, in the reference\'s words', () => {
    expect(safety.html).toContain('Records the grant the owner gives');
    expect(safety.html).toContain('Names panes outside');
  });

  test('the claim about a lab\'s config carries what a launch still writes', () => {
    expect(safety.html).toContain('lab&#39;s config');
    expect(safety.html).toContain('project record');
  });
});

describe('the reference the site is built against', () => {
  test('the content was fetched, and it says which ref it is', () => {
    expect(contentReady()).toBe(true);
    const ref = refInfo();
    // A release candidate carries a prerelease suffix (e.g. 0.5.0-rc.5).
    expect(ref.version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/);
    expect(ref.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ref.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(info.version).toBe(ref.version);
  });

  test('the eyebrow is TeamCLI and the version of the extracted package', async () => {
    const version = (JSON.parse(read('package.json')) as { version: string }).version;
    expect(versionLine()).toBe(`TeamCLI · VERSION ${version}`);
    const html = await (await handleRequest(new Request('http://localhost/'))).text();
    expect(html).toContain(`>${versionLine()}<`);
    expect(html).not.toContain('THE TEAM CLI');
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
