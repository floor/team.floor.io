// Every page of the site, assembled from the reference at TEAM_REF.
//
// Nothing here retypes what the reference says. A page is built from named pieces of the
// README and the command pages — a section, a paragraph, a bullet, a sentence, a table
// row, a fenced block — and reference.ts throws when the reference no longer has one. So
// a ref that moved fails loudly here, in `bun test` and in docs:check, instead of quietly
// shipping a page that says something the package no longer does.
import { bullet, commandNames, commandPage, commandTable, fenceByInfo, fenceWith, fromBlock, paragraph, section, sentence, README, ReferenceError } from './reference';
import { escapeHtml, fenceHtml, renderMarkdown, slug, type Fence, type Rendered } from './markdown';
import { contentReady, packageVersion, read, refInfo } from './team';

if (!contentReady()) throw new Error('content/team is missing: run `bun run content` (scripts/content.ts) first.');

export const info = refInfo();

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

/** The package's first line: the paragraph under the README's title. */
export function packageLead(): string {
  const body = README.replace(/^#[^\n]*\n+/, '');
  const opening = (body.split(/\r?\n\s*\r?\n/)[0] ?? '').replace(/\s+/g, ' ').trim();
  if (!opening || opening.startsWith('#')) throw new ReferenceError('the package has no opening line');
  return opening;
}

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
 * The home page's samples: the shortest team file the reference shows, and two
 * transcripts of the same project — the plan `team up --dry-run` prints, and what
 * `team status` reads back. Each is one whole fence of a tested page, so the home
 * page shows exactly what `bun test` runs.
 */
export function homeSamples(): Sample[] {
  const status = commandPage('status');
  const up = commandPage('up');
  return [
    { label: 'The file', caption: '.agents/team.yaml — the project\'s whole team', fence: fenceWith(status, 'yaml', 'project: beacon') },
    { label: 'The plan', caption: 'team up --dry-run — what a start would run, and what it would skip', fence: fenceWith(up, 'console', 'team up --dry-run') },
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

/** The top-level keys of the example file, and the README bullets that explain each. */
const FILE_PARTS: { title: string; keys: string[]; bullets: string[] }[] = [
  { title: 'The head', keys: ['format', 'project', 'coordinator', 'operator'], bullets: ['`coordinator` and `operator`', '`session` names'] },
  { title: 'identity', keys: ['identity'], bullets: ['`identity.signature`'] },
  { title: 'workspace', keys: ['workspace'], bullets: ['`workspace.mode`'] },
  { title: 'machine', keys: ['machine'], bullets: [] },
  { title: 'seats', keys: ['seats'], bullets: ['`seats[*].cli`', '`launch`'] },
];

/** One top-level part of the example file: from its first key to the line before the next. */
function examplePart(yaml: string, keys: string[]): string {
  const lines = yaml.split('\n');
  const start = lines.findIndex(line => line.startsWith(`${keys[0]}:`));
  if (start < 0) throw new ReferenceError(`the example file no longer has a "${keys[0]}:" section`);
  const rest = lines.slice(start);
  const next = rest.slice(1).findIndex(line => /^[a-z_]+:/.test(line));
  return (next < 0 ? rest : rest.slice(0, next + 1)).join('\n').trimEnd();
}

/** One top-level part of the watch example fence: from watch: to the line before the next top-level key. */
function watchPart(markdown: string): string {
  const fence = fenceWith(markdown, 'yaml', 'memory: off');
  const lines = fence.text.split('\n');
  const start = lines.findIndex(line => line.startsWith('watch:'));
  if (start < 0) throw new ReferenceError('the watch example fence no longer has a "watch:" section');
  const rest = lines.slice(start);
  const next = rest.slice(1).findIndex(line => /^[a-z_]+:/.test(line));
  return (next < 0 ? rest : rest.slice(0, next + 1)).join('\n').trimEnd();
}

/** /docs/file/ — the team file, section by section. */
export function teamFile(): Rendered {
  const format = section(README, "The file's format");
  const example = read('examples/team.yaml');
  const watch = commandPage('watch');
  const doc = new Doc().h1('The team file').md(paragraph(README, 'A documented subset of YAML')).block(fenceWith(format, 'yaml', 'format: 1'));
  for (const part of FILE_PARTS) {
    doc.heading(part.title);
    doc.block({ lang: 'yaml', info: 'file=examples/team.yaml', text: `${examplePart(example, part.keys)}\n`, line: 0, start: 0, end: 0 });
    for (const startsWith of part.bullets) doc.md(bullet(format, startsWith));
  }
  return doc
    .heading('watch')
    .md(paragraph(watch, "The watch's own timings"))
    .md(sentence(watch, "A check the team doesn't want"))
    .block({ lang: 'yaml', info: 'file=.agents/team.yaml', text: `${watchPart(watch)}\n`, line: 0, start: 0, end: 0 })
    .heading('budgets')
    .md(paragraph(README, '`budgets` is the owner\'s'))
    .md(paragraph(README, '`examples/checks/codex-quota` is a check'))
    .block(fenceWith(format, 'yaml', 'openai:'))
    .heading('More fields')
    .md(paragraph(README, 'More fields exist'))
    .render();
}

/** /docs/commands/ — the command reference's index: the README's table, as cards. */
export function commandIndex(): Rendered {
  const rows = commandTable();
  const cards = commandNames().map(name => {
    const row = rows.find(entry => entry.name === name);
    return `<a class="doc-entry" href="/docs/commands/${name}/"><span class="doc-entry__name"><code>team ${name}</code></span>` +
      `<span class="doc-entry__summary">${inline(firstSentence(summaryOf(name)))}</span>` +
      `<span class="doc-entry__who">${inline(row?.who ?? '')}</span></a>`;
  });
  return new Doc().h1('Commands').md(paragraph(README, 'Each command has its own page')).raw(`<div class="doc-grid">${cards.join('')}</div>\n`).render();
}

/** One command's page, with the fixture fences left out: the world is the test's, not the reader's. */
export function commandPageContent(name: string): Rendered {
  return renderMarkdown(commandPage(name), { skip: fence => fence.lang === 'fixture' });
}

// ------------------------------------------- the `up` reference, in pages

/**
 * `up` is the reference's longest page, and the one a reader acts on first. Its page
 * holds what fits a screen — the purpose, the synopsis, the flags, three examples, the
 * short behaviour — and the rest is split, whole and unretyped, into reference pages one
 * topic each. Together the six pages hold every fence of the reference page exactly once
 * (docs:check holds them to it), and each states its rule once, linked where it shows.
 */

/** The reference pages of `team up`, as cards: one line each, in the site's own words. */
const UP_REFERENCE: { path: string; name: string; summary: string }[] = [
  { path: '/docs/commands/up/launch/', name: 'The launch', summary: 'The stopped session, the lobby gate, and the folder each seat starts in.' },
  { path: '/docs/commands/up/records/', name: 'The records', summary: 'Every line a run prints — ready, left out — and what each line means.' },
  { path: '/docs/commands/up/waiting/', name: 'Waiting for the owner', summary: 'The pause at a dialog: the owner\'s o, s and q keys, and the waiting record.' },
  { path: '/docs/commands/up/limits/', name: 'Known limits', summary: 'The windows a same-user process still has: the waiting proof, the read-back, the folder chain.' },
  { path: '/docs/commands/up/refusals/', name: 'Refusals', summary: 'Every refusal before the first step: the owner and delegate gates, the approval, the lobby, the load.' },
];

/** The sources a `team up` page is read from — the reference page, and this assembly. */
const UP_FILES = ['content/team/docs/commands/up.md', 'src/server/pages.ts'];

/** A `team up` reference page's first line: where it belongs. */
function upPart(html: string): string {
  return `Part of <a href="/docs/commands/up/"><code>team up</code></a> — ${html}`;
}

/** /docs/commands/up/ — the command itself: purpose, synopsis, flags, the examples, and the short behaviour. */
export function upPage(): Rendered {
  const up = commandPage('up');
  const examples = section(up, 'Examples');
  return new Doc()
    .h1('team up')
    .md(paragraph(up, 'Starts the team:'))
    .md(section(up, 'Synopsis'))
    .heading('Flags')
    .md(section(up, 'Flags'))
    .heading('Examples')
    .note('The team file the examples read:')
    .block(fenceWith(up, 'yaml', 'project: beacon'))
    .md(paragraph(examples, 'Two seats are up and the third is stopped'))
    .block(fenceWith(up, 'console', 'team up --dry-run'))
    .md(paragraph(examples, 'The same command for real runs exactly that'))
    .block(fenceWith(up, 'console', 'watch: started'))
    .heading('Who may run it')
    .md(paragraph(section(up, 'Who may run it'), 'The owner, from a terminal outside herdr'))
    .note('The refusal ids a dry run returns, and the delegate gate, are on <a href="/docs/commands/up/refusals/">the refusals page</a>; the pause a dialog meets, on <a href="/docs/commands/up/waiting/">the waiting page</a>.')
    .heading('What it reads and writes')
    .md(section(up, 'What it reads and writes'))
    .note('The run-lock refusal that paragraph names is on <a href="/docs/commands/up/refusals/">the refusals page</a>.')
    .heading('What it prints')
    .md(fromBlock(section(up, 'What it prints'), 'One record per seat', 'A seat that reaches its idle prompt'))
    .md(paragraph(section(up, 'What it prints'), 'A seat that reaches its idle prompt'))
    .note('Every line a run can print, and what each means, is on <a href="/docs/commands/up/records/">the records page</a>.')
    .heading('Exit codes')
    .md(section(up, 'Exit codes'))
    .heading('Known issues')
    .md(section(up, 'Known issues'))
    .heading('The reference pages')
    .raw(`<div class="doc-grid">${UP_REFERENCE.map(card => `<a class="doc-entry" href="${card.path}"><span class="doc-entry__name">${escapeHtml(card.name)}</span><span class="doc-entry__summary">${escapeHtml(card.summary)}</span></a>`).join('')}</div>\n`)
    .render();
}

/** /docs/commands/up/launch/ — what a run does before it creates anything, and where each seat starts. */
export function upLaunch(): Rendered {
  const up = commandPage('up');
  return new Doc()
    .h1('The launch')
    .note(upPart('what a run does before it creates anything, and where each seat starts.'))
    .heading('A stopped session')
    .md(paragraph(up, 'A session stopped in herdr that this team'))
    .heading('The lobby gate')
    .md(paragraph(up, 'Every seat, shared and worktree-mode alike'))
    .heading('Where a seat starts')
    .md(paragraph(up, 'A seat goes to its real folder'))
    .heading('The stopped session, started')
    .md(paragraph(section(up, 'Examples'), 'A session stopped in herdr that this team'))
    .block(fenceByInfo(up, 'herdr=stopped'))
    .note('The earlier examples that paragraph names are on <a href="/docs/commands/up/">the team up page</a>.')
    .render();
}

/** /docs/commands/up/records/ — every line a run prints, and what each line means. */
export function upRecords(): Rendered {
  const up = commandPage('up');
  const prints = section(up, 'What it prints');
  return new Doc()
    .h1('The records')
    .note(upPart('every line a run prints, and what each line means.'))
    .heading('A seat already ready')
    .md(fromBlock(prints, 'A seat already ready is left as it is', 'A command run in a folder'))
    .heading('The file it reads, and the watch')
    .md(fromBlock(prints, 'A command run in a folder', 'A seat is its pane only while'))
    .heading('A stale pane')
    .md(fromBlock(prints, 'A seat is its pane only while', 'The reading that decides'))
    .heading('The close, and its proof')
    .md(fromBlock(prints, 'The reading that decides the repair', 'This comparison is wrong'))
    .heading('Wrong in the safe direction')
    .md(fromBlock(prints, 'This comparison is wrong', 'When the workspace does not close'))
    .heading('A workspace that does not close')
    .md(fromBlock(prints, 'When the workspace does not close', 'When the idle screen names no model'))
    .heading('A screen that names no model')
    .md(fromBlock(prints, 'When the idle screen names no model', 'A seat whose rules travel'))
    .heading('Rules as a first message')
    .md(fromBlock(prints, 'A seat whose rules travel as a first message', 'Waiting for the owner'))
    .heading('A seat that does not get there')
    .md(fromBlock(prints, "A seat that doesn't get there", 'The records are what stdout gets'))
    .note('The pause that paragraph\'s <em>above</em> names is on <a href="/docs/commands/up/waiting/">the waiting page</a>.')
    .heading('Every line, and its meaning')
    .note('Rows that name <em>the pause, above</em>, <em>the same proof as every close above</em>, or an agent <code>team</code> cannot name <em>(above)</em> mean the waiting page\'s own: the pause, the close it proves, and the owner\'s by-hand answer.')
    .md(fromBlock(prints, 'The records are what stdout gets', 'A `version: "0"`'))
    .heading('The version placeholder')
    .md(fromBlock(prints, 'A `version: "0"`', '`<account>` in these lines'))
    .heading('The account in a line')
    .md(fromBlock(prints, '`<account>` in these lines', 'A launch line the check'))
    .heading('Notes on a launch line')
    .md(fromBlock(prints, 'A launch line the check', 'The plan a `--dry-run` prints'))
    .heading('The dry-run plan')
    .md(fromBlock(prints, 'The plan a `--dry-run` prints'))
    .render();
}

/** /docs/commands/up/waiting/ — the pause a seat at a dialog meets, and the owner's answer to it. */
export function upWaiting(): Rendered {
  const up = commandPage('up');
  return new Doc()
    .h1('Waiting for the owner')
    .note(upPart('the pause a seat at a dialog meets, and the owner\'s answer to it.'))
    .md(paragraph(up, 'The lobby is a folder no CLI has seen before'))
    .md(section(section(up, 'What it prints'), 'Waiting for the owner', 3))
    .render();
}

/** /docs/commands/up/limits/ — the windows a process of the same user still has. */
export function upLimits(): Rendered {
  const up = commandPage('up');
  return new Doc()
    .h1('Known limits')
    .note(upPart('the windows a process of the same user still has. The checks the bullets name are on <a href="/docs/commands/up/waiting/">the waiting page</a> and <a href="/docs/commands/up/records/">the records page</a>.'))
    .md(fromBlock(section(up, 'What it prints'), '- The waiting proof is placement', "A seat that doesn't get there"))
    .render();
}

/** /docs/commands/up/refusals/ — what stops a run before its first step, and who may start one. */
export function upRefusals(): Rendered {
  const up = commandPage('up');
  const who = section(up, 'Who may run it');
  const examples = section(up, 'Examples');
  return new Doc()
    .h1('Refusals')
    .note(upPart('what stops a run before its first step, and who may start one.'))
    .heading('What a dry run returns')
    .md(fromBlock(who, '- `up.no-launch`', 'A pane of another session'))
    .heading('The delegate gate')
    .md(fromBlock(who, 'A pane of another session'))
    .note('The ordinary rule that paragraph names — only the owner, from a terminal outside herdr — is on <a href="/docs/commands/up/">the team up page</a>.')
    .heading('A seat is not the owner')
    .md(paragraph(examples, 'A seat is not the owner'))
    .block(fenceWith(up, 'console', 'this call is claude-beacon'))
    .heading('Every refusal')
    .note('The <em>MISS</em> row\'s <em>in the lines above</em> means the line table on <a href="/docs/commands/up/records/">the records page</a>.')
    .md(section(up, 'Refusals'))
    .heading('An approval that drifted')
    .md(paragraph(examples, 'An owner section changed in the file'))
    .block(fenceWith(up, 'yaml', 'limits:'))
    .block(fenceWith(up, 'console', '! up would refuse'))
    .md(paragraph(examples, 'The real run goes no further than the refusal'))
    .block(fenceWith(up, 'console', 'team up: the file is not the approved one'))
    .render();
}

// ------------------------------------------- the `watch` reference, in pages

/**
 * `watch` is the reference's fourth-longest command page (529 md lines at team 0.3.5).
 * Its hub holds what fits a screen — the purpose, the synopsis, the flags, the base
 * example, who may run it, what it reads and writes, the short lead of what it prints,
 * the refusals and the exit codes — and the rest is split, whole and unretyped, into
 * reference pages one topic each, by the page's own sections: the reports, the nudge,
 * how a screen is read, budgets, and the approved checks and timings. Together the six
 * pages hold every fence of the reference page exactly once (docs:check holds them to
 * it), and each states its rule once.
 */

/** The reference pages of `team watch`, as cards: one line each, in the site's own words. */
const WATCH_REFERENCE: { path: string; name: string; summary: string }[] = [
  { path: '/docs/commands/watch/reports/', name: 'The reports', summary: 'Every line a pass can print and when each is made — the seat, approval, machine and account reports — and what the log holds beyond them.' },
  { path: '/docs/commands/watch/nudge/', name: 'The nudge', summary: 'The one fixed line the watch types into the operator\'s pane, the lines around it, and --no-nudge.' },
  { path: '/docs/commands/watch/screens/', name: 'How a screen is read', summary: 'The idle frame that tells a prompt from a dialog, a question or a vendor notice, and the live-agent check.' },
  { path: '/docs/commands/watch/budgets/', name: 'Budgets', summary: 'The figures a pass reads off the seats and the check commands, and when a mark, a reserve or a floor is reported.' },
  { path: '/docs/commands/watch/checks/', name: 'Checks and timings', summary: 'The checks and timings the owner approves, and what a pass reports while an edit to the file is still unapproved.' },
];

/** The sources a `team watch` page is read from — the reference page, and this assembly. */
const WATCH_FILES = ['content/team/docs/commands/watch.md', 'src/server/pages.ts'];

/** A `team watch` reference page's first line: where it belongs. */
function watchRefPart(html: string): string {
  return `Part of <a href="/docs/commands/watch/"><code>team watch</code></a> — ${html}`;
}

/** /docs/commands/watch/ — the command itself: purpose, synopsis, flags, the base example, and the short behaviour. */
export function watchPage(): Rendered {
  const watch = commandPage('watch');
  const examples = section(watch, 'Examples');
  const prints = section(watch, 'What it prints');
  return new Doc()
    .h1('team watch')
    .md(paragraph(watch, 'Watches a running team'))
    .md(section(watch, 'Synopsis'))
    .heading('Flags')
    .md(section(watch, 'Flags'))
    .heading('Examples')
    .note('The team file the examples read:')
    .block(fenceWith(watch, 'yaml', 'project: beacon'))
    .md(paragraph(examples, 'Two seats at their prompts'))
    .block(fenceWith(watch, 'console', 'every 120s'))
    .heading('Who may run it')
    .md(section(watch, 'Who may run it'))
    .heading('What it reads and writes')
    .md(section(watch, 'What it reads and writes'))
    .heading('What it prints')
    .md(fromBlock(prints, 'Every line carries its time', 'A report is printed'))
    .note('Every report a pass can print, and when each is made, is on <a href="/docs/commands/watch/reports/">the reports page</a>; the nudge the operator\'s reports stand for, on <a href="/docs/commands/watch/nudge/">the nudge page</a>.')
    .heading('Refusals')
    .md(section(watch, 'Refusals'))
    .md(paragraph(examples, '`up` leaves a watch running'))
    .block(fenceWith(watch, 'console', 'a watch already runs for the session'))
    .heading('Exit codes')
    .md(section(watch, 'Exit codes'))
    .heading('The reference pages')
    .raw(`<div class="doc-grid">${WATCH_REFERENCE.map(card => `<a class="doc-entry" href="${card.path}"><span class="doc-entry__name">${escapeHtml(card.name)}</span><span class="doc-entry__summary">${escapeHtml(card.summary)}</span></a>`).join('')}</div>\n`)
    .render();
}

/** /docs/commands/watch/reports/ — every line a pass can print, and when each is made. */
export function watchReports(): Rendered {
  const watch = commandPage('watch');
  const prints = section(watch, 'What it prints');
  const examples = section(watch, 'Examples');
  return new Doc()
    .h1('The reports')
    .note(watchRefPart('every line a pass can print, and when each is made.'))
    .md(fromBlock(prints, 'A report is printed when it starts', 'Each report is addressed'))
    .md(paragraph(prints, 'Each report is addressed to the owner or to the operator'))
    .note('What the nudge stands for, and the lines around it, is on <a href="/docs/commands/watch/nudge/">the nudge page</a>.')
    .heading('A report for the owner')
    .md(paragraph(examples, 'A permission prompt is the owner'))
    .block(fenceWith(watch, 'console', 'waits at a permission prompt'))
    .heading('A machine report')
    .md(paragraph(examples, 'The machine is watched the same way'))
    .block(fenceWith(watch, 'console', 'free memory is 8%, below 15%'))
    .render();
}

/** /docs/commands/watch/nudge/ — the one fixed line the watch types into the operator's pane. */
export function watchNudge(): Rendered {
  const watch = commandPage('watch');
  const prints = section(watch, 'What it prints');
  const examples = section(watch, 'Examples');
  return new Doc()
    .h1('The nudge')
    .note(watchRefPart('the one fixed line the operator reads, and when the watch types it.'))
    .md(paragraph(prints, 'A report that is the operator\'s to act on is also what the nudge stands for'))
    .md(fromBlock(prints, '| Line | Made when |'))
    .heading('A question nudges the operator')
    .md(paragraph(examples, 'A question is the operator'))
    .block(fenceWith(watch, 'console', 'claude-beacon asked a question'))
    .heading('--no-nudge keeps the reports')
    .md(paragraph(examples, '`--no-nudge` keeps the reports'))
    .block(fenceWith(watch, 'console', 'nudge not typed (--no-nudge)'))
    .render();
}

/** /docs/commands/watch/screens/ — how a pane's screen is read. */
export function watchScreens(): Rendered {
  const watch = commandPage('watch');
  return new Doc()
    .h1('How a screen is read')
    .note(watchRefPart('the reading that tells an idle prompt from a dialog, a question or a vendor notice.'))
    .md(section(watch, 'How a screen is read'))
    .render();
}

/** /docs/commands/watch/budgets/ — the figures a pass reads, and when a mark or reserve is reported. */
export function watchBudgets(): Rendered {
  const watch = commandPage('watch');
  return new Doc()
    .h1('Budgets')
    .note(watchRefPart('the figures a pass reads off the seats and the check commands, and when a mark or a reserve is reported.'))
    .md(section(watch, 'Budgets'))
    .render();
}

/** /docs/commands/watch/checks/ — the checks and timings the owner approves, and the drift a pass reports. */
export function watchChecks(): Rendered {
  const watch = commandPage('watch');
  const examples = section(watch, 'Examples');
  return new Doc()
    .h1('The approved checks and timings')
    .note(watchRefPart('the checks and timings the owner approves, and what a pass reports while an edit is unapproved.'))
    .heading('A file that no longer validates')
    .md(paragraph(examples, 'A file that no longer validates'))
    .block(fenceWith(watch, 'yaml', 'seats: ['))
    .block(fenceWith(watch, 'console', 'team.yaml is invalid'))
    .heading('An approval that drifted')
    .md(paragraph(examples, 'The file is part of the same pass'))
    .block(fenceWith(watch, 'yaml', '~/Code/other'))
    .block(fenceWith(watch, 'console', 'differs from the approved one: `trust`'))
    .heading('The timings')
    .md(paragraph(examples, 'The watch\'s own timings are the owner'))
    .heading('Turning a check off')
    .md(paragraph(examples, 'A check the team doesn\'t want'))
    .block(fenceWith(watch, 'yaml', 'memory: off'))
    .block(fenceWith(watch, 'console', 'differs from the approved one: `watch.checks`'))
    .md(paragraph(examples, 'The owner approves it, and the next pass runs without'))
    .block(fenceWith(watch, 'console', 'Ceilings this approval fixes'))
    .block(fenceWith(watch, 'console', 'every 120s'))
    .heading('Checks that cannot be turned off')
    .md(paragraph(examples, 'The four that can\'t be turned off'))
    .block(fenceWith(watch, 'yaml', 'disks: off'))
    .block(fenceWith(watch, 'console', 'watch.checks can\'t turn off attention'))
    .render();
}

// ------------------------------------------- the `doctor` reference, in pages

/**
 * `doctor` is the reference's longest command page, and the one that reads the whole
 * machine. Its hub holds what fits a screen — the purpose, the synopsis, the flags, the
 * base example, who may run it, what it reads and writes, the short lead of what it
 * prints, the refusals and the exit codes — and the rest is split, whole and unretyped,
 * into reference pages one topic each. Together the six pages hold every fence of the
 * reference page exactly once (docs:check holds them to it), and each states its rule
 * once, linked where it shows.
 */

/** The reference pages of `team doctor`, as cards: one line each, in the site's own words. */
const DOCTOR_REFERENCE: { path: string; name: string; summary: string }[] = [
  { path: '/docs/commands/doctor/report/', name: 'The report', summary: 'Every finding a run prints, in order — the file warnings, the approval, the seats, the watch — with the trust block and the key fingerprint.' },
  { path: '/docs/commands/doctor/models/', name: 'Models and launches', summary: 'A launch that names no model, names another, or defers to its launcher, and the version "0" placeholder.' },
  { path: '/docs/commands/doctor/clis/', name: 'Each CLI', summary: 'herdr and each seat\'s CLI: its version, whether it is installed, and a CLI outside the tested range.' },
  { path: '/docs/commands/doctor/login/', name: 'The sign-in checks', summary: 'team doctor --login: one read-only login check per CLI the seats use, and nothing else.' },
  { path: '/docs/commands/doctor/budgets/', name: 'The budget checks', summary: 'The owner\'s approved checks, run as the watch runs them, and what a non-owner caller or a changed check reads.' },
];

/** The sources a `team doctor` page is read from — the reference page, and this assembly. */
const DOCTOR_FILES = ['content/team/docs/commands/doctor.md', 'src/server/pages.ts'];

/** A `team doctor` reference page's first line: where it belongs. */
function doctorPart(html: string): string {
  return `Part of <a href="/docs/commands/doctor/"><code>team doctor</code></a> — ${html}`;
}

/** /docs/commands/doctor/ — the command itself: purpose, synopsis, flags, the base example, and the short behaviour. */
export function doctorPage(): Rendered {
  const doctor = commandPage('doctor');
  const examples = section(doctor, 'Examples');
  const prints = section(doctor, 'What it prints');
  return new Doc()
    .h1('team doctor')
    .md(paragraph(doctor, 'Reads the machine and says what the team needs'))
    .md(section(doctor, 'Synopsis'))
    .heading('Flags')
    .md(section(doctor, 'Flags'))
    .heading('Examples')
    .note('The team file the examples read:')
    .block(fenceWith(doctor, 'yaml', 'project: beacon'))
    .md(paragraph(examples, 'The account\'s check is a script'))
    .block(fenceWith(doctor, 'file', 'weekly 40% used'))
    .md(paragraph(examples, 'Everything here is as it should be'))
    .block(fenceWith(doctor, 'console', 'nothing missing, 2 warnings'))
    .md(paragraph(examples, 'The lobby line is the same closed-tree check'))
    .block(fenceWith(doctor, 'console', 'lobby ~/.config/team/lobby: verified'))
    .heading('Who may run it')
    .md(section(doctor, 'Who may run it'))
    .heading('What it reads and writes')
    .md(section(doctor, 'What it reads and writes'))
    .heading('What it prints')
    .md(fromBlock(prints, 'One line per finding', 'The findings come in order'))
    .note('Every finding a run prints, in the order they come, is on <a href="/docs/commands/doctor/report/">the report page</a>.')
    .heading('Refusals')
    .md(section(doctor, 'Refusals'))
    .md(paragraph(examples, 'An option it doesn\'t know stops it before it reads anything'))
    .block(fenceWith(doctor, 'console', 'unknown option --nope'))
    .heading('Exit codes')
    .md(section(doctor, 'Exit codes'))
    .heading('The reference pages')
    .raw(`<div class="doc-grid">${DOCTOR_REFERENCE.map(card => `<a class="doc-entry" href="${card.path}"><span class="doc-entry__name">${escapeHtml(card.name)}</span><span class="doc-entry__summary">${escapeHtml(card.summary)}</span></a>`).join('')}</div>\n`)
    .render();
}

/** /docs/commands/doctor/report/ — every finding a run prints, in the order they come. */
export function doctorReport(): Rendered {
  const doctor = commandPage('doctor');
  const prints = section(doctor, 'What it prints');
  const examples = section(doctor, 'Examples');
  return new Doc()
    .h1('The report')
    .note(doctorPart('every finding a run prints, in the order they come.'))
    .heading('The order of findings')
    .md(fromBlock(prints, 'The findings come in order', 'The `trust` note'))
    .heading('The trust block')
    .md(fromBlock(prints, 'The `trust` note is the one finding', 'A seat\'s model is judged'))
    .heading('Waiting at trust')
    .md(fromBlock(prints, 'A seat the state records waiting at', 'The key\'s fingerprint'))
    .heading('The key fingerprint')
    .md(paragraph(prints, 'The key\'s fingerprint'))
    .heading('The watch')
    .md(paragraph(prints, 'A watch that has not run'))
    .heading('The machine check')
    .md(paragraph(examples, 'The machine\'s own swap is read for one case only'))
    .block(fenceWith(doctor, 'console', 'asks for 2.0 GB free swap'))
    .md(paragraph(examples, 'A check that merely fails right now'))
    .note('The model warnings the order above names are on <a href="/docs/commands/doctor/models/">the models page</a>; the budget checks, on <a href="/docs/commands/doctor/budgets/">the budget-checks page</a>; the logins, on <a href="/docs/commands/doctor/login/">the sign-in page</a>.')
    .render();
}

/** /docs/commands/doctor/models/ — a launch that names no model, names another, or defers to its launcher. */
export function doctorModels(): Rendered {
  const doctor = commandPage('doctor');
  const prints = section(doctor, 'What it prints');
  const examples = section(doctor, 'Examples');
  return new Doc()
    .h1('Models and launches')
    .note(doctorPart('a launch that names no model, names another, or defers to its launcher.'))
    .heading('How a model is judged')
    .md(fromBlock(prints, 'A seat\'s model is judged', 'The placeholder'))
    .heading('The version placeholder')
    .md(paragraph(prints, 'The placeholder `version: "0"`'))
    .heading('A launch that names another model')
    .md(paragraph(examples, 'A launch that names another model'))
    .block(fenceWith(doctor, 'yaml', 'model: Claude Sonnet'))
    .block(fenceWith(doctor, 'console', 'the file says Claude Sonnet 5.5'))
    .heading('A launch that names no model')
    .md(paragraph(examples, 'A launch that names no model is not warned'))
    .block(fenceWith(doctor, 'yaml', 'launch: team-codex'))
    .block(fenceWith(doctor, 'console', 'the launch runs team-codex'))
    .md(paragraph(examples, 'The wrapper is told by the launch'))
    .block(fenceWith(doctor, 'yaml', 'model_from: launcher'))
    .block(fenceWith(doctor, 'console', 'the model is chosen by its launcher; checked'))
    .md(paragraph(examples, '`model_from: launcher` wins over the launch'))
    .render();
}

/** /docs/commands/doctor/clis/ — herdr and each seat's CLI: its version, install, and tested range. */
export function doctorClis(): Rendered {
  const doctor = commandPage('doctor');
  const examples = section(doctor, 'Examples');
  return new Doc()
    .h1('Each CLI')
    .note(doctorPart('herdr and each seat\'s CLI: its version, whether it is installed, and a CLI outside the tested range.'))
    .heading('A CLI outside the tested range')
    .md(paragraph(examples, 'A CLI outside the range this version was tested with'))
    .block(fenceWith(doctor, 'console', 'older than the tested 2.1.288'))
    .heading('A CLI that is not installed')
    .md(paragraph(examples, 'A seat on a CLI that is not installed'))
    .block(fenceWith(doctor, 'yaml', 'launch: codex --model gpt-5-codex'))
    .block(fenceWith(doctor, 'console', '2 missing, 2 warnings'))
    .render();
}

/** /docs/commands/doctor/login/ — team doctor --login: one read-only sign-in check per CLI. */
export function doctorLogin(): Rendered {
  const doctor = commandPage('doctor');
  const prints = section(doctor, 'What it prints');
  const examples = section(doctor, 'Examples');
  return new Doc()
    .h1('The sign-in checks')
    .note(doctorPart('team doctor --login: one read-only login check per CLI the seats use.'))
    .md(paragraph(prints, '`--login` reads the logins alone'))
    .md(paragraph(examples, '`--login` answers the one question'))
    .block(fenceWith(doctor, 'yaml', 'launch: codex --model gpt-5-codex'))
    .block(fenceWith(doctor, 'console', 'log in to codex'))
    .render();
}

/** /docs/commands/doctor/budgets/ — the owner's approved checks, run as the watch runs them. */
export function doctorBudgets(): Rendered {
  const doctor = commandPage('doctor');
  const prints = section(doctor, 'What it prints');
  const examples = section(doctor, 'Examples');
  return new Doc()
    .h1('The budget checks')
    .note(doctorPart('the owner\'s approved checks, run as the watch runs them.'))
    .md(paragraph(prints, 'The budget checks run from the approved'))
    .note('The warning that paragraph\'s <em>above</em> names — an account whose check is unapproved or changed after approval reads unknown — is one of the findings on <a href="/docs/commands/doctor/report/">the report page</a>.')
    .heading('A caller who is not the owner')
    .md(paragraph(examples, 'A seat\'s `doctor` runs no check'))
    .block(fenceWith(doctor, 'console', 'the budget checks were not run'))
    .heading('A check changed after approval')
    .md(paragraph(examples, 'A check that was edited after its approval'))
    .block(fenceWith(doctor, 'yaml', 'project: beacon'))
    .block(fenceWith(doctor, 'file', 'weekly 99% used'))
    .block(fenceWith(doctor, 'console', 'changed after approval and was not run'))
    .render();
}

// ------------------------------------------- the `status` reference, in pages

/**
 * `status` is the reference's sixth-longest command page (442 md lines at team 0.3.5).
 * Its hub holds what fits a screen — the purpose, the synopsis, the flags, the base
 * example, the machine-check example, who may run it, what it reads and writes, the
 * refusals and the exit codes — and the rest is split, whole and unretyped, into
 * reference pages by the page's own sections: the rows, the differences, budgets, and
 * the JSON. Together the five pages hold every fence of the reference page exactly once
 * (docs:check holds them to it), and each states its rule once.
 */

/** The reference pages of `team status`, as cards: one line each, in the site's own words. */
const STATUS_REFERENCE: { path: string; name: string; summary: string }[] = [
  { path: '/docs/commands/status/rows/', name: 'The rows', summary: 'One line per seat — its state, its model and its pane — the pane-is-its-seat comparison, and the approval note.' },
  { path: '/docs/commands/status/differences/', name: 'Differences', summary: 'Each way the file, the state and the live session disagree, the command that repairs each, and the one it orders first.' },
  { path: '/docs/commands/status/budgets/', name: 'Budgets', summary: 'The budgets table that follows the seats: what is left and used, its source, how fresh it is, and the check wrapper.' },
  { path: '/docs/commands/status/json/', name: 'The JSON', summary: 'team status --json: the same reading as one document, field by field, for a script to read.' },
];

/** The sources a `team status` page is read from — the reference page, and this assembly. */
const STATUS_FILES = ['content/team/docs/commands/status.md', 'src/server/pages.ts'];

/** A `team status` reference page's first line: where it belongs. */
function statusRefPart(html: string): string {
  return `Part of <a href="/docs/commands/status/"><code>team status</code></a> — ${html}`;
}

/** /docs/commands/status/ — the command itself: purpose, synopsis, flags, the base example, the machine check, and the short behaviour. */
export function statusPage(): Rendered {
  const status = commandPage('status');
  const examples = section(status, 'Examples');
  return new Doc()
    .h1('team status')
    .md(paragraph(status, 'Shows the team as it stands'))
    .md(section(status, 'Synopsis'))
    .heading('Flags')
    .md(section(status, 'Flags'))
    .heading('Examples')
    .note('The team file the examples read:')
    .block(fenceWith(status, 'yaml', 'project: beacon'))
    .md(paragraph(examples, 'Only the implementer is up'))
    .block(fenceWith(status, 'console', 'difference: claude-keeper is in the file and is not running'))
    .note('Each column of a row, and the approval note, is on <a href="/docs/commands/status/rows/">the rows page</a>; every difference and its repair, on <a href="/docs/commands/status/differences/">the differences page</a>; the budgets table, on <a href="/docs/commands/status/budgets/">the budgets page</a>; the <code>--json</code> document, on <a href="/docs/commands/status/json/">the JSON page</a>.')
    .heading('Who may run it')
    .md(section(status, 'Who may run it'))
    .heading('What it reads and writes')
    .md(section(status, 'What it reads and writes'))
    .heading('The machine check')
    .md(paragraph(examples, 'The machine\'s own swap is read for one case only'))
    .block(fenceWith(status, 'console', 'would refuse now'))
    .md(paragraph(examples, 'A check that merely fails right now'))
    .heading('Refusals')
    .md(section(status, 'Refusals'))
    .heading('Exit codes')
    .md(section(status, 'Exit codes'))
    .heading('The reference pages')
    .raw(`<div class="doc-grid">${STATUS_REFERENCE.map(card => `<a class="doc-entry" href="${card.path}"><span class="doc-entry__name">${escapeHtml(card.name)}</span><span class="doc-entry__summary">${escapeHtml(card.summary)}</span></a>`).join('')}</div>\n`)
    .render();
}

/** /docs/commands/status/rows/ — one line per seat, and the approval note. */
export function statusRows(): Rendered {
  const status = commandPage('status');
  return new Doc()
    .h1('The rows')
    .note(statusRefPart('one line per seat: its state, its model, its pane — and the approval note.'))
    .md(section(status, 'Rows'))
    .render();
}

/** /docs/commands/status/differences/ — each disagreement, and the command that repairs it. */
export function statusDifferences(): Rendered {
  const status = commandPage('status');
  const examples = section(status, 'Examples');
  return new Doc()
    .h1('Differences')
    .note(statusRefPart('each way the file, the state and the live session disagree, and the command that repairs it.'))
    .md(section(status, 'Differences'))
    .heading('A difference, and its repair')
    .md(paragraph(examples, 'The repair is the command `add` starts'))
    .block(fenceWith(status, 'console', '$ team add claude-keeper'))
    .md(paragraph(examples, 'Now nothing disagrees'))
    .block(fenceWith(status, 'console', '0 difference(s)'))
    .render();
}

/** /docs/commands/status/budgets/ — the budgets table that follows the seats, and the check wrapper. */
export function statusBudgets(): Rendered {
  const status = commandPage('status');
  return new Doc()
    .h1('Budgets')
    .note(statusRefPart('the budgets table that follows the seats: what is left and used, its source, and how fresh it is.'))
    .md(section(status, 'Budgets'))
    .render();
}

/** /docs/commands/status/json/ — the --json document, field by field. */
export function statusJson(): Rendered {
  const status = commandPage('status');
  const examples = section(status, 'Examples');
  return new Doc()
    .h1('The JSON')
    .note(statusRefPart('--json: the same reading as one document, for a script to read.'))
    .md(section(status, 'The JSON'))
    .heading('A --json run')
    .md(paragraph(examples, '`--json` prints that reading as one document'))
    .block(fenceWith(status, 'console', 'team status --json'))
    .render();
}

// ------------------------------------------- the `usage` reference, in pages

/**
 * `usage` is the fifth-longest command page, and the one a reader scans to see
 * what this machine holds. Its hub holds what fits a screen — the purpose, the
 * synopsis, the worked example, and a short lead of each behaviour — and the rest
 * is split, whole and unretyped, into reference pages one topic each: what it
 * reads and writes, the report's shape, the restricted view, the JSON, and the
 * refusals. Together the pages hold every fence of the reference page exactly once
 * (docs:check holds them to it), each in the reference's order, and each rule is
 * stated once, linked where it shows.
 */

/** The reference pages of `team usage`, as cards: one line each, in the site's own words. */
const USAGE_REFERENCE: { path: string; name: string; summary: string }[] = [
  { path: '/docs/commands/usage/reads-writes/', name: 'What it reads and writes', summary: 'That it writes nothing, which file\'s figures are in force, and what an unapproved or unreadable file shows.' },
  { path: '/docs/commands/usage/report/', name: 'The report', summary: 'The header counts, each account and window line, pace and ages, the rows, and the why-lines.' },
  { path: '/docs/commands/usage/restricted/', name: 'The restricted view', summary: 'Which caller reads which view, and the closed list of fields the restricted view carries.' },
  { path: '/docs/commands/usage/json/', name: 'The JSON', summary: 'What --json prints: the document\'s keys in both views, and the whole example document.' },
  { path: '/docs/commands/usage/refusals/', name: 'Refusals', summary: 'The two refusals at exit 2; everything else is a note line at exit 0.' },
];

/** The sources a `team usage` page is read from — the reference page, and this assembly. */
const USAGE_FILES = ['content/team/docs/commands/usage.md', 'src/server/pages.ts'];

/** A `team usage` reference page's first line: where it belongs. */
function usagePart(html: string): string {
  return `Part of <a href="/docs/commands/usage/"><code>team usage</code></a> — ${html}`;
}

/** /docs/commands/usage/ — the command itself: purpose, synopsis, the worked example, and the short behaviour. */
export function usagePage(): Rendered {
  const usage = commandPage('usage');
  const examples = section(usage, 'Examples');
  return new Doc()
    .h1('team usage')
    .md(paragraph(usage, 'Shows what this machine holds:'))
    .md(paragraph(usage, 'Two views are printed from the one placement'))
    .md(section(usage, 'Synopsis'))
    .heading('Examples')
    .md(paragraph(examples, 'The file below names one account'))
    .block(fenceWith(usage, 'yaml', 'project: beacon'))
    .md(paragraph(examples, 'The state holds one reading for the'))
    .block(fenceWith(usage, 'console', 'usage on this machine, 1 team'))
    .note('The same report as a JSON document, and what every key means, is on <a href="/docs/commands/usage/json/">the JSON page</a>.')
    .heading('What it reads and writes')
    .md(paragraph(section(usage, 'What it reads and writes'), 'Reads this machine\'s approval store folder'))
    .note('The rest — that it writes nothing, which file\'s figures are in force, and the one refusal its “(below)” names — is on <a href="/docs/commands/usage/reads-writes/">the reads-and-writes page</a> and <a href="/docs/commands/usage/refusals/">the refusals page</a>.')
    .heading('Who may run it')
    .md(paragraph(section(usage, 'Who may run it, and which view they read'), 'Anyone: a seat, an unplaced agent'))
    .note('Which caller reads the full or the restricted view, and what the restricted view carries, are on <a href="/docs/commands/usage/restricted/">the restricted-view page</a>.')
    .heading('Exit codes')
    .md(section(usage, 'Exit codes'))
    .heading('The reference pages')
    .raw(`<div class="doc-grid">${USAGE_REFERENCE.map(card => `<a class="doc-entry" href="${card.path}"><span class="doc-entry__name">${escapeHtml(card.name)}</span><span class="doc-entry__summary">${escapeHtml(card.summary)}</span></a>`).join('')}</div>\n`)
    .render();
}

/** /docs/commands/usage/reads-writes/ — that it writes nothing, the in-force rule, and an unreadable file. */
export function usageReadsWrites(): Rendered {
  const usage = commandPage('usage');
  return new Doc()
    .h1('What it reads and writes')
    .note(usagePart('that it writes nothing, which file\'s figures are in force, and what an unapproved or unreadable file shows.'))
    .md(fromBlock(section(usage, 'What it reads and writes'), 'It writes **nothing at all**'))
    .note('What it reads — the stores and the files — is on <a href="/docs/commands/usage/">the team usage page</a>; the one refusal the stores folder can raise is on <a href="/docs/commands/usage/refusals/">the refusals page</a>.')
    .render();
}

/** /docs/commands/usage/report/ — the report's shape: counts, lines, pace, ages, rows, why-lines. */
export function usageReport(): Rendered {
  const usage = commandPage('usage');
  return new Doc()
    .h1('The report')
    .note(usagePart('the header counts, each account and window line, the pace and ages, the per-team rows, and the why-lines.'))
    .md(section(usage, 'The report'))
    .note('The why-line for a file never approved — the “one above” this names — is on <a href="/docs/commands/usage/reads-writes/">the reads-and-writes page</a>.')
    .render();
}

/** /docs/commands/usage/restricted/ — who reads which view, and the closed list the restricted view carries. */
export function usageRestricted(): Rendered {
  const usage = commandPage('usage');
  const examples = section(usage, 'Examples');
  return new Doc()
    .h1('The restricted view')
    .note(usagePart('which caller reads the full or the restricted view, and the closed list of fields the restricted view carries.'))
    .heading('Which view a caller reads')
    .md(fromBlock(section(usage, 'Who may run it, and which view they read'), 'One function decides the view'))
    .note('The rule that anyone may run it, from any folder, is on <a href="/docs/commands/usage/">the team usage page</a>.')
    .heading('What the restricted view carries')
    .md(section(usage, 'What the restricted view carries'))
    .note('The earlier <code>note:</code> lines this names are on <a href="/docs/commands/usage/reads-writes/">the reads-and-writes page</a> and <a href="/docs/commands/usage/report/">the report page</a>.')
    .heading('The two faces, by example')
    .md(paragraph(examples, 'The same command run by the owner at a terminal'))
    .md(paragraph(examples, 'A machine that holds other teams'))
    .note('The restricted text and the JSON these name are on <a href="/docs/commands/usage/">the team usage page</a> and <a href="/docs/commands/usage/json/">the JSON page</a>.')
    .render();
}

/** /docs/commands/usage/json/ — what --json prints, and the whole example document. */
export function usageJson(): Rendered {
  const usage = commandPage('usage');
  const examples = section(usage, 'Examples');
  return new Doc()
    .h1('The JSON')
    .note(usagePart('what <code>--json</code> prints: the document\'s keys in both views, and the whole example document.'))
    .md(section(usage, 'The JSON'))
    .heading('The document')
    .md(paragraph(examples, '`--json` prints the same report as one document'))
    .block(fenceWith(usage, 'console', '"format": 1'))
    .render();
}

/** /docs/commands/usage/refusals/ — the two refusals, and that everything else is a note at exit 0. */
export function usageRefusals(): Rendered {
  const usage = commandPage('usage');
  return new Doc()
    .h1('Refusals')
    .note(usagePart('the two things that refuse it at exit 2; everything else is a note line at exit 0.'))
    .md(section(usage, 'Refusals'))
    .note('The exit codes these carry are on <a href="/docs/commands/usage/">the team usage page</a>.')
    .render();
}

// ------------------------------------------- the `down` reference, in pages

/**
 * `down` is a long command page: the stop, who may run it, the delegate gate, the
 * lines it prints, the refusals, and a walkthrough of ten fenced examples. Its hub
 * holds what fits a screen — the purpose, the synopsis, the flags, the basic
 * walkthrough, what it reads and writes, who may run it, the exit codes — and the
 * rest is split, whole and unretyped, into reference pages one topic each: the
 * approved delegate, what it prints, a renamed seat and a broken file, and the
 * refusals. Together the pages hold every fence of the reference page exactly once
 * (docs:check holds them to it) — the dry-run plan is fenced twice in the
 * reference, so it shows twice — each in the reference's order, and each rule once.
 */

/** The reference pages of `team down`, as cards: one line each, in the site's own words. */
const DOWN_REFERENCE: { path: string; name: string; summary: string }[] = [
  { path: '/docs/commands/down/delegate/', name: 'The approved delegate', summary: 'The pane the delegates section lists for down, the gate it passes, and the caller-role refusals shown.' },
  { path: '/docs/commands/down/output/', name: 'What it prints', summary: 'Every line a stop prints, the skip lines for a seat left running, and the idle “nothing to stop”.' },
  { path: '/docs/commands/down/edge-cases/', name: 'A renamed seat, and a broken file', summary: 'Two runs: a seat renamed after up, and a team file that no longer validates.' },
  { path: '/docs/commands/down/refusals/', name: 'Refusals', summary: 'Every message that refuses team down, and the exit each one carries.' },
];

/** The sources a `team down` page is read from — the reference page, and this assembly. */
const DOWN_FILES = ['content/team/docs/commands/down.md', 'src/server/pages.ts'];

/** A `team down` reference page's first line: where it belongs. */
function downPart(html: string): string {
  return `Part of <a href="/docs/commands/down/"><code>team down</code></a> — ${html}`;
}

/** /docs/commands/down/ — the command itself: purpose, synopsis, flags, the basic walkthrough, and the short behaviour. */
export function downPage(): Rendered {
  const down = commandPage('down');
  const examples = section(down, 'Examples');
  return new Doc()
    .h1('team down')
    .md(paragraph(down, 'Stops the team:'))
    .md(section(down, 'Synopsis'))
    .heading('Flags')
    .md(section(down, 'Flags'))
    .heading('Examples')
    .note('The team file the examples read:')
    .block(fenceWith(down, 'yaml', 'claude-beacon'))
    .md(paragraph(examples, 'Two seats idle, a watch running'))
    .block(fenceWith(down, 'console', 'pane run w1:p1 /exit'))
    .md(paragraph(examples, 'For the owner, running that plan stops everything'))
    .block(fenceWith(down, 'console', 'claude-keeper: stopped'))
    .note('The caller-role and the renamed-seat examples are on <a href="/docs/commands/down/delegate/">the delegate page</a> and <a href="/docs/commands/down/edge-cases/">the renamed-seat-and-broken-file page</a>.')
    .heading('What it reads and writes')
    .md(section(down, 'What it reads and writes'))
    .note('A seat the file renamed, and a team file that no longer validates, are shown on <a href="/docs/commands/down/edge-cases/">the renamed-seat-and-broken-file page</a>.')
    .heading('Who may run it')
    .md(section(down, 'Who may run it'))
    .note('The approved delegate this names — the “(below)” — and the caller-role refusals shown are on <a href="/docs/commands/down/delegate/">the delegate page</a>.')
    .heading('What it prints')
    .note('Every line a stop prints, the skip lines for a seat left running, and the idle “nothing to stop”, are on <a href="/docs/commands/down/output/">the what-it-prints page</a>.')
    .heading('Exit codes')
    .md(section(down, 'Exit codes'))
    .note('The refusals these codes name are on <a href="/docs/commands/down/refusals/">the refusals page</a>.')
    .heading('The reference pages')
    .raw(`<div class="doc-grid">${DOWN_REFERENCE.map(card => `<a class="doc-entry" href="${card.path}"><span class="doc-entry__name">${escapeHtml(card.name)}</span><span class="doc-entry__summary">${escapeHtml(card.summary)}</span></a>`).join('')}</div>\n`)
    .render();
}

/** /docs/commands/down/delegate/ — the approved delegate, and the caller-role refusals shown. */
export function downDelegate(): Rendered {
  const down = commandPage('down');
  const examples = section(down, 'Examples');
  return new Doc()
    .h1('The approved delegate')
    .note(downPart('the pane the delegates section lists for down, the gate it passes, and the caller-role refusals shown.'))
    .md(section(down, 'The approved delegate'))
    .note('The ordinary rule this gate defers to — who may run it, from where — is on <a href="/docs/commands/down/">the team down page</a>.')
    .heading('The caller rules, shown')
    .md(paragraph(examples, 'An implementer'))
    .block(fenceByInfo(down, 'caller=claude-beacon'))
    .md(paragraph(examples, 'The orchestrator'))
    .block(fenceByInfo(down, 'caller=claude-keeper'))
    .render();
}

/** /docs/commands/down/output/ — every line a stop prints, the skip lines, and the idle return. */
export function downOutput(): Rendered {
  const down = commandPage('down');
  const examples = section(down, 'Examples');
  return new Doc()
    .h1('What it prints')
    .note(downPart('every line a stop prints, the skip lines for a seat left running, and the idle “nothing to stop”.'))
    .md(section(down, 'What it prints'))
    .heading('Nothing to stop')
    .md(paragraph(examples, 'Once the session is down there is nothing to stop'))
    .block(fenceWith(down, 'console', 'nothing to stop'))
    .render();
}

/** /docs/commands/down/edge-cases/ — a seat the file renamed, and a team file that no longer validates. */
export function downEdgeCases(): Rendered {
  const down = commandPage('down');
  const examples = section(down, 'Examples');
  return new Doc()
    .h1('A renamed seat, and a broken file')
    .note(downPart('two runs: a seat the file renamed after up, and a team file that no longer validates.'))
    .heading('A renamed seat')
    .md(paragraph(down, 'A seat the file renamed after'))
    .md(paragraph(examples, 'The file renamed claude-beacon after'))
    .block(fenceWith(down, 'yaml', 'claude-relay'))
    .block(fenceWith(down, 'console', 'pane run w1:p1 /exit'))
    .heading('A broken file')
    .md(paragraph(examples, 'Even with the team file broken'))
    .block(fenceWith(down, 'yaml', 'seats: ['))
    .block(fenceWith(down, 'console', 'team.yaml is invalid'))
    .note('The rule that a broken file is replaced by the last copy that validated is on <a href="/docs/commands/down/">the team down page</a>.')
    .render();
}

/** /docs/commands/down/refusals/ — every message that refuses team down, and its exit. */
export function downRefusals(): Rendered {
  const down = commandPage('down');
  return new Doc()
    .h1('Refusals')
    .note(downPart('every message that refuses it, and the exit each one carries.'))
    .md(section(down, 'Refusals'))
    .note('The exit codes these refusals carry are on <a href="/docs/commands/down/">the team down page</a>.')
    .render();
}

// ------------------------------------------- the `approve` reference, in pages

/**
 * `approve` is the third-longest command page, and the owner's first gate: every
 * command that starts or changes a team reads the record it writes. Its hub holds
 * what fits a screen — the purpose, the synopsis, the flags, the basic walkthrough,
 * the short behaviour — and the rest is split, whole and unretyped, into reference
 * pages one topic each: who may run it, the read-back, the signed record, the
 * refusals, and the overrides file. Together the six pages hold every fence of the
 * reference page exactly once (docs:check holds them to it), each in the reference's
 * order, and each rule is stated once, linked where it shows.
 */

/** The reference pages of `team approve`, as cards: one line each, in the site's own words. */
const APPROVE_REFERENCE: { path: string; name: string; summary: string }[] = [
  { path: '/docs/commands/approve/who/', name: 'Who may run it', summary: 'The owner, the approved delegate, and what a delegated approval may change.' },
  { path: '/docs/commands/approve/read-back/', name: 'The read-back', summary: 'What approve prints: the diff against the approved copy, the ceilings and seats, and what needs a new approval.' },
  { path: '/docs/commands/approve/record/', name: 'The signed record', summary: 'The key and the counter, the record\'s strict shape, and a record from before signing.' },
  { path: '/docs/commands/approve/refusals/', name: 'Refusals', summary: 'The refusals, --confirm, and a line waiting on the terminal that refuses the write.' },
  { path: '/docs/commands/approve/overrides/', name: 'The overrides file', summary: 'overrides.yaml in the approval store: the patterns it may add, and when approve records it.' },
];

/** The sources a `team approve` page is read from — the reference page, and this assembly. */
const APPROVE_FILES = ['content/team/docs/commands/approve.md', 'src/server/pages.ts'];

/** A `team approve` reference page's first line: where it belongs. */
function approvePart(html: string): string {
  return `Part of <a href="/docs/commands/approve/"><code>team approve</code></a> — ${html}`;
}

/** /docs/commands/approve/ — the command itself: purpose, synopsis, flags, the basic walkthrough, and the short behaviour. */
export function approvePage(): Rendered {
  const approve = commandPage('approve');
  const examples = section(approve, 'Examples');
  const prints = section(approve, 'What it prints');
  return new Doc()
    .h1('team approve')
    .md(paragraph(approve, 'The owner approves the team file:'))
    .md(section(approve, 'Synopsis'))
    .heading('Flags')
    .md(section(approve, 'Flags'))
    .heading('Examples')
    .note('The team file the examples read:')
    .block(fenceWith(approve, 'yaml', 'project: beacon'))
    .md(paragraph(examples, 'The first run shows the whole file'))
    .block(fenceWith(approve, 'console', 'never approved on this machine. The whole file:'))
    .md(paragraph(examples, 'The owner approves it'))
    .block(fenceWith(approve, 'console', 'Approved. The record is in'))
    .heading('Who may run it')
    .md(paragraph(section(approve, 'Who may run it'), 'The owner, from a terminal outside herdr'))
    .note('The delegate\'s grant — the gate this names, which owner sections it admits, and a delegated run — is on <a href="/docs/commands/approve/who/">the who-may-run-it page</a>.')
    .heading('What it reads and writes')
    .md(section(approve, 'What it reads and writes'))
    .note('How the record is signed — the key, the counter and its fingerprint — is on <a href="/docs/commands/approve/record/">the signed-record page</a>.')
    .heading('What it prints')
    .md(fromBlock(prints, 'With no record on this machine', 'Nothing at all changed is said plainly:'))
    .note('When nothing changed, the ceilings and seats an approval fixes, what needs a new approval, and an unapproved section\'s drift are on <a href="/docs/commands/approve/read-back/">the read-back page</a>.')
    .heading('Exit codes')
    .md(section(approve, 'Exit codes'))
    .note('The refusals these codes name — the write gate, and <code>--confirm</code> — are on <a href="/docs/commands/approve/refusals/">the refusals page</a>.')
    .heading('The reference pages')
    .raw(`<div class="doc-grid">${APPROVE_REFERENCE.map(card => `<a class="doc-entry" href="${card.path}"><span class="doc-entry__name">${escapeHtml(card.name)}</span><span class="doc-entry__summary">${escapeHtml(card.summary)}</span></a>`).join('')}</div>\n`)
    .render();
}

/** /docs/commands/approve/who/ — the owner, the approved delegate, and what a delegated approval may change. */
export function approveWho(): Rendered {
  const approve = commandPage('approve');
  const examples = section(approve, 'Examples');
  return new Doc()
    .h1('Who may run it')
    .note(approvePart('the owner, the approved delegate, and what a delegated approval may change.'))
    .heading('A delegate\'s grant')
    .md(paragraph(section(approve, 'Who may run it'), 'A delegate\'s approval is for ordinary changes'))
    .note('The ordinary rule this narrows — only the owner, from a terminal outside herdr — is on <a href="/docs/commands/approve/">the team approve page</a>.')
    .heading('A delegated approval')
    .md(section(approve, 'A delegated approval'))
    .heading('A seat is not the owner')
    .md(paragraph(examples, 'A seat can read the comparison'))
    .block(fenceByInfo(approve, 'caller=claude-keeper'))
    .render();
}

/** /docs/commands/approve/read-back/ — what approve prints, the ceilings and seats it fixes, and what needs a new approval. */
export function approveReadBack(): Rendered {
  const approve = commandPage('approve');
  const examples = section(approve, 'Examples');
  const prints = section(approve, 'What it prints');
  return new Doc()
    .h1('The read-back')
    .note(approvePart('what approve prints against an existing record: when nothing changed, the ceilings and seats it fixes, and what needs a new approval.'))
    .md(fromBlock(prints, 'Nothing at all changed is said plainly:'))
    .note('When no record on this machine, the whole file is printed numbered — the example of that, and the basic walkthrough, are on <a href="/docs/commands/approve/">the team approve page</a>.')
    .heading('An owner section changed')
    .md(paragraph(examples, 'An owner section is the owner'))
    .block(fenceWith(approve, 'yaml', '~/Code/worktrees/beacon'))
    .block(fenceWith(approve, 'console', 'Needs a new approval: `trust` changed'))
    .render();
}

/** /docs/commands/approve/record/ — the signed record: the key, the counter, its shape, and a record from before signing. */
export function approveRecord(): Rendered {
  const approve = commandPage('approve');
  return new Doc()
    .h1('The signed record')
    .note(approvePart('the signed record approve writes: the key and the counter, its strict shape, and a record from before signing.'))
    .md(section(approve, 'The signed record'))
    .render();
}

/** /docs/commands/approve/refusals/ — what refuses a write, and the --confirm and input gates. */
export function approveRefusals(): Rendered {
  const approve = commandPage('approve');
  const examples = section(approve, 'Examples');
  return new Doc()
    .h1('Refusals')
    .note(approvePart('what refuses a write: a seat or the wrong delegate, a change that needs the owner, <code>--confirm</code>\'s answer, and a line waiting on the terminal.'))
    .heading('Every refusal')
    .md(section(approve, 'Refusals'))
    .note('The exit codes these refusals carry are on <a href="/docs/commands/approve/">the team approve page</a>.')
    .heading('A new seat, and the write gate')
    .md(paragraph(examples, 'A new seat needs one too'))
    .block(fenceWith(approve, 'yaml', 'claude-beacon'))
    .md(paragraph(examples, '`--confirm` asks, and a wrong answer'))
    .block(fenceByInfo(approve, 'answer="1"'))
    .md(paragraph(examples, 'The same protection without `--confirm`'))
    .block(fenceByInfo(approve, 'waiting="1"'))
    .md(paragraph(examples, 'A terminal the check cannot read'))
    .block(fenceByInfo(approve, 'waiting="unreadable"'))
    .md(paragraph(examples, 'With `--confirm`, the answer is the number of seats'))
    .block(fenceByInfo(approve, 'answer="2"'))
    .md(paragraph(examples, 'The same file again is the same text'))
    .block(fenceWith(approve, 'console', 'approval #3 for this project'))
    .render();
}

/** /docs/commands/approve/overrides/ — overrides.yaml in the approval store, and when approve records it. */
export function approveOverrides(): Rendered {
  const approve = commandPage('approve');
  return new Doc()
    .h1('The overrides file')
    .note(approvePart('overrides.yaml in the approval store: the patterns it may add to a shipped profile, and when approve records it.'))
    .md(section(approve, 'The overrides file'))
    .render();
}

// ------------------------------------------- the `remove` reference, in pages

/**
 * `remove` is a long command page: the stop and file edit, who may run it, the
 * delegate gate, the lines it prints, the non-owner leave, the refusals, and a
 * walkthrough of eleven fenced examples. Its hub holds what fits a screen — the
 * purpose, the synopsis, the flags, the basic removal, what it reads and writes,
 * who may run it, the exit codes — and the rest is split, whole and unretyped,
 * into reference pages one topic each: who may run it, what it prints, the
 * refusals, and a temporary seat and --keep. Together the pages hold every fence
 * of the reference page exactly once (docs:check holds them to it), and each
 * states its rule once, linked where it shows.
 */

/** The reference pages of `team remove`, as cards: one line each, in the site's own words. */
const REMOVE_REFERENCE: { path: string; name: string; summary: string }[] = [
  { path: '/docs/commands/remove/who/', name: 'Who may run it', summary: 'The owner, the orchestrator, the operator and the approved delegate — and the caller-role refusals shown.' },
  { path: '/docs/commands/remove/output/', name: 'What it prints', summary: 'Every line a removal prints, the non-owner leave, and a seat that does not leave cleanly.' },
  { path: '/docs/commands/remove/refusals/', name: 'Refusals', summary: 'Every message that refuses team remove, and the busy-seat and name refusals shown.' },
  { path: '/docs/commands/remove/keep-and-temporary/', name: 'A temporary seat, and --keep', summary: 'A temporary seat removed by its add name, and --keep leaving the entry stopped.' },
];

/** The sources a `team remove` page is read from — the reference page, and this assembly. */
const REMOVE_FILES = ['content/team/docs/commands/remove.md', 'src/server/pages.ts'];

/** A `team remove` reference page's first line: where it belongs. */
function removeRefPart(html: string): string {
  return `Part of <a href="/docs/commands/remove/"><code>team remove</code></a> — ${html}`;
}

/** /docs/commands/remove/ — the command itself: purpose, synopsis, flags, the basic removal, and the short behaviour. */
export function removePage(): Rendered {
  const remove = commandPage('remove');
  const examples = section(remove, 'Examples');
  return new Doc()
    .h1('team remove')
    .md(paragraph(remove, 'Takes one seat out of the team:'))
    .md(section(remove, 'Synopsis'))
    .heading('Flags')
    .md(section(remove, 'Flags'))
    .heading('Examples')
    .note('The team file the examples read:')
    .block(fenceWith(remove, 'yaml', 'project: beacon'))
    .md(paragraph(examples, 'Without `--keep` the seat'))
    .block(fenceWith(remove, 'console', 'the team has no seat'))
    .note('A busy seat left as it is, a temporary seat and <code>--keep</code>, the non-owner leave, and the caller-role refusals are on the reference pages below.')
    .heading('What it reads and writes')
    .md(section(remove, 'What it reads and writes'))
    .note('The leave its “(below)” names — a caller other than the owner meeting a seat herdr reports idle or done, with no typing and the pane left running — is on <a href="/docs/commands/remove/output/">the what-it-prints page</a>.')
    .heading('Who may run it')
    .md(paragraph(section(remove, 'Who may run it'), 'The owner, the orchestrator'))
    .note('The approved delegate, and the caller-role refusals shown, are on <a href="/docs/commands/remove/who/">the who-may-run-it page</a>.')
    .heading('Exit codes')
    .md(section(remove, 'Exit codes'))
    .note('The leave these codes name is on <a href="/docs/commands/remove/output/">the what-it-prints page</a>; every refusal is on <a href="/docs/commands/remove/refusals/">the refusals page</a>.')
    .heading('The reference pages')
    .raw(`<div class="doc-grid">${REMOVE_REFERENCE.map(card => `<a class="doc-entry" href="${card.path}"><span class="doc-entry__name">${escapeHtml(card.name)}</span><span class="doc-entry__summary">${escapeHtml(card.summary)}</span></a>`).join('')}</div>\n`)
    .render();
}

/** /docs/commands/remove/who/ — the approved delegate, and the caller-role refusals shown. */
export function removeWho(): Rendered {
  const remove = commandPage('remove');
  const examples = section(remove, 'Examples');
  return new Doc()
    .h1('Who may run it')
    .note(removeRefPart('the owner, the orchestrator, the operator and the approved delegate — and the caller-role refusals shown.'))
    .md(paragraph(section(remove, 'Who may run it'), 'A file with a `delegates` section'))
    .note('The ordinary rule this delegate gate defers to — the owner, the orchestrator and the operator, and the placement it proves — is on <a href="/docs/commands/remove/">the team remove page</a>.')
    .heading('The caller rules, shown')
    .md(paragraph(examples, 'Anyone else — the orchestrator'))
    .note('The leave this names — the removal a caller other than the owner makes — is on <a href="/docs/commands/remove/output/">the what-it-prints page</a>.')
    .md(paragraph(examples, 'An implementer\'s seat may not remove'))
    .block(fenceByInfo(remove, 'caller=claude-beacon'))
    .md(paragraph(examples, 'The orchestrator\'s seat may remove others'))
    .block(fenceByInfo(remove, 'caller=claude-keeper'))
    .render();
}

/** /docs/commands/remove/output/ — every line a removal prints, the non-owner leave, and a seat left behind. */
export function removeOutput(): Rendered {
  const remove = commandPage('remove');
  const examples = section(remove, 'Examples');
  return new Doc()
    .h1('What it prints')
    .note(removeRefPart('every line a removal prints, the non-owner leave, and a seat that does not leave cleanly.'))
    .md(section(remove, 'What it prints'))
    .note('The refusal its last paragraph names — a box holding this CLI\'s exit text unsent — is on <a href="/docs/commands/remove/refusals/">the refusals page</a>.')
    .heading('The non-owner leave')
    .md(paragraph(examples, 'A caller other than the owner, meeting a seat herdr reports idle or done that is not free'))
    .block(fenceByInfo(remove, 'caller=claude-keeper screens="claude-reviewer=unknown"'))
    .render();
}

/** /docs/commands/remove/refusals/ — every message that refuses it, and the busy-seat and name refusals shown. */
export function removeRefusals(): Rendered {
  const remove = commandPage('remove');
  const examples = section(remove, 'Examples');
  return new Doc()
    .h1('Refusals')
    .note(removeRefPart('every message that refuses it, and the busy-seat and name refusals shown.'))
    .md(section(remove, 'Refusals'))
    .note('The leave this section\'s “above” names — a caller other than the owner\'s own answer to those states — is on <a href="/docs/commands/remove/output/">the what-it-prints page</a>; the exit codes are on <a href="/docs/commands/remove/">the team remove page</a>.')
    .heading('A busy seat is left as it is')
    .md(paragraph(examples, 'A seat mid-turn is not interrupted'))
    .block(fenceByInfo(remove, 'screens="claude-beacon=working"'))
    .md(paragraph(examples, 'A permission prompt is the same'))
    .block(fenceByInfo(remove, 'screens="claude-beacon=permission"'))
    .md(paragraph(examples, 'A screen the profile can\'t read never frees itself'))
    .block(fenceByInfo(remove, 'screens="claude-beacon=unknown"'))
    .heading('A name is required')
    .md(paragraph(examples, 'A name is required, and its absence'))
    .block(fenceWith(remove, 'console', 'a seat name is required'))
    .render();
}

/** /docs/commands/remove/keep-and-temporary/ — a temporary seat removed by its add name, and --keep. */
export function removeKeepAndTemporary(): Rendered {
  const remove = commandPage('remove');
  const examples = section(remove, 'Examples');
  return new Doc()
    .h1('A temporary seat, and --keep')
    .note(removeRefPart('a temporary seat removed by the name add gave it, and --keep leaving the seat in the file as stopped for a later team add.'))
    .heading('A temporary seat')
    .md(paragraph(examples, 'A temporary seat is recorded in the state'))
    .block(fenceWith(remove, 'console', 'claude-beacon-tmp-1'))
    .heading('--keep')
    .md(paragraph(examples, '`--keep` stops the seat and leaves its place'))
    .block(fenceWith(remove, 'console', 'stopped claude-beacon'))
    .render();
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
  const approve = commandPage('approve');
  const watch = commandPage('watch');
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
    .heading('The approved copy')
    .md(section(README, 'The file is private to each clone'))
    .heading('What an approval covers')
    .md(sentence(approve, 'What needs a'))
    .md(sentence(approve, 'Until an edit is'))
    .heading('dialogs.trust: owner or coordinator')
    .md(paragraph(up, 'The lobby is a folder no CLI has seen before'))
    .heading('What team never does')
    .md(never.map(text => `- ${text}`).join('\n'))
    .note(inline(sentence(README, 'Launching a Cursor seat')))
    // The hatch paragraph: the reference's escape-hatch and guarantee sentences are
    // extracted from `team watch`; the module's place and the caution line are the
    // page's words, which the reference's own prose doesn't carry.
    .note(`team's screen hatch is a code module a CLI profile may name — inside the package's own profiles folder, nowhere else. ${sentence(watch, 'A screen hatch is an escape hatch')} A hatch can only add caution, never remove it, and no shipped profile uses one. ${sentence(watch, 'The guarantees cover what a hatch returns')}`)
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
    .md(sentence(doctor, 'A login check that passed is'))
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
    page('/docs/', 'Getting started — team', '0.9', gettingStarted(), ['src/server/shells/getting-started.eta']),
    page('/docs/file/', 'The team file — team', '0.8', teamFile(), ['src/server/shells/team-file.eta']),
    page('/docs/commands/', 'Commands — team', '0.9', commandIndex(), ['src/server/shells/commands.eta']),
    page('/docs/safety/', 'Safety — team', '0.7', safety(), ['src/server/shells/safety.eta']),
    page('/docs/clis/', 'Supported CLIs — team', '0.7', clis(), ['src/server/shells/clis.eta']),
  ];
  // `up` comes first in the table's order and carries its reference pages beside it;
  // every other command is the one page the reference gives.
  const commands = commandNames().flatMap(name => name === 'up'
    ? [
        page('/docs/commands/up/', 'team up — team', '0.8', upPage(), UP_FILES),
        page('/docs/commands/up/launch/', 'team up: the launch — team', '0.5', upLaunch(), UP_FILES),
        page('/docs/commands/up/records/', 'team up: the records — team', '0.5', upRecords(), UP_FILES),
        page('/docs/commands/up/waiting/', 'team up: waiting for the owner — team', '0.5', upWaiting(), UP_FILES),
        page('/docs/commands/up/limits/', 'team up: known limits — team', '0.5', upLimits(), UP_FILES),
        page('/docs/commands/up/refusals/', 'team up: refusals — team', '0.5', upRefusals(), UP_FILES),
      ]
    : name === 'watch'
    ? [
        page('/docs/commands/watch/', 'team watch — team', '0.8', watchPage(), WATCH_FILES),
        page('/docs/commands/watch/reports/', 'team watch: the reports — team', '0.5', watchReports(), WATCH_FILES),
        page('/docs/commands/watch/nudge/', 'team watch: the nudge — team', '0.5', watchNudge(), WATCH_FILES),
        page('/docs/commands/watch/screens/', 'team watch: how a screen is read — team', '0.5', watchScreens(), WATCH_FILES),
        page('/docs/commands/watch/budgets/', 'team watch: budgets — team', '0.5', watchBudgets(), WATCH_FILES),
        page('/docs/commands/watch/checks/', 'team watch: the approved checks and timings — team', '0.5', watchChecks(), WATCH_FILES),
      ]
    : name === 'doctor'
    ? [
        page('/docs/commands/doctor/', 'team doctor — team', '0.8', doctorPage(), DOCTOR_FILES),
        page('/docs/commands/doctor/report/', 'team doctor: the report — team', '0.5', doctorReport(), DOCTOR_FILES),
        page('/docs/commands/doctor/models/', 'team doctor: models and launches — team', '0.5', doctorModels(), DOCTOR_FILES),
        page('/docs/commands/doctor/clis/', 'team doctor: each CLI — team', '0.5', doctorClis(), DOCTOR_FILES),
        page('/docs/commands/doctor/login/', 'team doctor: the sign-in checks — team', '0.5', doctorLogin(), DOCTOR_FILES),
        page('/docs/commands/doctor/budgets/', 'team doctor: the budget checks — team', '0.5', doctorBudgets(), DOCTOR_FILES),
      ]
    : name === 'status'
    ? [
        page('/docs/commands/status/', 'team status — team', '0.8', statusPage(), STATUS_FILES),
        page('/docs/commands/status/rows/', 'team status: the rows — team', '0.5', statusRows(), STATUS_FILES),
        page('/docs/commands/status/differences/', 'team status: differences — team', '0.5', statusDifferences(), STATUS_FILES),
        page('/docs/commands/status/budgets/', 'team status: budgets — team', '0.5', statusBudgets(), STATUS_FILES),
        page('/docs/commands/status/json/', 'team status: the JSON — team', '0.5', statusJson(), STATUS_FILES),
      ]
    : name === 'usage'
    ? [
        page('/docs/commands/usage/', 'team usage — team', '0.8', usagePage(), USAGE_FILES),
        page('/docs/commands/usage/reads-writes/', 'team usage: what it reads and writes — team', '0.5', usageReadsWrites(), USAGE_FILES),
        page('/docs/commands/usage/report/', 'team usage: the report — team', '0.5', usageReport(), USAGE_FILES),
        page('/docs/commands/usage/restricted/', 'team usage: the restricted view — team', '0.5', usageRestricted(), USAGE_FILES),
        page('/docs/commands/usage/json/', 'team usage: the JSON — team', '0.5', usageJson(), USAGE_FILES),
        page('/docs/commands/usage/refusals/', 'team usage: refusals — team', '0.5', usageRefusals(), USAGE_FILES),
      ]
    : name === 'down'
    ? [
        page('/docs/commands/down/', 'team down — team', '0.8', downPage(), DOWN_FILES),
        page('/docs/commands/down/delegate/', 'team down: the approved delegate — team', '0.5', downDelegate(), DOWN_FILES),
        page('/docs/commands/down/output/', 'team down: what it prints — team', '0.5', downOutput(), DOWN_FILES),
        page('/docs/commands/down/edge-cases/', 'team down: a renamed seat and a broken file — team', '0.5', downEdgeCases(), DOWN_FILES),
        page('/docs/commands/down/refusals/', 'team down: refusals — team', '0.5', downRefusals(), DOWN_FILES),
      ]
    : name === 'approve'
    ? [
        page('/docs/commands/approve/', 'team approve — team', '0.8', approvePage(), APPROVE_FILES),
        page('/docs/commands/approve/who/', 'team approve: who may run it — team', '0.5', approveWho(), APPROVE_FILES),
        page('/docs/commands/approve/read-back/', 'team approve: the read-back — team', '0.5', approveReadBack(), APPROVE_FILES),
        page('/docs/commands/approve/record/', 'team approve: the signed record — team', '0.5', approveRecord(), APPROVE_FILES),
        page('/docs/commands/approve/refusals/', 'team approve: refusals — team', '0.5', approveRefusals(), APPROVE_FILES),
        page('/docs/commands/approve/overrides/', 'team approve: the overrides file — team', '0.5', approveOverrides(), APPROVE_FILES),
      ]
    : name === 'remove'
    ? [
        page('/docs/commands/remove/', 'team remove — team', '0.8', removePage(), REMOVE_FILES),
        page('/docs/commands/remove/who/', 'team remove: who may run it — team', '0.5', removeWho(), REMOVE_FILES),
        page('/docs/commands/remove/output/', 'team remove: what it prints — team', '0.5', removeOutput(), REMOVE_FILES),
        page('/docs/commands/remove/refusals/', 'team remove: refusals — team', '0.5', removeRefusals(), REMOVE_FILES),
        page('/docs/commands/remove/keep-and-temporary/', 'team remove: a temporary seat and --keep — team', '0.5', removeKeepAndTemporary(), REMOVE_FILES),
      ]
    : [page(`/docs/commands/${name}/`, `team ${name} — team`, '0.8', commandPageContent(name), [`content/team/docs/commands/${name}.md`])]);
  return [...group, ...commands];
}

/**
 * A command page's description: the site's own words, because a page's first sentence
 * runs past what a search result shows. The page's body is the reference; this is the
 * signpost to it. docs:check holds each to one line of at most 160 characters.
 */
const DESCRIPTIONS: Record<string, string> = {
  init: 'Writes the team file: a skeleton for this project, or the copy you last approved, kept out of git.',
  approve: 'The owner reads the whole file back, then records it, its ceilings and its seats on this machine; --show prints it.',
  'approve/who': 'Who may run team approve: the owner from a terminal outside herdr, and the approved delegate — the pane the file names — for the roster and rules alone.',
  'approve/read-back': 'What team approve prints back: the per-section diff against the approved copy, the ceilings and seats it fixes, and which changes need a new approval.',
  'approve/record': 'The signed approval record: the key and per-project counter outside the store, the record\'s strict shape, and a record written before signing.',
  'approve/refusals': 'What refuses a team approve write: a seat or wrong delegate, a change needing the owner, --confirm\'s answer, and a line waiting on the terminal.',
  'approve/overrides': 'overrides.yaml beside the approval record: the dialog and quota patterns it may add to a shipped profile, and when team approve records it.',
  check: 'One answer to one question: is anything wrong with this team that someone should act on? It reads the file, approval, state and herdr.',
  commits: 'Checks a commit, or a range of commits, against the signature rule and forbidden patterns; exit 1 when a commit is refused.',
  pr: 'Checks a pull request body against the signature rule and forbidden patterns, needing no repository; exit 1 when refused.',
  doctor: 'What this machine still needs: the approval, herdr, each CLI, its version and login, each launch’s model, and the watch.',
  'doctor/report': 'Every finding a team doctor run prints, in order — the file warnings, the approval, the seats, the watch — with the trust block and the key fingerprint.',
  'doctor/models': 'What team doctor says of a seat’s model: a launch that names none, names another, or defers to its launcher, and the version “0” placeholder.',
  'doctor/clis': 'herdr and each seat’s CLI in team doctor: its version, whether it is installed, and what a CLI outside the tested range means.',
  'doctor/login': 'team doctor --login: one read-only sign-in check per CLI the seats use, in the order they first name them, and nothing else.',
  'doctor/budgets': 'The owner’s budget checks in team doctor, run as the watch runs them, and what a non-owner caller or a check changed after approval reads.',
  status: 'The team as it stands: one line per seat, and every difference between the file, the state and the live session, with its repair.',
  'status/rows': 'One line per seat in team status: its state, model and pane, the pane-is-its-seat comparison, and the approval note.',
  'status/differences': 'Every way the file, the state and the live session disagree in team status, the command that repairs each, and the one it orders first.',
  'status/budgets': 'The budgets table team status prints after the seats: what is left and used, its source, how fresh it is, and the check wrapper.',
  'status/json': 'team status --json: the same reading as one document, field by field, for a script to read instead of the table.',
  up: 'Starts the session, a workspace and each seat the file has not stopped, plus the watch; a stopped seat waits for team add. --dry-run prints the plan.',
  'up/launch': 'What team up does before it creates anything: the stopped session it clears, the lobby gate it verifies, and the folder each seat starts in.',
  'up/records': 'Every line a team up run prints — ready and left out — the close proofs, the rules delivery, and the table that says what each line means.',
  'up/waiting': 'The pause when a seat stops at a dialog: the owner\'s o, s and q keys, the proof of a waiting record, and runs without a terminal.',
  'up/limits': 'The windows a process of the same user still has in a team up launch: the waiting proof, the read-back and Enter, the rules folder chain.',
  'up/refusals': 'What stops a team up run before its first step: the owner and delegate gates, the approval, the lobby, the load — with the refused runs shown.',
  down: 'Stops the team: asks every free seat to exit, closes its workspace, stops the watch, and stops the session.',
  'down/delegate': 'The approved delegate for team down: the pane the delegates section lists, the gate it passes only where the ordinary rule refused, and the role refusals.',
  'down/output': 'What team down prints: a line per seat, watch and session stopped, the skip lines for a seat left running, and the idle “nothing to stop”.',
  'down/edge-cases': 'Two team down runs: a seat the file renamed after up, stopped under its launched name, and a team file that no longer validates, using the last good copy.',
  'down/refusals': 'Every message that refuses team down and its exit — the caller-role gates, the owner-only flags, placement, the delegate gate, and the shared lock.',
  watch: 'Watches a running team: reports idle seats and nudges the operator, in one fixed line, into an empty idle prompt only.',
  'watch/reports': 'Every line a team watch pass can print and when each is made: the seat, approval, machine and account reports, and what the log holds beyond them.',
  'watch/nudge': 'The one fixed line team watch types into the operator’s pane when a report is theirs to act on, the lines around it, and --no-nudge.',
  'watch/screens': 'How team watch reads a pane: the idle frame that tells a prompt from a dialog, a question or a vendor notice, with the live-agent check.',
  'watch/budgets': 'The figures a team watch pass reads off the seats and the check commands, and when a mark crossing, a reserve or a floor is reported.',
  'watch/checks': 'The checks and timings the owner approves for team watch, and what a pass reports while an edit to the file is still unapproved.',
  add: 'Starts one declared seat, or a temporary one beside the team with --temporary --like <seat> --until <result:path|merged:branch>.',
  remove: 'Stops one seat and takes it out of the file; --keep leaves it stopped; --abandon is the owner’s, and types nothing.',
  'remove/who': 'Who may run team remove: the owner, the orchestrator, the operator and the approved delegate — and the caller-role refusals shown.',
  'remove/output': 'What team remove prints: a line per seat stopped and the file edit, the non-owner leave, and a seat that does not leave cleanly.',
  'remove/refusals': 'Every message that refuses team remove and its exit — the caller gates, the owner-only flags, the busy-seat states, placement, and the shared lock.',
  'remove/keep-and-temporary': 'Removing a temporary seat by the name add gave it, and --keep leaving the seat in the file as stopped for a later team add.',
  worktree: 'Creates a task worktree from an up-to-date base, or removes one; the branch is never deleted.',
  answer: 'Presses the one recorded key of a seat\'s folder-trust dialog when the file allows it; every check has to pass, and anything else sends nothing.',
  release: 'Checks a release on npm and GitHub. When the file has the pairs: Linear milestone, qualifying status update, and the release marker in the public activity file.',
  usage: 'Shows one project’s budget accounts, windows, remaining usage, and when each figure was last read.',
  'usage/reads-writes': 'That team usage writes nothing, which file\'s figures are in force — the approved copy — and what a file that is unapproved, differs, or cannot be read shows.',
  'usage/report': 'The team usage report: the header counts, each account and window line, the pace and ages, the per-team rows, and the why-lines.',
  'usage/restricted': 'Which caller reads the full or restricted view, and the closed list of fields the restricted view carries — never another team\'s name, root or rows.',
  'usage/json': 'What team usage --json prints: format 1, the counts, labs, accounts and notes — every key in both views, with the whole example document.',
  'usage/refusals': 'The two things that refuse team usage at exit 2 — a bad invocation, or an unreadable stores folder; everything else is a note at exit 0.',
};
const SITE_PAGES: Record<string, string> = {
  '/privacy/': 'How teamcli.io reaches you, and what stays in your browser.',
  '/docs/': 'Your first team in five minutes: install team, write .agents/team.yaml, approve it, and start the session.',
  '/docs/file/': 'Seven sections of .agents/team.yaml — the head, identity, workspace, machine, seats, watch and budgets — then the other fields the README names.',
  '/docs/commands/': 'Every command of team: what each reads and writes, who may run it, its refusals, its exit codes and its examples.',
  '/docs/safety/': 'Why team is safe to run: the owner outside herdr, the approved copy, and dialogs.trust: owner sends no key, coordinator may press it from its own seat.',
  '/docs/clis/': 'What team knows of claude-code, codex, cursor and antigravity: the launch profile, the sign-in check, and what it never writes.',
};

/** A description from the map above; a page that has none is a mistake, not a default. */
export function descriptionFor(path: string): string {
  const description = path === '/'
    ? packageLead()
    : path.startsWith('/docs/commands/') && path !== '/docs/commands/'
    ? DESCRIPTIONS[path.slice('/docs/commands/'.length, -1)]
    : SITE_PAGES[path];
  if (!description) throw new ReferenceError(`no description for ${path}`);
  return description;
}
