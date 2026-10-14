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

  test('every page is reached — the navigation, or a link from a page — and the reading order is the navigation\'s own', () => {
    const inNav = new Set(nav.flatMap(group => group.items.map(item => item.href)));
    for (const page of pages()) {
      const reached = inNav.has(page.path) || pages().some(other => other !== page && other.html.includes(`href="${page.path}"`));
      expect(reached, page.path).toBe(true);
    }
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
    expect(commandNames().length).toBe(16);
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

describe('the team up reference, in pages', () => {
  const byPath = new Map(pages().map(page => [page.path, page]));
  const up = byPath.get('/docs/commands/up/')!;
  const words = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

  test('one hub page and five reference pages, each linked from the hub and linking back', () => {
    expect([...byPath.keys()].filter(path => path.startsWith('/docs/commands/up/'))).toEqual([
      '/docs/commands/up/', '/docs/commands/up/launch/', '/docs/commands/up/records/', '/docs/commands/up/waiting/', '/docs/commands/up/limits/', '/docs/commands/up/refusals/',
    ]);
    for (const path of ['/docs/commands/up/launch/', '/docs/commands/up/records/', '/docs/commands/up/waiting/', '/docs/commands/up/limits/', '/docs/commands/up/refusals/']) {
      expect(up.html).toContain(`href="${path}"`);
      expect(byPath.get(path)!.html).toContain('href="/docs/commands/up/"');
    }
  });

  test('the hub holds the purpose, the flags, three examples and the short behaviour', () => {
    expect(up.toc.map(item => item.title)).toEqual(['Flags', 'Examples', 'Who may run it', 'What it reads and writes', 'What it prints', 'Exit codes', 'Known issues', 'The reference pages']);
    expect((up.html.match(/<pre /g) ?? []).length).toBe(4);
    // The opening is the whole first paragraph: the stopped-seat rule is hub material.
    expect(up.html).toContain('left out until');
    // The record sample the first "What it prints" sentence introduces rides with it.
    expect(up.html).toContain('claude-keeper: ready\nclaude-beacon: ready');
    // The deep material is not on the hub: it is on the reference pages.
    expect(up.html).not.toContain('The records are what stdout gets');
    expect(up.html).not.toContain('[o] open pane');
    // The hub is a fraction of the whole set, not the whole on one page.
    const set = [...byPath.values()].filter(page => page.path.startsWith('/docs/commands/up/')).map(page => words(page.html)).reduce((a, b) => a + b, 0);
    expect(words(up.html) * 3).toBeLessThan(set);
  });

  test('the deep material is on the reference pages, in the reference\'s own words', () => {
    expect(byPath.get('/docs/commands/up/launch/')!.html).toContain('under the run lock');
    expect(byPath.get('/docs/commands/up/records/')!.html).toContain('The records are what stdout gets');
    expect(byPath.get('/docs/commands/up/waiting/')!.html).toContain('[o] open pane, [s] skip seat, [q] stop cleanly');
    expect(byPath.get('/docs/commands/up/limits/')!.html).toContain('The waiting proof is placement');
    expect(byPath.get('/docs/commands/up/refusals/')!.html).toContain('only the owner runs');
    // The limits page is its five bullets alone: the records tail that follows them in the
    // reference belongs to the records page, once.
    const limits = byPath.get('/docs/commands/up/limits/')!.html;
    expect(limits).not.toContain('The records are what stdout gets');
    expect(limits).not.toContain('left out: timeout (no terminal for owner)');
    expect(limits).not.toContain('[o] open pane');
  });

  test('the reference pages answer, each with its own title and description', async () => {
    const expected: [string, string, string][] = [
      ['/docs/commands/up/launch/', 'team up: the launch — team', 'What team up does before it creates anything'],
      ['/docs/commands/up/records/', 'team up: the records — team', 'Every line a team up run prints'],
      ['/docs/commands/up/waiting/', 'team up: waiting for the owner — team', 'The pause when a seat stops at a dialog'],
      ['/docs/commands/up/limits/', 'team up: known limits — team', 'The windows a process of the same user still has'],
      ['/docs/commands/up/refusals/', 'team up: refusals — team', 'What stops a team up run before its first step'],
    ];
    for (const [path, title, description] of expected) {
      const response = await handleRequest(new Request(`https://teamcli.io${path}`));
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain(`<title>${title}</title>`);
      expect(body).toContain(description);
    }
  });
});

describe('the team status reference, in pages', () => {
  const byPath = new Map(pages().map(page => [page.path, page]));
  const status = byPath.get('/docs/commands/status/')!;
  const words = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const refPaths = ['/docs/commands/status/rows/', '/docs/commands/status/differences/', '/docs/commands/status/budgets/', '/docs/commands/status/json/'];

  test('one hub page and four reference pages, each linked from the hub and linking back', () => {
    expect([...byPath.keys()].filter(path => path.startsWith('/docs/commands/status/'))).toEqual([
      '/docs/commands/status/', ...refPaths,
    ]);
    for (const path of refPaths) {
      expect(status.html).toContain(`href="${path}"`);
      expect(byPath.get(path)!.html).toContain('href="/docs/commands/status/"');
    }
  });

  test('the hub holds the purpose, the flags, the base example, the machine check and the short behaviour', () => {
    expect(status.toc.map(item => item.title)).toEqual(['Flags', 'Examples', 'Who may run it', 'What it reads and writes', 'The machine check', 'Refusals', 'Exit codes', 'The reference pages']);
    expect((status.html.match(/<pre class="(?:example__code|term)"/g) ?? []).length).toBe(3);
    // The purpose is the whole first paragraph: the repair-naming is hub material.
    expect(status.html).toContain('It names the command that repairs each difference');
    // The base reading and the machine-check note ride on the hub.
    expect(status.html).toContain('difference: claude-keeper is in the file and is not running');
    expect(status.html).toContain('would refuse now');
    // The deep sections are not on the hub: they are on the reference pages.
    expect(status.html).not.toContain('A pane is its seat only while the process');
    expect(status.html).not.toContain('the agent in');
    // The hub is a fraction of the whole set, not the whole on one page.
    const set = [...byPath.values()].filter(page => page.path.startsWith('/docs/commands/status/')).map(page => words(page.html)).reduce((a, b) => a + b, 0);
    expect(words(status.html) * 2).toBeLessThan(set);
  });

  test('the deep material is on the reference pages, in the reference\'s own words', () => {
    expect(byPath.get('/docs/commands/status/rows/')!.html).toContain('A pane is its seat only while the process');
    expect(byPath.get('/docs/commands/status/differences/')!.html).toContain('the agent in');
    expect(byPath.get('/docs/commands/status/differences/')!.html).toContain('<span class="term__command">team add claude-keeper</span>');
    expect(byPath.get('/docs/commands/status/budgets/')!.html).toContain('CODEX_HOME');
    expect(byPath.get('/docs/commands/status/json/')!.html).toContain('team status --json');
    // The rows prose sits on the rows page, not duplicated onto the differences page.
    expect(byPath.get('/docs/commands/status/differences/')!.html).not.toContain('A pane is its seat only while the process');
  });

  test('the reference pages answer, each with its own title and description', async () => {
    const expected: [string, string, string][] = [
      ['/docs/commands/status/rows/', 'team status: the rows — team', 'One line per seat in team status'],
      ['/docs/commands/status/differences/', 'team status: differences — team', 'Every way the file, the state and the live session disagree in team status'],
      ['/docs/commands/status/budgets/', 'team status: budgets — team', 'The budgets table team status prints after the seats'],
      ['/docs/commands/status/json/', 'team status: the JSON — team', 'team status --json: the same reading as one document'],
    ];
    for (const [path, title, description] of expected) {
      const response = await handleRequest(new Request(`https://teamcli.io${path}`));
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain(`<title>${title}</title>`);
      expect(body).toContain(description);
    }
  });
});

describe('the team usage reference, in pages', () => {
  const byPath = new Map(pages().map(page => [page.path, page]));
  const usage = byPath.get('/docs/commands/usage/')!;
  const words = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const refPaths = ['/docs/commands/usage/reads-writes/', '/docs/commands/usage/report/', '/docs/commands/usage/restricted/', '/docs/commands/usage/json/', '/docs/commands/usage/refusals/'];

  test('one hub page and five reference pages, each linked from the hub and linking back', () => {
    expect([...byPath.keys()].filter(path => path.startsWith('/docs/commands/usage/'))).toEqual([
      '/docs/commands/usage/', ...refPaths,
    ]);
    for (const path of refPaths) {
      expect(usage.html).toContain(`href="${path}"`);
      expect(byPath.get(path)!.html).toContain('href="/docs/commands/usage/"');
    }
  });

  test('the hub holds the purpose, the worked example and the short behaviour', () => {
    expect(usage.toc.map(item => item.title)).toEqual(['Examples', 'What it reads and writes', 'Who may run it', 'Exit codes', 'The reference pages']);
    // The worked example: the team file and the restricted-view output.
    expect((usage.html.match(/<pre class="(?:example__code|term)"/g) ?? []).length).toBe(2);
    expect(usage.html).toContain('Shows what this machine holds');
    expect(usage.html).toContain('usage on this machine, 1 team');
    // The deep material is not on the hub: it is on the reference pages.
    expect(usage.html).not.toContain('The header counts the machine');
    expect(usage.html).not.toContain('The restricted view is a closed list of fields');
    expect(usage.html).not.toContain('&quot;view&quot;: &quot;restricted&quot;');
    // The hub is a fraction of the whole set, not the whole on one page.
    const set = [...byPath.values()].filter(page => page.path.startsWith('/docs/commands/usage/')).map(page => words(page.html)).reduce((a, b) => a + b, 0);
    expect(words(usage.html) * 2).toBeLessThan(set);
  });

  test('the deep material is on the reference pages, in the reference\'s own words', () => {
    expect(byPath.get('/docs/commands/usage/reads-writes/')!.html).toContain('opens no lock, writes no state and logs no line');
    expect(byPath.get('/docs/commands/usage/report/')!.html).toContain('The header counts the machine');
    expect(byPath.get('/docs/commands/usage/restricted/')!.html).toContain('The restricted view is a closed list of fields');
    expect(byPath.get('/docs/commands/usage/json/')!.html).toContain('&quot;view&quot;: &quot;restricted&quot;');
    expect(byPath.get('/docs/commands/usage/refusals/')!.html).toContain('is a note line and exit 0');
    // The report page does not carry the JSON document; that is the JSON page.
    expect(byPath.get('/docs/commands/usage/report/')!.html).not.toContain('&quot;view&quot;: &quot;restricted&quot;');
  });

  test('the reference pages answer, each with its own title and description', async () => {
    const expected: [string, string, string][] = [
      ['/docs/commands/usage/reads-writes/', 'team usage: what it reads and writes — team', 'That team usage writes nothing'],
      ['/docs/commands/usage/report/', 'team usage: the report — team', 'The team usage report'],
      ['/docs/commands/usage/restricted/', 'team usage: the restricted view — team', 'Which caller reads the full or restricted view'],
      ['/docs/commands/usage/json/', 'team usage: the JSON — team', 'What team usage --json prints'],
      ['/docs/commands/usage/refusals/', 'team usage: refusals — team', 'The two things that refuse team usage'],
    ];
    for (const [path, title, description] of expected) {
      const response = await handleRequest(new Request(`https://teamcli.io${path}`));
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain(`<title>${title}</title>`);
      expect(body).toContain(description);
    }
  });
});

describe('the team down reference, in pages', () => {
  const byPath = new Map(pages().map(page => [page.path, page]));
  const down = byPath.get('/docs/commands/down/')!;
  const words = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const refPaths = ['/docs/commands/down/delegate/', '/docs/commands/down/output/', '/docs/commands/down/edge-cases/', '/docs/commands/down/refusals/'];

  test('one hub page and four reference pages, each linked from the hub and linking back', () => {
    expect([...byPath.keys()].filter(path => path.startsWith('/docs/commands/down/'))).toEqual([
      '/docs/commands/down/', ...refPaths,
    ]);
    for (const path of refPaths) {
      expect(down.html).toContain(`href="${path}"`);
      expect(byPath.get(path)!.html).toContain('href="/docs/commands/down/"');
    }
  });

  test('the hub holds the purpose, the flags, the basic walkthrough and the short behaviour', () => {
    expect(down.toc.map(item => item.title)).toEqual(['Flags', 'Examples', 'What it reads and writes', 'Who may run it', 'What it prints', 'Exit codes', 'The reference pages']);
    // The walkthrough trio: the team file, the dry-run plan, the owner's stop.
    expect((down.html.match(/<pre class="(?:example__code|term)"/g) ?? []).length).toBe(3);
    expect(down.html).toContain('claude-keeper: stopped');
    // The deep material is not on the hub: it is on the reference pages.
    expect(down.html).not.toContain('A pane the team file');
    expect(down.html).not.toContain('is working (');
    expect(down.html).not.toContain('team.yaml is invalid');
    expect(down.html).not.toContain('this call is claude-beacon');
    // The hub is a fraction of the whole set, not the whole on one page.
    const set = [...byPath.values()].filter(page => page.path.startsWith('/docs/commands/down/')).map(page => words(page.html)).reduce((a, b) => a + b, 0);
    expect(words(down.html) * 2).toBeLessThan(set);
  });

  test('the deep material is on the reference pages, in the reference\'s own words', () => {
    expect(byPath.get('/docs/commands/down/delegate/')!.html).toContain('A pane the team file');
    expect(byPath.get('/docs/commands/down/delegate/')!.html).toContain('this call is claude-beacon');
    expect(byPath.get('/docs/commands/down/output/')!.html).toContain('holds unsent text in its input box');
    expect(byPath.get('/docs/commands/down/edge-cases/')!.html).toContain('team.yaml is invalid');
    expect(byPath.get('/docs/commands/down/edge-cases/')!.html).toContain('claude-relay');
    expect(byPath.get('/docs/commands/down/refusals/')!.html).toContain('another session-mutating run is holding session');
    // The dry-run plan is fenced twice in the reference, so it shows on both the hub and the edge-cases page.
    expect(down.html).toContain('wait until claude-keeper');
    expect(byPath.get('/docs/commands/down/edge-cases/')!.html).toContain('wait until claude-keeper');
  });

  test('the reference pages answer, each with its own title and description', async () => {
    const expected: [string, string, string][] = [
      ['/docs/commands/down/delegate/', 'team down: the approved delegate — team', 'The approved delegate for team down'],
      ['/docs/commands/down/output/', 'team down: what it prints — team', 'What team down prints'],
      ['/docs/commands/down/edge-cases/', 'team down: a renamed seat and a broken file — team', 'Two team down runs'],
      ['/docs/commands/down/refusals/', 'team down: refusals — team', 'Every message that refuses team down'],
    ];
    for (const [path, title, description] of expected) {
      const response = await handleRequest(new Request(`https://teamcli.io${path}`));
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain(`<title>${title}</title>`);
      expect(body).toContain(description);
    }
  });
});

describe('the team approve reference, in pages', () => {
  const byPath = new Map(pages().map(page => [page.path, page]));
  const approve = byPath.get('/docs/commands/approve/')!;
  const words = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const refPaths = ['/docs/commands/approve/who/', '/docs/commands/approve/read-back/', '/docs/commands/approve/record/', '/docs/commands/approve/refusals/', '/docs/commands/approve/overrides/'];

  test('one hub page and five reference pages, each linked from the hub and linking back', () => {
    expect([...byPath.keys()].filter(path => path.startsWith('/docs/commands/approve/'))).toEqual([
      '/docs/commands/approve/', ...refPaths,
    ]);
    for (const path of refPaths) {
      expect(approve.html).toContain(`href="${path}"`);
      expect(byPath.get(path)!.html).toContain('href="/docs/commands/approve/"');
    }
  });

  test('the hub holds the purpose, the flags, the basic walkthrough and the short behaviour', () => {
    expect(approve.toc.map(item => item.title)).toEqual(['Flags', 'Examples', 'Who may run it', 'What it reads and writes', 'What it prints', 'Exit codes', 'The reference pages']);
    // The walkthrough trio: the team file, the --show read, the owner's approve.
    expect((approve.html.match(/<pre class="(?:example__code|term)"/g) ?? []).length).toBe(3);
    expect(approve.html).toContain('project: beacon');
    expect(approve.html).toContain('Approved. The record is in');
    // The deep material is not on the hub: it is on the reference pages.
    expect(approve.html).not.toContain('The record this command writes is signed');
    expect(approve.html).not.toContain('A delegate\'s approval is for ordinary changes');
    expect(approve.html).not.toContain('lives in the approval store, beside the record');
    expect(approve.html).not.toContain('Type the number of seats (2)');
    // The hub is a fraction of the whole set, not the whole on one page.
    const set = [...byPath.values()].filter(page => page.path.startsWith('/docs/commands/approve/')).map(page => words(page.html)).reduce((a, b) => a + b, 0);
    expect(words(approve.html) * 2).toBeLessThan(set);
  });

  test('the deep material is on the reference pages, in the reference\'s own words', () => {
    expect(byPath.get('/docs/commands/approve/who/')!.html).toContain('approval is for ordinary changes: the roster');
    expect(byPath.get('/docs/commands/approve/who/')!.html).toContain('only the owner approves a team file, from a terminal outside herdr; this call is claude-keeper');
    expect(byPath.get('/docs/commands/approve/read-back/')!.html).toContain('Then the ceilings the approval would fix');
    expect(byPath.get('/docs/commands/approve/read-back/')!.html).toContain('Needs a new approval: `trust` changed.');
    expect(byPath.get('/docs/commands/approve/record/')!.html).toContain('The record this command writes is signed');
    expect(byPath.get('/docs/commands/approve/record/')!.html).toContain('approved before records were signed');
    expect(byPath.get('/docs/commands/approve/refusals/')!.html).toContain('delegation needs a verified approval');
    expect(byPath.get('/docs/commands/approve/refusals/')!.html).toContain('Type the number of seats (2) to approve this file');
    expect(byPath.get('/docs/commands/approve/overrides/')!.html).toContain('lives in the approval store, beside the record');
    // The read-back page does not carry the refusal walkthrough; that is the refusals page.
    expect(byPath.get('/docs/commands/approve/read-back/')!.html).not.toContain('Type the number of seats (2)');
  });

  test('the reference pages answer, each with its own title and description', async () => {
    const expected: [string, string, string][] = [
      ['/docs/commands/approve/who/', 'team approve: who may run it — team', 'Who may run team approve'],
      ['/docs/commands/approve/read-back/', 'team approve: the read-back — team', 'What team approve prints back'],
      ['/docs/commands/approve/record/', 'team approve: the signed record — team', 'The signed approval record'],
      ['/docs/commands/approve/refusals/', 'team approve: refusals — team', 'What refuses a team approve write'],
      ['/docs/commands/approve/overrides/', 'team approve: the overrides file — team', 'overrides.yaml beside the approval record'],
    ];
    for (const [path, title, description] of expected) {
      const response = await handleRequest(new Request(`https://teamcli.io${path}`));
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain(`<title>${title}</title>`);
      expect(body).toContain(description);
    }
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
