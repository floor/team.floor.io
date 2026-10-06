// The site's own pages: the list the routes serve, what each one says it is, and the
// pieces the home page is built from.
import { describe, expect, test } from 'bun:test';
import { bundleCss, materialSheets, tokens } from '../src/server/css';
import { commandNames } from '../src/server/reference';
import { handleRequest } from '../server';
import { contentReady, read, refInfo } from '../src/server/team';
import { descriptionFor, headline, headlineAccent, headlineLead, homePoints, homeSamples, homeTitle, info, INSTALL_PACKAGE, installCommands, installLine, installMarkup, nav, packageLead, pages, readingOrder, versionLine } from '../src/server/pages';

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
    expect(descriptionFor('/')).toBe(packageLead());
    expect(descriptionFor('/')).toBe('Set up and run a team of AI agents for your project. Agents propose, you decide.');
    expect(() => descriptionFor('/nowhere/')).toThrow(/no description/);
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

  test('the headline is two lines, and nothing sits under it', async () => {
    expect(headlineLead).toBe('A team of agents for your project,');
    expect(headlineAccent).toBe('from one lab or several.');
    expect(homeTitle).toBe('TeamCLI: a team of agents for your project, from one lab or several');
    expect(homeTitle.length).toBeLessThanOrEqual(70);
    const html = await (await handleRequest(new Request('http://localhost/'))).text();
    expect(html).toContain(`<title>${homeTitle}</title>`);
    expect(html).toContain(`<h1 class="hero__name" id="hero-title">${headlineLead}<br><span class="hero__accent">${headlineAccent}</span></h1>`);
    expect(html).not.toContain('hero__tagline');
    expect(html).not.toContain('Agents propose. You decide.');
    expect(html).toContain('name="description" content="Set up and run a team of AI agents for your project. Agents propose, you decide."');
    const own = [headline, headlineLead, headlineAccent, homeTitle, versionLine(), ...['/', '/privacy/', '/docs/', '/docs/file/', '/docs/commands/', '/docs/safety/', '/docs/clis/'].map(descriptionFor)];
    for (const text of own) {
      expect(text.toLowerCase()).not.toContain('vendor');
      expect(text.toLowerCase()).not.toContain('crew');
      expect(text.toLowerCase()).not.toContain('any lab');
    }
  });

  test('a missing page counts the commands the site lists', async () => {
    const html = await (await handleRequest(new Request('http://localhost/no-such-page/'))).text();
    expect(html).toContain(`All ${commandNames().length} commands →`);
    expect(commandNames().length).toBe(13);
    expect(html).not.toContain('eleven');
    expect(descriptionFor('/docs/commands/add/')).toBe('Starts one declared seat, or a temporary one beside the team with --temporary --like <seat> --until <result:path|merged:branch>.');
    expect(descriptionFor('/docs/commands/release/')).toBe('Checks a release on npm and GitHub. When the file has the pairs: Linear milestone, qualifying status update, and the release marker in the public activity file.');
    expect(descriptionFor('/docs/commands/release/').length).toBeLessThanOrEqual(160);
    expect(descriptionFor('/docs/safety/')).toBe('Why team is safe to run: the owner outside herdr, the approved copy, and dialogs.trust: owner sends no key, coordinator may press it from its own seat.');
    const safety = pages().find(page => page.path === '/docs/safety/')!.html;
    expect(safety).toContain('dialogs.trust: owner or coordinator');
    expect(safety).not.toContain('Trust is left to the owner');
    const home = await (await handleRequest(new Request('http://localhost/'))).text();
    expect(home).toContain('dialogs.trust: owner sends no key, or the coordinator may.');
    expect(home).not.toContain('prompts team never answers');
    expect(home).toContain('Seven sections of <code>.agents/team.yaml</code>, then the other fields.');
    expect(home).not.toContain('Every field of');
    expect(descriptionFor('/docs/file/')).toBe('Seven sections of .agents/team.yaml — the head, identity, workspace, machine, seats, watch and budgets — then the other fields the README names.');
    expect(descriptionFor('/docs/commands/up/')).toBe('Starts the session, a workspace and each seat the file has not stopped, plus the watch; a stopped seat waits for team add. --dry-run prints the plan.');
    expect(descriptionFor('/docs/file/').length).toBeLessThanOrEqual(160);
    expect(descriptionFor('/docs/commands/up/').length).toBeLessThanOrEqual(160);
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
    expect(point.text).toContain('lab\'s config');
    expect(point.text).toContain('project record');
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
