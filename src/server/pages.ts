// Every page of the site, assembled from the reference at TEAM_REF.
//
// Nothing here retypes what the reference says. A page is built from named pieces of the
// README, the command pages and the docs under `docs/` — a section, a paragraph, a bullet,
// a sentence, a table row, a fenced block — and reference.ts throws when the reference no
// longer has one. So a ref that moved fails loudly here, in `bun test` and in docs:check,
// instead of quietly shipping a page that says something the package no longer does.
import { bullet, commandNames, commandPage, commandTable, fenceWith, paragraph, section, sentence, README, ReferenceError } from './reference';
import { escapeHtml, fenceHtml, renderMarkdown, slug, type Fence, type Rendered } from './markdown';
import { contentReady, packageVersion, read, refInfo } from './team';

if (!contentReady()) throw new Error('content/team is missing: run `bun run content` (scripts/content.ts) first.');

export const info = refInfo();

/** The docs pages beside the command reference, as the reference ships them. */
const TEAM_FILE_DOC = read('docs/team-file.md');
const REGISTRY_DOC = read('docs/concepts/registry.md');

/** The home page's eyebrow. The version is the package's own, and it has to be the version the reference record carries: the two are written together, and a page that showed one of them stale would be wrong. */
export function versionLine(): string {
  const version = packageVersion();
  if (version !== info.version) throw new Error(`content/team/package.json says ${version}, and the reference record says ${info.version || 'nothing'}`);
  return `TeamCLI · VERSION ${version}`;
}

/** The owner's headline, two lines; the second is the accent line, with the subline under it. */
export const headlineLead = 'Ship with a team that';
export const headlineAccent = 'never sleeps.';
/** The subline under the headline. */
export const heroSubline = 'Specialized agents, from any lab.';
/** The same words in one line, for the preview alt and the link card. */
export const headline = `${headlineLead} ${headlineAccent}`;
/** The home page's title. It is not the headline, and it stays within 70 characters. */
export const homeTitle = 'TeamCLI: specialized agents for your project';

/** A page built from parts: the headings its table of contents links to, then the text. */
export class Doc {
  private readonly parts: string[] = [];
  readonly toc: Rendered['toc'] = [];
  private readonly ids = new Map<string, number>();

  /** The page's own title. A command page brings its own, from its heading in the reference. */
  h1(title: string): this {
    this.parts.push(`<h1 id="${slug(title)}">${escapeHtml(title)}</h1>\n`);
    return this;
  }

  /** A heading of the page's own: depth 2 joins the table of contents, deeper ones don't. */
  heading(title: string, depth = 2): this {
    const base = slug(title);
    const count = this.ids.get(base) ?? 0;
    this.ids.set(base, count + 1);
    const id = count ? `${base}-${count}` : base;
    if (depth === 2) this.toc.push({ title, id });
    this.parts.push(`<h${depth} id="${id}">${escapeHtml(title)}</h${depth}>\n`);
    return this;
  }

  /** A reference page, or a piece of one: its prose, and its blocks as the site renders them. */
  md(markdown: string, options: { skip?: (fence: Fence) => boolean } = {}): this {
    const rendered = renderMarkdown(markdown, options);
    this.parts.push(rendered.html);
    this.toc.push(...rendered.toc);
    return this;
  }

  /** One block of the reference, as itself. */
  block(fence: Fence): this {
    this.parts.push(fenceHtml(fence));
    return this;
  }

  /** The site's own sentence, between pieces the reference gave. */
  note(html: string): this {
    this.parts.push(`<p class="note">${html}</p>\n`);
    return this;
  }

  /** The site's own markup, verbatim. */
  raw(html: string): this {
    this.parts.push(html);
    return this;
  }

  /** A table, from rows the reference gave; the cells may hold markup. */
  table(caption: string, head: string[], rows: string[][]): this {
    this.parts.push(
      `<div class="table-wrap"><table><caption class="visually-hidden">${escapeHtml(caption)}</caption>` +
      `<thead><tr>${head.map(text => `<th scope="col">${escapeHtml(text)}</th>`).join('')}</tr></thead>` +
      `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>\n`,
    );
    return this;
  }

  render(): Rendered {
    return { html: this.parts.join(''), toc: this.toc };
  }
}

/** The first block of prose after a reference page's own heading: its summary. */
export function summaryOf(name: string): string {
  const body = commandPage(name).split('\n').slice(1).join('\n');
  const block = body.split(/\r?\n\s*\r?\n/).map(part => part.trim()).find(part => part && !part.startsWith('```') && !part.startsWith('    ') && !part.startsWith('#'));
  return block ?? '';
}

/** The first sentence of a piece of prose, for a card or a description. */
function firstSentence(text: string): string {
  const match = /[.!?](?=\s+(?![a-z])|\s*$)/.exec(text);
  return (match ? text.slice(0, match.index + 1) : text).replace(/\s+/g, ' ').trim();
}

/** A piece of the reference as inline HTML: escaped, its `code` spans kept. */
export function inline(markdown: string): string {
  return escapeHtml(markdown).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// ---------------------------------------------------------------- the home page

/** The install command, as the README's own install block writes it. */
export function installLine(): string {
  const block = fenceWith(section(README, 'Install'), 'sh', 'npm install -g team');
  const line = block.text.split('\n').find(text => text.trim().startsWith('npm install'));
  if (!line) throw new ReferenceError('the install block no longer holds an npm install line');
  return line.split('#')[0]!.trim();
}

/**
 * The package the home page's install block installs. Every manager's command is
 * this name, so the block cannot show one package on one tab and another on the next.
 */
export const INSTALL_PACKAGE = 'team';

/** The managers the home page offers, in tab order, and the global-install command each one uses. */
export const INSTALL_MANAGERS = [
  { id: 'bun', command: 'bun add -g' },
  { id: 'npm', command: 'npm install -g' },
  { id: 'pnpm', command: 'pnpm add -g' },
  { id: 'yarn', command: 'yarn global add' },
] as const;

/** One command per manager, the package name taken from {@link INSTALL_PACKAGE}. */
export function installCommands(): { id: string; command: string }[] {
  return INSTALL_MANAGERS.map(manager => ({ id: manager.id, command: `${manager.command} ${INSTALL_PACKAGE}` }));
}

/**
 * The home page's install block: a tab per manager, the command for each already in the
 * page, and a Copy button. The first tab is selected. A visitor without scripts sees that
 * command; the client only switches which one is shown and remembers the choice.
 */
export function installMarkup(): string {
  const commands = installCommands();
  const tabs = commands.map((item, index) => {
    const selected = index === 0;
    return `<button type="button" class="doc-install__option" role="tab" id="install-tab-${item.id}" data-package-manager="${item.id}" aria-selected="${selected}" aria-controls="install-panel-${item.id}" tabindex="${selected ? '0' : '-1'}">${item.id}</button>`;
  }).join('');
  const panels = commands.map(item =>
    `<div class="doc-install__panel" role="tabpanel" id="install-panel-${item.id}" aria-labelledby="install-tab-${item.id}" data-package-manager="${item.id}" data-command="${escapeHtml(item.command)}" tabindex="0"><pre class="doc-install__command"><code class="hljs language-bash"><span class="install__prompt" aria-hidden="true">$</span> ${escapeHtml(item.command)}</code></pre></div>`,
  ).join('');
  return `<div class="doc-install"><div class="doc-install__bar"><div class="doc-install__switch" role="tablist" aria-label="Package manager">${tabs}</div>` +
    `<button type="button" class="doc-install__copy example__copy mtrl-button mtrl-button--text mtrl-button--xs">Copy</button></div>${panels}</div>\n`;
}

export interface Sample { label: string; caption: string; fence: Fence }
/**
 * The home page's samples: the shortest team file the reference shows, a plan a dry
 * run prints, and what `team status` reads back. Each is one whole fence of a tested
 * page, so the home page shows exactly what `bun test` runs.
 */
export function homeSamples(): Sample[] {
  const status = commandPage('status');
  const down = commandPage('down');
  return [
    { label: 'The file', caption: '.agents/team.yaml — the project\'s whole team', fence: fenceWith(status, 'yaml', 'project: beacon') },
    { label: 'The plan', caption: 'team down --dry-run — every command a stop would run, and what it leaves alone', fence: fenceWith(down, 'console', 'team down --dry-run') },
    { label: 'The reading', caption: 'team status — the seats, and the repair for each difference', fence: fenceWith(status, 'console', 'team status ; echo "exit $?"') },
  ];
}

/** The three points of the home page. The first and the third are sentences of the reference; the middle one is the site's own. */
export function homePoints(): { title: string; text: string }[] {
  const watch = commandTable().find(row => row.name === 'watch');
  if (!watch) throw new ReferenceError('the commands table no longer lists `team watch`');
  const capitalised = watch.summary.charAt(0).toUpperCase() + watch.summary.slice(1);
  return [
    // Site-authored by design: a product-positioning line, not a reference sentence — the
    // approved exception to this file's "nothing retypes the reference" rule.
    { title: 'Any model, in any seat', text: 'Put the right specialized agent — from any lab — on each role, and swap it without rewriting the team.' },
    // Site-authored by design: the approved exception to this file's "nothing retypes the reference" rule.
    // A visitor's summary of the safety model; the exact, reference-bound claims live on /docs/safety/.
    { title: 'Safe by design', text: 'Clear line between what agents decide and what only you can: the team moves fast inside its envelope and stops at the edge.' },
    { title: 'The watch tells you', text: `${capitalised.split(';')[0]}.` },
  ];
}

// ---------------------------------------------------------------- the documentation

/** /docs/ — getting started: the install, where the file lives, the five minutes. */
export function gettingStarted(): Rendered {
  return new Doc()
    .h1('Getting started')
    .md(paragraph(README, '`team` is a small command-line tool'))
    .heading('Install')
    .md(section(README, 'Install'))
    .heading('The file is private to each clone')
    .md(section(README, 'The file is private to each clone'))
    .heading('Your first team in five minutes')
    .md(section(README, 'Your first team in five minutes'))
    .render();
}

/** The six sections docs/team-file.md documents, each its own page under /docs/file/. */
const FILE_SECTIONS: { path: string; heading: string; name: string; title: string; summary: string }[] = [
  { path: '/docs/file/tasks/', heading: '`tasks`', name: 'Tasks', title: 'The team file: tasks — team', summary: 'The team\'s one task source — a file the owner committed, or a tracker behind the owner\'s broker — and the policy that decides what crosses.' },
  { path: '/docs/file/seats/', heading: '`seats`', name: 'Seats', title: 'The team file: seats — team', summary: 'Each seat\'s model and launch, its label and the pane\'s two lines, and the effort word its lab allows.' },
  { path: '/docs/file/delivery-order/', heading: '`delivery_order`', name: 'Delivery order', title: 'The team file: delivery order — team', summary: 'The legs a send to a seat walks — native, mcp-inbox, typed — and how each level of the chain may drop or reorder them, never add one.' },
  { path: '/docs/file/grant/', heading: '`grant`', name: 'Grant', title: 'The team file: grant — team', summary: 'The one grant the owner gives the orchestrator\'s seat, its closed scope, and what each act in it admits.' },
  { path: '/docs/file/delegates/', heading: '`delegates`', name: 'Delegates', title: 'The team file: delegates — team', summary: 'Panes outside the team\'s session that may run some operational commands, and the allowlist guard on a delegated approval.' },
  { path: '/docs/file/tempo/', heading: 'tempo', name: 'Tempo', title: 'The team file: tempo — team', summary: 'Relaxed, normal or urgent: the word that scales the watch\'s idle and nudge waits, and when it takes effect.' },
];

/** /docs/file/ — the team file: the sections in the reference's own words, and the format by example. */
export function teamFile(): Rendered {
  const format = section(README, "The file's format");
  const bullets = ['`session` names', '`in_project` names', '`coordinator` and `operator`', '`identity.signature`', '`seats[*].cli`', '`launch` is the plain command', '`workspace.mode` is']
    .map(startsWith => bullet(format, startsWith)).join('\n');
  const cards = FILE_SECTIONS.map(card =>
    `<a class="doc-entry" href="${card.path}"><span class="doc-entry__name">${escapeHtml(card.name)}</span><span class="doc-entry__summary">${escapeHtml(card.summary)}</span></a>`,
  ).join('');
  return new Doc()
    .h1('The team file')
    .md(paragraph(TEAM_FILE_DOC, '`team` reads one team file per clone'))
    .heading('The sections')
    .raw(`<div class="doc-grid">${cards}</div>\n`)
    .heading('The format, by example')
    .md(paragraph(README, 'A documented subset of YAML'))
    .block(fenceWith(format, 'yaml', 'format: 1'))
    .md(bullets)
    .heading('budgets')
    .md(paragraph(README, '`budgets` is the owner\'s'))
    .md(paragraph(README, '`examples/checks/codex-quota` is a check'))
    .block(fenceWith(format, 'yaml', 'openai:'))
    .heading('More fields')
    .md(paragraph(README, 'More fields exist'))
    .render();
}

/** One section of docs/team-file.md as its own page, in the reference's own words. */
export function fileSectionPage(card: typeof FILE_SECTIONS[number]): Rendered {
  return new Doc()
    .h1(card.name)
    .note(`Part of <a href="/docs/file/">the team file</a> — ${escapeHtml(card.summary)}`)
    .md(section(TEAM_FILE_DOC, card.heading))
    .render();
}

/**
 * The delivery order's own page. Its seat-level example is a fence indented inside a
 * bullet, and a fence of the reference is one at the page's own margin: the section is
 * shown as its prose, its top-level example and its rules, without that one nested
 * block, rather than have a half-read fence reach the page as prose.
 */
export function deliveryOrderPage(): Rendered {
  const whole = section(TEAM_FILE_DOC, '`delivery_order`');
  const card = FILE_SECTIONS.find(entry => entry.path === '/docs/file/delivery-order/')!;
  const rules = [
    bullet(whole, 'The word is one or more of'),
    bullet(whole, 'The receiving seat\'s chain is read outermost first'),
    bullet(whole, 'What a walk does with each leg'),
  ].join('\n');
  return new Doc()
    .h1(card.name)
    .note(`Part of <a href="/docs/file/">the team file</a> — ${escapeHtml(card.summary)}`)
    .md(paragraph(whole, 'The order a send to this team\'s seats walks'))
    .block(fenceWith(whole, 'yaml', 'delivery_order: [typed]'))
    .md(rules)
    .render();
}

/** /docs/concepts/registry/ — the three records, as docs/concepts/registry.md documents them. */
export function registryPage(): Rendered {
  return new Doc().md(registry()).render();
}

/** The registry page's own markdown, with anything private kept off the site. */
function registry(): string {
  return withoutDevMode(withoutInternal(REGISTRY_DOC));
}

/**
 * A command's who line for its card: the README's table row where it has one, and
 * otherwise the page's own "Who may run it" — the first table row's caller, or the
 * section's first sentence. A command whose page carries neither keeps an empty line.
 */
function whoFor(name: string, row: ReturnType<typeof commandTable>[number] | undefined): string {
  if (row) return row.who;
  const page = commandPage(name);
  if (!page.includes('## Who may run it')) return '';
  const who = section(page, 'Who may run it');
  const first = who.split('\n').filter(line => line.startsWith('|')).slice(2)[0];
  return first?.split('|').slice(1, -1)[0]?.trim() || firstSentence(who);
}

/** /docs/commands/ — the command reference's index: every page, its first sentence and its caller. */
export function commandIndex(): Rendered {
  const rows = commandTable();
  const cards = commandNames().map(name => {
    const row = rows.find(entry => entry.name === name);
    return `<a class="doc-entry" href="/docs/commands/${name}/"><span class="doc-entry__name"><code>team ${name}</code></span>` +
      `<span class="doc-entry__summary">${inline(firstSentence(summaryOf(name)))}</span>` +
      `<span class="doc-entry__who">${inline(whoFor(name, row))}</span></a>`;
  });
  return new Doc().h1('Commands').md(paragraph(README, 'Each command has its own page')).raw(`<div class="doc-grid">${cards.join('')}</div>\n`).render();
}

/**
 * The pointer to a command's private docs page, which the site never names or links.
 * Only some compact command pages carry it; one that still links anywhere under
 * `docs/internal` after the strip stops the build.
 */
export function withoutInternal(markdown: string): string {
  const stripped = markdown.replace(/\n*Rationale, behaviour, refusals and known limits: \[docs\/internal\/[a-z-]+\.md\]\(\.\.\/internal\/[a-z-]+\.md\)\.\s*$/g, '\n');
  if (/docs\/internal|\.\.\/internal\//.test(stripped)) throw new ReferenceError('a reference page still links to the private docs');
  return stripped;
}

/**
 * A sentence about the development-mode variable, which the public docs do not carry:
 * it is not a caller the site documents. One that still names the variable after the
 * strip stops the build.
 */
export function withoutDevMode(markdown: string): string {
  const stripped = markdown.replace(/\s*With `TEAMCLI_DEV_MODE=1`[^.!?]*[.!?]/g, '');
  if (stripped.includes('TEAMCLI_DEV_MODE')) throw new ReferenceError('a reference page still names the development-mode variable');
  return stripped;
}

/** One command's page, with the fixture fences left out: the world is the test's, not the reader's. */
export function commandPageContent(name: string): Rendered {
  return renderMarkdown(withoutDevMode(withoutInternal(commandPage(name))), { skip: fence => fence.lang === 'fixture' });
}

// ---------------------------------------------------------------- safety and CLIs

/**
 * /docs/safety/ — the safety model in plain words, each claim a piece of the reference.
 *
 * "Nothing writes a lab's config or an `AGENTS.md`" is the reference's sentence about
 * what team does, and its Cursor paragraph is the one that says what a launch still
 * writes: Cursor's own project record. The claim and that sentence travel together here,
 * as docs:check holds them to, so the page never promises more than the reference does.
 */
export function safety(): Rendered {
  const up = commandPage('up');
  const watch = commandPage('watch');
  const grant = paragraph(section(TEAM_FILE_DOC, '`grant`'), 'Records the grant the owner gives the orchestrator\'s seat');
  const delegates = paragraph(section(TEAM_FILE_DOC, '`delegates`'), 'Names panes outside the team\'s session');
  const never = [
    sentence(README, 'Nothing writes a lab\'s config'),
    sentence(README, 'It never answers prompts'),
    sentence(README, 'A file you receive from someone else'),
    sentence(README, '`up`, `down` and `add` take `--dry-run`'),
  ];
  return new Doc()
    .h1('Safety')
    .heading('The owner')
    .md(paragraph(README, 'The owner is a terminal outside herdr'))
    .md(section(up, 'Who may run it'))
    .heading('The live file is the record')
    .md(section(README, 'The live file is the record'))
    .heading('The file is private to each clone')
    .md(section(README, 'The file is private to each clone'))
    .heading('Grants and delegates, the owner\'s alone')
    .md(grant)
    .md(delegates)
    .heading('What team never does')
    .md(never.map(text => `- ${text}`).join('\n'))
    .note(inline(sentence(README, 'Launching a Cursor seat')))
    .note(inline(sentence(watch, 'A screen hatch is an escape hatch')))
    .heading('Who may run what')
    .table('Who may run each command', ['Command', 'Who may run it'], commandTable().map(row => [`<code>team ${row.name}</code>`, inline(row.who)]))
    .heading('What this version builds')
    .md(paragraph(README, '**Status: early'))
    .md(paragraph(README, '`team up`, `team down`'))
    .render();
}

/** The four profiles the reference names, and the sign-in check it gives each. */
const PROFILES: { cli: string; check: string }[] = [
  { cli: 'claude-code', check: 'claude auth status' },
  { cli: 'codex', check: 'codex login status' },
  { cli: 'cursor', check: 'cursor-agent status' },
  { cli: 'antigravity', check: 'agy models' },
];

/** /docs/clis/ — what `team` knows of each CLI, from the reference. */
export function clis(): Rendered {
  const doctor = commandPage('doctor');
  const login = paragraph(README, '`team doctor --login` checks read-only');
  for (const profile of PROFILES) {
    if (!login.includes(profile.check)) throw new ReferenceError(`the login paragraph no longer names "${profile.check}"`);
  }
  return new Doc()
    .h1('Supported CLIs')
    .md(bullet(section(README, "The file's format"), '`seats[*].cli`'))
    .table('The CLIs and their sign-in checks', ['CLI', 'Sign-in check'], PROFILES.map(profile => [`<code>${profile.cli}</code>`, `<code>${profile.check}</code>`]))
    .md(login)
    .block(fenceWith(doctor, 'console', 'team doctor --login'))
    .heading('Codex')
    .md(paragraph(README, 'The Codex profile is tested with CLI 0.157.0'))
    .heading('Antigravity')
    .md(paragraph(README, 'The Antigravity profile is tested with CLI 1.2.16'))
    .heading('Cursor')
    .md(paragraph(README, 'Launching a Cursor seat'))
    .render();
}

// ---------------------------------------------------------------- the site's own list

export interface NavGroup { label: string; items: { name: string; href: string }[] }
export interface PageMeta extends Rendered {
  path: string; title: string; description: string; priority: string; section: string; nav: NavGroup[]; files: string[];
}

export const nav: NavGroup[] = [
  {
    label: 'Documentation',
    items: [
      { name: 'Getting started', href: '/docs/' },
      { name: 'The team file', href: '/docs/file/' },
      { name: 'The registries', href: '/docs/concepts/registry/' },
      { name: 'Safety', href: '/docs/safety/' },
      { name: 'Supported CLIs', href: '/docs/clis/' },
    ],
  },
  {
    label: 'Commands',
    items: [{ name: 'Overview', href: '/docs/commands/' }, ...commandNames().map(name => ({ name: `team ${name}`, href: `/docs/commands/${name}/` }))],
  },
];
/** The reading order, for the previous and next links under a page. */
export const readingOrder = nav.flatMap(group => group.items);

/** The page list: every public page, its content, and the sources its lastmod is read from. */
export function pages(): PageMeta[] {
  const page = (path: string, title: string, priority: string, content: Rendered, files: string[]): PageMeta =>
    ({ path, title, description: descriptionFor(path), priority, section: 'Documentation', nav, files, ...content });
  const group = [
    page('/docs/', 'Getting started — team', '0.9', gettingStarted(), ['src/server/pages.ts']),
    page('/docs/file/', 'The team file — team', '0.8', teamFile(), ['src/server/pages.ts']),
    ...FILE_SECTIONS.map(card => page(card.path, card.title, '0.6', card.path === '/docs/file/delivery-order/' ? deliveryOrderPage() : fileSectionPage(card), ['src/server/pages.ts'])),
    page('/docs/concepts/registry/', 'The agent, team and project registries — team', '0.7', registryPage(), ['src/server/pages.ts']),
    page('/docs/commands/', 'Commands — team', '0.9', commandIndex(), ['src/server/pages.ts']),
    page('/docs/safety/', 'Safety — team', '0.7', safety(), ['src/server/pages.ts']),
    page('/docs/clis/', 'Supported CLIs — team', '0.7', clis(), ['src/server/pages.ts']),
  ];
  // Every command is the one page the reference gives it, in the table's order.
  const commands = commandNames().map(name =>
    page(`/docs/commands/${name}/`, `team ${name} — team`, '0.8', commandPageContent(name), [`content/team/docs/commands/${name}.md`]));
  return [...group, ...commands];
}

/**
 * A command page's description: the site's own words, because a page's first sentence
 * runs past what a search result shows. The page's body is the reference; this is the
 * signpost to it. docs:check holds each to one line of at most 160 characters.
 */
const DESCRIPTIONS: Record<string, string> = {
  init: 'Writes the team file: a skeleton for this project, or the copy you last approved, kept out of git.',
  commits: 'Checks a commit, or a range of commits, against the signature rule and forbidden patterns; exit 1 when a commit is refused.',
  pr: 'Checks a pull request body against the signature rule and forbidden patterns, needing no repository; exit 1 when refused.',
  doctor: 'What this machine still needs: herdr, each CLI, its version and login, each launch’s model, and the watch.',
  status: 'The team as it stands: one line per seat, every difference between the file, the state and the live session, and each repair.',
  list: 'The herdr sessions on this machine, the running ones by default; --all includes stopped sessions, and nothing is changed.',
  projects: 'The projects this machine’s registry holds: each immutable id, display name, entity, lead by agent id and teams; --json prints them.',
  up: 'Starts the session, a workspace and each seat the file declares, plus the watch; --dry-run prints the plan and the refusals.',
  down: 'Stops the team: asks every free seat to exit, closes its workspace, stops the watch, and stops the session.',
  hold: 'A note on the team’s work — why, who and until when — kept in the state, printed first by team status and last by team doctor.',
  watch: 'Watches a running team: reports idle seats and nudges the operator, in one fixed line, into an empty idle prompt only.',
  tempo: 'Sets the team’s tempo to relaxed, normal or urgent, which scales the watch’s idle and nudge waits; normal is the key left out.',
  messages: 'Verifies a message that is already waiting, prints its body and writes the receipt; no command writes a message record.',
  send: 'Writes one message to one seat: the body in a 0600 drop file, one trigger line, and the seat’s delivery order deciding the channel.',
  issues: 'Lists the typed records in the one file the team names: file order, priorities shown and not reordering, nothing claimed.',
  next: 'Claims one record from the team’s one task source, with a lease in this clone; the source is a file the owner committed or a broker’s read.',
  plan: 'Prints the queue a claim would consider, in the order team next would consider it; it claims nothing and writes no lease.',
  broker: 'Holds the tracker credential and answers team next over a local socket, filtering every record through the file’s tasks.policy.',
  add: 'Starts one declared seat, or a temporary one beside the team with --temporary --like <seat> --until <result:path|merged:branch>.',
  register: 'Writes the record for a seat that is already running, so team send, team seats, team watch and team down can address it; types nothing.',
  answer: 'Presses the one recorded key of a seat’s folder-trust dialog when the file allows it; every check has to pass, and anything else sends nothing.',
  release: 'Checks a release on npm and GitHub. When the file has the pairs: Linear milestone, qualifying status update, and the release marker in the public activity file.',
  remove: 'Stops one seat and takes it out of the file; --keep leaves it stopped; --abandon is the owner’s, and types nothing.',
  worktree: 'Creates a task worktree from an up-to-date base, or removes one; the branch is never deleted.',
  'ask-show': 'Prints the question a signed ask carries, once the marker’s HMAC and its expiry check out; a marker that does not verify prints nothing.',
  check: 'One answer to one question: is anything wrong with this team that someone should act on? It reads and reports; it grants nothing.',
  delegate: 'Adds or replaces one external delegate in the current team file; replacing an entry sets its complete command list, and other entries keep theirs.',
  feed: 'Reads and follows the project’s message history: the JSONL file, the briefs and Desk audit lines beside it, and the deliveries team send wrote.',
  grant: 'Writes an authority record: the file’s one grant by --scope, or a standing owner-signed --capabilities record naming the grantee by registry id.',
  lock: 'Takes a named lock on this machine so one heavy run holds it at a time; the take is one mkdir, and a second caller is refused.',
  mcp: 'Reads the MCP bridge’s local state — the helper, every lobby config, the seat guards and the public front — and reports it without changing a thing.',
  proc: 'The processes a team’s seats started, kept as a register in the team’s state: one record per name, with its seat, time, pid and note.',
  reload: 'Closes one running seat and launches it again when the file’s model, version or effort differs from the seat’s last launch.',
  restart: 'Restarts one declared seat in place, without editing the team file; a busy seat is left as it is unless --abandon is given.',
  revoke: 'Removes a grant or one external delegate from the team file, or ends a standing grant; an absent target is a successful no-op.',
  route: 'Answers one seat’s address for the native channel, and records that it handed the address out; the CLI delivers nothing itself.',
  seats: 'The seat registry for the team: each seat’s stable seat handle, role, CLI, model, effort, status, state, last active time and pane.',
  unlock: 'Releases a lock team lock took, and only that caller’s: the holder file has to name the same project and by line; anyone else is refused.',
  usage: 'What this machine holds: every team with an approval store here, its accounts and windows, what is left and used, and when each figure was read.',
};
const SITE_PAGES: Record<string, string> = {
  '/privacy/': 'How teamcli.io reaches you, and what stays in your browser.',
  '/docs/': 'Your first team in five minutes: install team, write .agents/team.yaml, and start the session from the owner’s terminal.',
  '/docs/file/': 'The team file, section by section: tasks, seats, delivery order, grant, delegates and tempo — then the format by example and its other fields.',
  '/docs/file/tasks/': 'The team file’s tasks section: one task source, the policy that decides which fields cross a broker, and the pull, fallback and cadence rules.',
  '/docs/file/seats/': 'The team file’s seats section: each seat’s model and launch, its label and the pane’s two lines, and the effort word its lab allows.',
  '/docs/file/delivery-order/': 'The team file’s delivery order: the legs a send walks, and how each level of the chain may drop or reorder them but never add one.',
  '/docs/file/grant/': 'The team file’s grant: the one authority record the owner gives the orchestrator’s seat, its closed scope, and what each act admits.',
  '/docs/file/delegates/': 'The team file’s delegates: panes outside the session that may run some commands, the allowlist guard, and the placement that is an accident guard.',
  '/docs/file/tempo/': 'The team file’s tempo: relaxed, normal or urgent — which waits the word scales, and when it takes effect.',
  '/docs/concepts/registry/': 'The agent, team and project records this machine keeps: what each field means, and why an id is the identity.',
  '/docs/commands/': 'Every command of team: what each reads and writes, who may run it, its refusals, its exit codes and its examples.',
  '/docs/safety/': 'Why team is safe to run: the owner outside herdr, the live file as the record, grants and delegates the owner alone, and what team never does.',
  '/docs/clis/': 'What team knows of claude-code, codex, cursor and antigravity: the launch profile, the sign-in check, and what it never writes.',
};

/** A description from the map above; a page that has none is a mistake, not a default. */
export function descriptionFor(path: string): string {
  const description = path === '/'
    ? 'Set up and run a team of specialized AI agents in herdr: you set the roster, agents do the work, and you decide.'
    : path.startsWith('/docs/commands/') && path !== '/docs/commands/'
    ? DESCRIPTIONS[path.slice('/docs/commands/'.length, -1)]
    : SITE_PAGES[path];
  if (!description) throw new ReferenceError(`no description for ${path}`);
  return description;
}
