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
  { path: '/docs/commands/approve/read-back/', name: 'The read-back', summary: 'What approve prints: the whole file or a diff, the ceilings and seats, and what needs a new approval.' },
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
    .note(approvePart('what approve prints in full: when nothing changed, the ceilings and seats it fixes, and what needs a new approval.'))
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
    : name === 'approve'
    ? [
        page('/docs/commands/approve/', 'team approve — team', '0.8', approvePage(), APPROVE_FILES),
        page('/docs/commands/approve/who/', 'team approve: who may run it — team', '0.5', approveWho(), APPROVE_FILES),
        page('/docs/commands/approve/read-back/', 'team approve: the read-back — team', '0.5', approveReadBack(), APPROVE_FILES),
        page('/docs/commands/approve/record/', 'team approve: the signed record — team', '0.5', approveRecord(), APPROVE_FILES),
        page('/docs/commands/approve/refusals/', 'team approve: refusals — team', '0.5', approveRefusals(), APPROVE_FILES),
        page('/docs/commands/approve/overrides/', 'team approve: the overrides file — team', '0.5', approveOverrides(), APPROVE_FILES),
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
  'approve/read-back': 'What team approve prints back: the whole file or a per-section diff, the ceilings and seats it fixes, and which changes need a new approval.',
  'approve/record': 'The signed approval record: the key and per-project counter outside the store, the record\'s strict shape, and a record written before signing.',
  'approve/refusals': 'What refuses a team approve write: a seat or wrong delegate, a change needing the owner, --confirm\'s answer, and a line waiting on the terminal.',
  'approve/overrides': 'overrides.yaml beside the approval record: the dialog and quota patterns it may add to a shipped profile, and when team approve records it.',
  check: 'One answer to one question: is anything wrong with this team that someone should act on? It reads the file, approval, state and herdr.',
  commits: 'Checks a commit, or a range of commits, against the signature rule and forbidden patterns; exit 1 when a commit is refused.',
  pr: 'Checks a pull request body against the signature rule and forbidden patterns, needing no repository; exit 1 when refused.',
  doctor: 'What this machine still needs: the approval, herdr, each CLI, its version and login, each launch’s model, and the watch.',
  status: 'The team as it stands: one line per seat, and every difference between the file, the state and the live session, with its repair.',
  up: 'Starts the session, a workspace and each seat the file has not stopped, plus the watch; a stopped seat waits for team add. --dry-run prints the plan.',
  'up/launch': 'What team up does before it creates anything: the stopped session it clears, the lobby gate it verifies, and the folder each seat starts in.',
  'up/records': 'Every line a team up run prints — ready and left out — the close proofs, the rules delivery, and the table that says what each line means.',
  'up/waiting': 'The pause when a seat stops at a dialog: the owner\'s o, s and q keys, the proof of a waiting record, and runs without a terminal.',
  'up/limits': 'The windows a process of the same user still has in a team up launch: the waiting proof, the read-back and Enter, the rules folder chain.',
  'up/refusals': 'What stops a team up run before its first step: the owner and delegate gates, the approval, the lobby, the load — with the refused runs shown.',
  down: 'Stops the team: asks every free seat to exit, closes its workspace, stops the watch, and stops the session.',
  watch: 'Watches a running team: reports idle seats and nudges the operator, in one fixed line, into an empty idle prompt only.',
  add: 'Starts one declared seat, or a temporary one beside the team with --temporary --like <seat> --until <result:path|merged:branch>.',
  remove: 'Stops one seat and takes it out of the file; --keep leaves it stopped; --abandon is the owner’s, and types nothing.',
  worktree: 'Creates a task worktree from an up-to-date base, or removes one; the branch is never deleted.',
  answer: 'Presses the one recorded key of a seat\'s folder-trust dialog when the file allows it; every check has to pass, and anything else sends nothing.',
  release: 'Checks a release on npm and GitHub. When the file has the pairs: Linear milestone, qualifying status update, and the release marker in the public activity file.',
  usage: 'Shows one project’s budget accounts, windows, remaining usage, and when each figure was last read.',
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
