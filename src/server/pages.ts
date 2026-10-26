// Every page of the site, assembled from the reference at TEAM_REF.
//
// Nothing here retypes what the reference says. A page is built from named pieces of the
// README, the command pages and the docs under `docs/` — a section, a paragraph, a bullet,
// a sentence, a table row, a fenced block — and reference.ts throws when the reference no
// longer has one. So a ref that moved fails loudly here, in `bun test` and in docs:check,
// instead of quietly shipping a page that says something the package no longer does.
import { bullet, commandNames, commandPage, commandTable, fenceWith, paragraph, profileNames, section, sentence, README, ReferenceError } from './reference';
import { escapeHtml, fenceHtml, renderMarkdown, slug, type Fence, type Rendered } from './markdown';
import { contentReady, packageVersion, read, refInfo } from './team';
import { familiesOf, familyHref, familyPage, guideIndex, LABS, labHref, labPage, modelsOverview } from './models';

if (!contentReady()) throw new Error('content/team is missing: run `bun run content` (scripts/content.ts) first.');

export const info = refInfo();

/** The docs pages beside the command reference, as the reference ships them. */
const TEAM_FILE_DOC = read('docs/team-file.md');
const REGISTRY_DOC = read('docs/concepts/registry.md');
const COMMANDS_DOC = read('docs/commands/README.md');

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
 * The home page's samples: the shortest team record the reference shows, a plan a dry
 * run prints, and what `team status` reads back. Each is one whole fence of a tested
 * page, so the home page shows exactly what `bun test` runs.
 */
export function homeSamples(): Sample[] {
  const status = commandPage('status');
  const down = commandPage('down');
  return [
    { label: 'The team', caption: 'team config edit — the project\'s whole team, as YAML', fence: fenceWith(status, 'yaml', 'project: beacon') },
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

/** /docs/ — getting started: the install, where the team lives, the five minutes. */
export function gettingStarted(): Rendered {
  return new Doc()
    .h1('Getting started')
    .md(paragraph(README, '`team` is a small command-line tool'))
    .heading('Install')
    .md(section(README, 'Install'))
    .heading('Your first team in five minutes')
    .md(section(README, 'Your first team in five minutes'))
    .heading('The few ideas')
    .md(section(README, 'The few ideas'))
    .render();
}

/** The six sections docs/team-file.md documents, each its own page under /docs/config/. */
const FILE_SECTIONS: { path: string; heading: string; name: string; title: string; summary: string }[] = [
  { path: '/docs/config/tasks/', heading: '`tasks`', name: 'Tasks', title: 'Team configuration: tasks — team', summary: 'The team\'s one task source — a file the owner committed, or a tracker behind the owner\'s broker — and the policy that decides what crosses.' },
  { path: '/docs/config/seats/', heading: '`seats`', name: 'Seats', title: 'Team configuration: seats — team', summary: 'Each seat\'s model and launch, its label and the pane\'s two lines, and the effort word its lab allows.' },
  { path: '/docs/config/delivery-order/', heading: '`delivery_order`', name: 'Delivery order', title: 'Team configuration: delivery order — team', summary: 'The legs a send to a seat walks — native, mcp-inbox, typed — and how each level of the chain may drop or reorder them, never add one.' },
  { path: '/docs/config/grant/', heading: '`grant`', name: 'Grant', title: 'Team configuration: grant — team', summary: 'The one grant the owner gives the orchestrator\'s seat, its closed scope, and what each act in it admits.' },
  { path: '/docs/config/delegates/', heading: '`delegates`', name: 'Delegates', title: 'Team configuration: delegates — team', summary: 'Panes outside the team\'s session that may run some operational commands, and the allowlist guard on a delegated approval.' },
  { path: '/docs/config/tempo/', heading: 'tempo', name: 'Tempo', title: 'Team configuration: tempo — team', summary: 'Relaxed, normal or urgent: the word that scales the watch\'s idle and nudge waits, and when it takes effect.' },
];

/** /docs/config/ — the team’s configuration: the sections in the reference's own words, and the format by example. */
export function teamFile(): Rendered {
  const format = section(TEAM_FILE_DOC, "The record's format");
  const bullets = ['`session` names', '`in_project` names', '`coordinator` and `operator`', '`identity.signature`', '`seats[*].cli`', '`launch` is the plain command', '`workspace.mode` is']
    .map(startsWith => bullet(format, startsWith)).join('\n');
  const cards = FILE_SECTIONS.map(card =>
    `<a class="doc-entry" href="${card.path}"><span class="doc-entry__name">${escapeHtml(card.name)}</span><span class="doc-entry__summary">${escapeHtml(card.summary)}</span></a>`,
  ).join('');
  return new Doc()
    .h1('Team configuration')
    .md(paragraph(TEAM_FILE_DOC, 'Since 0.5.5 a team'))
    .heading('The sections')
    .raw(`<div class="doc-grid">${cards}</div>\n`)
    .heading('The format, by example')
    .md(paragraph(TEAM_FILE_DOC, 'A documented subset of YAML'))
    .block(fenceWith(format, 'yaml', 'format: 1'))
    .md(bullets)
    .heading('budgets')
    .md(paragraph(TEAM_FILE_DOC, '`budgets` is the owner\'s'))
    .md(paragraph(TEAM_FILE_DOC, '`examples/checks/codex-quota` is a check'))
    .block(fenceWith(format, 'yaml', 'openai:'))
    .heading('More fields')
    .md(paragraph(TEAM_FILE_DOC, 'More fields exist'))
    .render();
}

/** One section of docs/team-file.md as its own page, in the reference's own words. */
export function fileSectionPage(card: typeof FILE_SECTIONS[number]): Rendered {
  return new Doc()
    .h1(card.name)
    .note(`Part of <a href="/docs/config/">team configuration</a> — ${escapeHtml(card.summary)}`)
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
  const card = FILE_SECTIONS.find(entry => entry.path === '/docs/config/delivery-order/')!;
  const rules = [
    bullet(whole, 'The word is one or more of'),
    bullet(whole, 'The receiving seat\'s chain is read outermost first'),
    bullet(whole, 'What a walk does with each leg'),
  ].join('\n');
  return new Doc()
    .h1(card.name)
    .note(`Part of <a href="/docs/config/">team configuration</a> — ${escapeHtml(card.summary)}`)
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
 * otherwise the page's own "Who may run it" — each caller its table admits, or the
 * section's first sentence. A command whose page carries neither keeps an empty line.
 */
function whoFor(name: string, row: ReturnType<typeof commandTable>[number] | undefined): string {
  if (row?.who) return row.who;
  const page = commandPage(name);
  if (!page.includes('## Who may run it')) return '';
  const who = section(page, 'Who may run it');
  // Each caller the table admits, in its order: a row whose answer is nothing or a refusal is left out.
  const callers = who.split('\n').filter(line => line.startsWith('|')).slice(2)
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
    .filter(([caller, may = '']) => caller && !/does not admit|no terminal/.test(caller) && !/^(nothing|a real run is refused|refused)/.test(may))
    .map(([caller]) => caller!);
  return callers.length ? callers.join('; ') : firstSentence(who);
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
  return new Doc().h1('Commands').md(paragraph(COMMANDS_DOC, 'One page per command')).raw(`<div class="doc-grid">${cards.join('')}</div>\n`).render();
}

/**
 * The pointer to a command's private docs page, which the site never names or links.
 * Only some compact command pages carry it; one that still links anywhere under
 * `docs/internal` after the strip stops the build.
 */
export function withoutInternal(markdown: string): string {
  // The closing "Rationale…" paragraph that points at docs/internal (one or two links, on
  // one or more lines) is dropped whole; a link to it inside prose keeps its words, unlinked.
  const stripped = markdown
    .replace(/\n*Rationale[^\n]*(?:\n[^\n]+)*?\]\(\.\.\/internal\/[a-z-]+\.md\)\.\s*$/g, '\n')
    .replace(/\[([^\]]+)\]\(\.\.\/internal\/[a-z-]+\.md(?:#[a-z0-9-]+)?\)/g, (_, text: string) => /docs\/internal/.test(text) ? '' : text);
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

/**
 * /docs/whats-new/ — the README's own "What's new in <version>" section, whichever version
 * the ref is. The heading is found, never typed, so a new release brings its own notes.
 */
export function whatsNew(): Rendered {
  const heading = README.split('\n').find(line => /^## What's new in /.test(line));
  if (!heading) throw new ReferenceError('the team reference at TEAM_REF no longer has a "What\'s new in …" section');
  const title = heading.slice(3).trim();
  return new Doc()
    .h1('What’s new')
    .heading(title)
    .md(section(README, title))
    .md('Every change, release by release, is in [the changelog](CHANGELOG.md).')
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
  const watch = commandPage('watch');
  const grant = paragraph(section(TEAM_FILE_DOC, '`grant`'), 'Records the grant the owner gives the orchestrator\'s seat');
  const delegates = paragraph(section(TEAM_FILE_DOC, '`delegates`'), 'Names panes outside the team\'s session');
  const never = [
    sentence(TEAM_FILE_DOC, 'Nothing writes a lab\'s config'),
    sentence(TEAM_FILE_DOC, 'A write that does not validate is refused whole'),
    sentence(README, 'Approvals guard against mistakes'),
  ];
  return new Doc()
    .h1('Safety')
    .heading('The owner')
    .md(paragraph(README, '**Owner, grants, policies.**'))
    .md(section(up, 'Who may run it'))
    .heading('The team lives in the registry')
    .md(paragraph(README, 'The team lives in this machine\'s registry'))
    .heading('Grants and delegates, the owner\'s alone')
    .md(grant)
    .md(delegates)
    .heading('What team never does')
    .md(never.map(text => `- ${text}`).join('\n'))
    .note(inline(sentence(TEAM_FILE_DOC, 'Launching a Cursor seat')))
    .note(inline(sentence(watch, 'A screen hatch is an escape hatch')))
    .heading('Who may run what')
    .table('Who may run each command', ['Command', 'Who may run it'], commandNames().map(name => [`<code>team ${name}</code>`, inline(whoFor(name, commandTable().find(row => row.name === name)))]))
    .heading('What this version builds')
    .md(paragraph(README, '`team` is a small command-line tool'))
    .render();
}

/**
 * The screen-reading launch profiles the build ships, and what the page shows of each
 * profile's screen. A profile's commands and flags — its binary, its `unattended` list, its
 * sign-in check or hint, its tested range — are read from `src/profiles/<cli>.yaml` and never
 * retyped. The ready and working words are the page's spelling of what the profile's own
 * matchers carry, and each is checked against its matcher, so a profile that stops painting
 * them stops the build. Jules is handled apart: its TUI is read by a screen module, not these
 * composer/working matchers, so it carries none of the needles below.
 */
interface LaunchProfile {
  cli: string;
  /** How the profile reads a ready seat, and a fragment of its composer's prompt pattern. */
  ready: string;
  promptNeedle: string;
  /** The words of the profile's working frame, and a fragment of the matcher that reads it. */
  working: string;
  workingNeedle: string;
}

const PROFILES: LaunchProfile[] = [
  { cli: 'claude-code', ready: 'at its <code>❯</code> prompt box', promptNeedle: '❯', working: '<code>esc to interrupt</code>', workingNeedle: 'esc to interrupt' },
  { cli: 'codex', ready: 'at its <code>›</code> prompt', promptNeedle: '›', working: '<code>esc to interrupt</code>', workingNeedle: 'esc to interrupt' },
  { cli: 'cursor', ready: 'at its <code>→</code> prompt', promptNeedle: '→', working: '<code>ctrl+c to stop</code>', workingNeedle: 'ctrl\\+c to stop' },
  { cli: 'antigravity', ready: 'at its <code>&gt;</code> prompt', promptNeedle: '>', working: '<code>Generating...</code>', workingNeedle: 'Generating' },
  { cli: 'grok', ready: 'at its boxed <code>❯</code>', promptNeedle: '❯', working: '<code>[stop]</code>', workingNeedle: '\\[stop\\]' },
  { cli: 'gemini', ready: 'at its <code>*</code> or <code>&gt;</code> prompt in the box', promptNeedle: '[>*]', working: '<code>esc to cancel</code>', workingNeedle: 'esc to cancel' },
  { cli: 'muse', ready: 'at its <code>❯</code> prompt', promptNeedle: '❯', working: '<code>esc to interrupt</code>', workingNeedle: 'esc to interrupt' },
];

/**
 * A block of a profile's YAML: the lines under `key:` where it sits at `indent`, up to the
 * next key at that indent or shallower. Blank lines and comments stay in the block.
 */
function profileBlock(profile: string, cli: string, key: string, indent: number): string {
  const lines = profile.split('\n');
  const start = lines.findIndex(line => new RegExp(`^ {${indent}}${key}:`).test(line));
  if (start < 0) throw new ReferenceError(`src/profiles/${cli}.yaml no longer carries "${key}:"`);
  const stop = new RegExp(`^ {0,${indent}}(?!#)\\S`);
  const end = lines.findIndex((line, index) => index > start && stop.test(line));
  return lines.slice(start, end < 0 ? lines.length : end).join('\n');
}

/** The `- item` lines of a YAML block: the flags of an `unattended` list, the words of a `login.check`. */
function profileList(block: string): string[] {
  return block.split('\n').map(line => /^[ \t]*-[ \t]+(\S.*?)[ \t]*$/.exec(line)?.[1]).filter((item): item is string => item !== undefined);
}

/**
 * One screen profile's facts, read by name from `src/profiles/<cli>.yaml`: the binary it
 * launches, the flags its `unattended` list adds, its tested range, how its rules reach the
 * seat (a flag, or the first message), the flag that sets its model, and its sign-in — the
 * check, run as `<binary> <login.check>`, or, for a profile that carries none, the hint alone.
 * A value the profile stops carrying stops the build, as a moved reference does everywhere else.
 */
function launchFacts(profile: LaunchProfile): { binary: string; unattended: string[]; tested: string; check: string | null; hint: string; rules: string | null; model: string | null } {
  const { cli } = profile;
  let yaml: string;
  try {
    yaml = read(`src/profiles/${cli}.yaml`);
  } catch {
    throw new ReferenceError(`src/profiles/${cli}.yaml is gone: the page describes every profile the build ships`);
  }
  const need = (value: string | undefined, what: string): string => {
    if (!value) throw new ReferenceError(`src/profiles/${cli}.yaml no longer carries ${what}`);
    return value;
  };
  const binary = need(/^binary:[ \t]+(\S+)[ \t]*$/m.exec(yaml)?.[1], 'a binary:');
  const unattended = profileList(profileBlock(yaml, cli, 'unattended', 0));
  if (!unattended.length) throw new ReferenceError(`src/profiles/${cli}.yaml's unattended: list is empty`);
  const tested = profileBlock(yaml, cli, 'tested', 0);
  const from = need(/^[ \t]+from:[ \t]*'?([^'\n]+?)'?[ \t]*$/m.exec(tested)?.[1], 'a tested.from version');
  const to = need(/^[ \t]+to:[ \t]*'?([^'\n]+?)'?[ \t]*$/m.exec(tested)?.[1], 'a tested.to version');
  const login = profileBlock(yaml, cli, 'login', 0);
  const hint = need(/^[ \t]+hint:[ \t]*(.+?)[ \t]*$/m.exec(login)?.[1], 'a login.hint');
  const check = /^[ \t]+check:/m.test(login) ? `${binary} ${profileList(profileBlock(login, cli, 'check', 2)).join(' ')}` : null;
  const rulesBlock = profileBlock(yaml, cli, 'rules', 0);
  const rules = /^[ \t]+option:[ \t]*(\S+)[ \t]*$/m.exec(rulesBlock)?.[1] ?? null;
  if (rules === null && !/^rules:[ \t]*first-message[ \t]*$/m.test(rulesBlock)) throw new ReferenceError(`src/profiles/${cli}.yaml's rules: is neither a flag nor first-message`);
  const model = profileList(profileBlock(profileBlock(yaml, cli, 'models', 0), cli, 'option', 2))[0] ?? null;
  const screen = profileBlock(yaml, cli, 'screen', 0);
  if (!profileBlock(screen, cli, 'composer', 2).includes(profile.promptNeedle)) throw new ReferenceError(`src/profiles/${cli}.yaml's composer no longer paints "${profile.promptNeedle}"`);
  if (!profileBlock(screen, cli, 'working', 2).includes(profile.workingNeedle)) throw new ReferenceError(`src/profiles/${cli}.yaml's working frame no longer carries "${profile.workingNeedle}"`);
  return { binary, unattended, tested: from === to ? to : `${from} to ${to}`, check, hint, rules, model };
}

/** /docs/clis/ — every launch profile `team` ships, from the reference. */
export function clis(): Rendered {
  const doctor = commandPage('doctor');
  const watch = commandPage('watch');
  const login = paragraph(doctor, '`--login` reads the logins alone');
  const facts = PROFILES.map(profile => ({ profile, ...launchFacts(profile) }));
  // Up to 0.5.0 the README's login paragraph named every profile's check command, and this
  // held the table to it. From 0.5.3 the doctor page states the rule and each command comes
  // from the profile's own YAML (launchFacts), so a named check is held only where the prose names one.
  for (const { check } of facts) {
    if (check && /`[a-z-]+ [a-z]+`/.test(login) && !login.includes(check)) throw new ReferenceError(`the login paragraph no longer names "${check}"`);
  }
  // The table is the whole set of launch profiles the build ships, and only those — the seven
  // screen CLIs above plus Jules, read apart below. This stops on a profile the page misses and
  // on a line for one the build dropped; and it stops on Kimi, which the notes call not a seat
  // kind, should it ever ship a profile.
  const shipped = profileNames();
  const described = [...facts.map(fact => fact.profile.cli), 'jules'];
  for (const cli of described) {
    if (!shipped.includes(cli)) throw new ReferenceError(`the build no longer ships a launch profile for "${cli}": the page describes a CLI it cannot launch`);
  }
  for (const cli of shipped) {
    if (!described.includes(cli)) throw new ReferenceError(`the build ships a launch profile for "${cli}" the page does not describe: give it a line in PROFILES and a section of its own`);
    if (/kimi/.test(cli)) throw new ReferenceError(`the build now ships a launch profile for "${cli}": the "Not seat kinds yet" section is stale`);
  }
  // The two pieces of the team file reference (the README's until 0.5.0) the "Other labs" note leans on: its own example of a launcher
  // on the PATH, and the field that says the launcher picks the model.
  for (const piece of ['a launcher on the PATH', 'model_from: launcher']) {
    if (!TEAM_FILE_DOC.includes(piece)) throw new ReferenceError(`docs/team-file.md no longer says "${piece}"`);
  }
  const factOf = (cli: string): (typeof facts)[number] => {
    const found = facts.find(fact => fact.profile.cli === cli);
    if (!found) throw new ReferenceError(`the page has no line for "${cli}"`);
    return found;
  };
  const modelFlag = (cli: string): string => {
    const flag = factOf(cli).model;
    if (!flag) throw new ReferenceError(`src/profiles/${cli}.yaml no longer carries a model option: the page shows it`);
    return flag;
  };
  const ruleFlag = (cli: string): string => {
    const flag = factOf(cli).rules;
    if (!flag) throw new ReferenceError(`src/profiles/${cli}.yaml no longer carries a rules option: the page shows it`);
    return flag;
  };
  // Grok's models as Cursor seats: Cursor's own model list carries one, with the flag that
  // selects it, and Cursor reads the running model off its own status row. Read by name.
  const cursor = read('src/profiles/cursor.yaml');
  const grokInCursor = /model: Grok\n[ \t]+version: '([^']+)'\n[ \t]+flag: (\S+)/.exec(cursor);
  if (!grokInCursor) throw new ReferenceError('src/profiles/cursor.yaml no longer carries a Grok model in its ids: list');
  if (!profileBlock(cursor, 'cursor', 'status_model', 0).includes('Grok')) throw new ReferenceError('src/profiles/cursor.yaml no longer reads a Grok model off its status row');
  // Grok's own model reading: off the composer footer, and the launch line where none is read.
  const grok = read('src/profiles/grok.yaml');
  if (!profileBlock(grok, 'grok', 'status_model', 0).includes('Grok')) throw new ReferenceError('src/profiles/grok.yaml no longer reads its model off the composer footer');
  if (!/^unread_model:[ \t]*launch[ \t]*$/m.test(grok)) throw new ReferenceError('src/profiles/grok.yaml no longer falls back to the launch line\'s model when none is read');
  // Gemini and Muse take their rules as a first message and carry no non-interactive login
  // check: a profile that gains a rules flag or a check: field must not keep the sentences the
  // notes build on, so each is tied to the field it reads.
  for (const cli of ['gemini', 'muse']) {
    if (factOf(cli).rules) throw new ReferenceError(`src/profiles/${cli}.yaml now carries a rules option: the page says its rules ride the first message`);
    if (factOf(cli).check !== null) throw new ReferenceError(`src/profiles/${cli}.yaml now carries a login check: the page says it has none`);
  }
  const noCheck = 'the login is not checked in this version';
  if (!read('src/commands/doctor.ts').includes(noCheck)) throw new ReferenceError(`the doctor no longer prints "${noCheck}": the Gemini and Muse notes quote it`);
  // The two reference-sourced facts the Muse note carries beyond its profile fields: the account
  // it names (`account: meta`) and that the account shows only in the CLI's own /status.
  const muse = read('src/profiles/muse.yaml');
  if (!muse.includes('account: meta')) throw new ReferenceError('src/profiles/muse.yaml no longer carries `account: meta`: the Muse note names a Meta account');
  if (!muse.includes('/status')) throw new ReferenceError('src/profiles/muse.yaml no longer records that the account shows in /status: the Muse note says so');
  const claudeYields = /yields: \[([^\]]*)\]/.exec(profileBlock(read('src/profiles/claude-code.yaml'), 'claude-code', 'status_model', 0))?.[1]?.split(',').map(name => name.trim()) ?? [];
  const families = ['Opus', 'Sonnet', 'Haiku', 'Fable'];
  if (claudeYields.length !== families.length || !families.every(family => claudeYields.includes(`Claude ${family}`))) {
    throw new ReferenceError('src/profiles/claude-code.yaml\'s status_model no longer names exactly Opus, Sonnet, Haiku and Fable: the "Other labs" note says it does');
  }
  // Jules, read by name — its TUI carries no auto-approve flag and no composer/working matchers,
  // so it is read apart from the screen profiles above, with its own quirks guarded.
  const julesYaml = read('src/profiles/jules.yaml');
  const julesNeed = (value: string | undefined, what: string): string => {
    if (!value) throw new ReferenceError(`src/profiles/jules.yaml no longer carries ${what}`);
    return value;
  };
  const julesBinary = julesNeed(/^binary:[ \t]+(\S+)[ \t]*$/m.exec(julesYaml)?.[1], 'a binary:');
  const julesTestedBlock = profileBlock(julesYaml, 'jules', 'tested', 0);
  const julesFrom = julesNeed(/^[ \t]+from:[ \t]*'?([^'\n]+?)'?[ \t]*$/m.exec(julesTestedBlock)?.[1], 'a tested.from version');
  const julesTo = julesNeed(/^[ \t]+to:[ \t]*'?([^'\n]+?)'?[ \t]*$/m.exec(julesTestedBlock)?.[1], 'a tested.to version');
  const julesTested = julesFrom === julesTo ? julesTo : `${julesFrom} to ${julesTo}`;
  if (profileList(profileBlock(julesYaml, 'jules', 'unattended', 0)).length) throw new ReferenceError("src/profiles/jules.yaml's unattended list is no longer empty: the Jules note says the TUI has no auto-approve flag");
  if (!/^rules:[ \t]*prepend[ \t]*$/m.test(julesYaml)) throw new ReferenceError("src/profiles/jules.yaml no longer rides its rules with `rules: prepend`");
  if (!/^herdr_status:[ \t]*unreliable[ \t]*$/m.test(julesYaml)) throw new ReferenceError("src/profiles/jules.yaml no longer marks its herdr status unreliable");
  if (!julesYaml.includes('answers no `--version`')) throw new ReferenceError('src/profiles/jules.yaml no longer records that the binary answers no --version');
  const julesStanding = julesNeed(profileList(profileBlock(julesYaml, 'jules', 'standing_rules', 0)).find(rule => /Never delete a Jules session/.test(rule)), 'its standing rule against deleting a session');
  const julesHint = julesNeed(/^[ \t]+hint:[ \t]*(.+?)[ \t]*$/m.exec(profileBlock(julesYaml, 'jules', 'login', 0))?.[1], 'a login.hint');

  const flagsCode = (cli: string): string => factOf(cli).unattended.map(flag => `<code>${escapeHtml(flag)}</code>`).join(' ');
  const rows = facts.map(({ profile, binary, unattended, check, hint }) => [
    `<code>${escapeHtml(profile.cli)}</code>`,
    `<code>${escapeHtml(binary)}</code>`,
    unattended.map(flag => `<code>${escapeHtml(flag)}</code>`).join(' '),
    `ready ${profile.ready}; working on ${profile.working}`,
    check ? `<code>${escapeHtml(check)}</code>` : `none — the hint is <code>${escapeHtml(hint)}</code>`,
  ]);
  rows.push([
    '<code>jules</code>',
    `<code>${escapeHtml(julesBinary)}</code>`,
    'none',
    'its session table, read by a screen module; herdr’s status is unreliable, so an idle table counts as free',
    `none — the hint is <code>${escapeHtml(julesHint)}</code>`,
  ]);

  // The file's-format bullet names the profiles available today and says `team doctor` reports
  // what the others still need; the table shows all eight. A bridging note reconciles the two —
  // the three the table adds are those others. The split is guarded against the bullet and the
  // shipped set, so it cannot silently go stale.
  const formatBullet = bullet(section(TEAM_FILE_DOC, "The record's format"), '`seats[*].cli`');
  const availableClis = ['claude-code', 'codex', 'cursor', 'antigravity', 'grok'];
  const otherClis = ['gemini', 'muse', 'jules'];
  for (const cli of availableClis) if (!formatBullet.includes(`\`${cli}\``)) throw new ReferenceError(`the file's-format bullet no longer lists "${cli}" among the available profiles`);
  for (const cli of otherClis) if (formatBullet.includes(`\`${cli}\``)) throw new ReferenceError(`the file's-format bullet now lists "${cli}": the bridging note calls it one of the others team doctor reports`);
  if (JSON.stringify([...availableClis, ...otherClis].sort()) !== JSON.stringify(profileNames())) throw new ReferenceError('the available/others split no longer covers exactly the shipped launch profiles');

  return new Doc()
    .h1('Supported CLIs')
    .md(formatBullet)
    .table(
      'Every launch profile the build ships: the command, the flags the profile adds, the words it reads on the pane, and the sign-in check',
      ['CLI', 'Binary', 'Unattended', 'Reads the screen', 'Sign-in check'],
      rows,
    )
    // The table shows all eight; the format bullet names five as available. The three it adds —
    // gemini, muse, jules — are the "others" the bullet points team doctor at.
    .note(`The format bullet above names the profiles available today; the three the table adds beyond them — <code>gemini</code>, <code>muse</code> and <code>jules</code> — are the others <code>team doctor</code> reports on.`)
    // How the pane is read at all, in the watch page's own words; the per-CLI words above are
    // the profile's, and the two sentences hold for every profile the table lists.
    .md(sentence(watch, "A pane's screen is read by the profile's own expressions"))
    .md(sentence(watch, 'A screen that reproduces a CLI'))
    .md(login)
    .block(fenceWith(doctor, 'console', 'team doctor --login'))
    .heading('Codex')
    .md(paragraph(TEAM_FILE_DOC, 'The Codex profile is tested with CLI 0.157.0'))
    .heading('Antigravity')
    .md(paragraph(TEAM_FILE_DOC, 'The Antigravity profile is tested with CLI 1.2.16'))
    // The model flag is read from antigravity.yaml by name; the reference carries no prose about
    // which models it serves, so the page claims none.
    .note(`The Antigravity profile sets its model with <code>${escapeHtml(modelFlag('antigravity'))}</code>.`)
    .heading('Cursor')
    .md(paragraph(TEAM_FILE_DOC, 'Launching a Cursor seat'))
    .heading('Grok')
    // Grok has no README prose section; its lines are read from grok.yaml by name (above), and
    // the Cursor alternative from cursor.yaml, so the page cannot claim a model it does not read.
    .note(`The Grok profile is tested with CLI ${escapeHtml(factOf('grok').tested)}, runs unattended with ${flagsCode('grok')}, rides its rules on the launch line as <code>${escapeHtml(ruleFlag('grok'))}</code>, and sets its model with <code>${escapeHtml(modelFlag('grok'))}</code>. It reads the running model off the composer’s footer line — the model’s name, <code>Grok Fast</code> for the fast one, and the version the footer carries — and a screen that names no model, as behind a question widget, falls back to the launch line’s own model, labelled. Grok’s models also run as Cursor seats: Cursor’s own model list carries the Grok model — <code>${escapeHtml(grokInCursor[2]!)}</code> is <code>Grok ${escapeHtml(grokInCursor[1]!)}</code> — and Cursor reads the running model off its own status row.`)
    .heading('Gemini')
    // Every fact here is the profile's own: its tested range, its unattended flag, its
    // first-message rules, and a login with a hint and no check.
    .note(`The Gemini profile is tested with CLI ${escapeHtml(factOf('gemini').tested)}, runs unattended with ${flagsCode('gemini')}, and takes its rules as the seat’s first message. It has no non-interactive login check, so <code>team doctor --login</code> notes <code>gemini: the login is not checked in this version</code>, and the profile’s sign-in hint is <code>${escapeHtml(factOf('gemini').hint)}</code>.`)
    .heading('Muse')
    // Every fact here is the profile's own: its tested range, its unattended flag, its
    // first-message rules, a login with a hint and no check, and the Meta account the profile
    // names, which shows only in the CLI's own /status.
    .note(`The Muse profile is tested with CLI ${escapeHtml(factOf('muse').tested)}, runs unattended with ${flagsCode('muse')}, and takes its rules as the seat’s first message. It has no non-interactive login check — <code>team doctor --login</code> notes <code>muse: the login is not checked in this version</code> — its Meta account shows only inside the CLI’s own <code>/status</code>, and the sign-in hint is <code>${escapeHtml(factOf('muse').hint)}</code>.`)
    .heading('Jules')
    // Jules is a seat kind at this build. Its facts are read from jules.yaml by name (above);
    // the TUI has no auto-approve flag and herdr cannot read its pane, so its line reads apart.
    .note(`The Jules profile is tested with CLI ${escapeHtml(julesTested)}. Its TUI has no auto-approve flag, so a Jules seat runs unattended through the profile’s own screen walk, not a flag; its rules ride each brief as <code>rules: prepend</code>, and a standing rule — <em>${escapeHtml(julesStanding)}</em> — rides every brief too, because the TUI’s delete removes the session for the whole account. herdr reports a Jules pane unreliably, so the screen module is the reading: an idle session table counts as free. The <code>jules</code> binary answers no <code>--version</code>, so <code>team doctor</code> reads its version unread. The sign-in hint is <code>${escapeHtml(julesHint)}</code>.`)
    .heading('Other labs through Claude Code')
    // The one way another lab runs here, in the owner's docs task's words: any Anthropic-compatible
    // endpoint as a claude-code seat whose `launch:` is a small launcher on the PATH. The example
    // is generic on purpose — no script name, path, account or key name of anybody's.
    .note(`Any Anthropic-compatible endpoint runs as a Claude Code seat — DeepSeek, Z.ai GLM and Kimi Coding are examples. The seat’s <code>launch:</code> names a small launcher script on the PATH instead of the CLI: it points the CLI at the lab’s base URL, reads that account’s API key from the OS keychain — never from the team file — and hands the CLI the arguments it was given. One line is the whole difference, beside <code>cli: claude-code</code>: <code>launch: my-lab-claude</code>. The team file’s own example carries this shape, and <code>model_from: launcher</code> says the launcher picks the model — nothing on the screen can, since Claude Code reads only Opus, Sonnet, Haiku and Fable off its own screen: the seat’s label on <code>team status</code> comes from the file’s <code>display</code>, not the screen.`)
    .heading('Not seat kinds yet')
    // Kimi is the one the page deliberately leaves out, from the owner's docs task; the loop
    // above stops the build the day it ships a launch profile.
    .note(`The native Kimi CLI is not a seat kind in this build: it has no launch profile, so it cannot be a seat. Kimi’s models run here as Claude Code seats instead, through an Anthropic-compatible endpoint.`)
    .render();
}

// ---------------------------------------------------------------- the site's own list

export interface NavGroup { label: string; href?: string; items: { name: string; href: string }[] }
export interface PageMeta extends Rendered {
  path: string; title: string; description: string; priority: string; section: string; nav: NavGroup[]; files: string[];
}

/** The three sections of the site, in the top navigation's order. */
export const SECTIONS = ['Models', 'Documentation', 'Guide'] as const;
export type Section = typeof SECTIONS[number];
/** The landing of each section: the href the top-navigation link points at, and where a page's section is read back from its path. */
export const SECTION_HOME: Record<Section, string> = { Models: '/models/', Documentation: '/docs/', Guide: '/guide/' };

/** The section a path belongs to: its top-navigation home, and the sidebar it carries. */
export function sectionOf(path: string): Section {
  if (path.startsWith('/models/')) return 'Models';
  if (path.startsWith('/guide/')) return 'Guide';
  return 'Documentation';
}

/** The sidebar groups for one section. Each section has its own; the top navigation chooses which shows. */
export function navFor(section: Section): NavGroup[] {
  if (section === 'Models') {
    return [
      { label: 'Models', items: [{ name: 'Overview', href: '/models/' }] },
      ...LABS.map(lab => ({
        label: lab.name,
        href: labHref(lab.slug),
        // The sidebar names families, never versions — the version detail lives on each family's page.
        items: familiesOf(lab.vendor).map(family => ({ name: family.name, href: familyHref(lab.slug, family.slug) })),
      })),
    ];
  }
  if (section === 'Guide') {
    return [{ label: 'Guide', items: [{ name: 'Overview', href: '/guide/' }] }];
  }
  return [
    {
      label: 'Documentation',
      items: [
        { name: 'Getting started', href: '/docs/' },
        { name: 'Team configuration', href: '/docs/config/' },
        { name: 'The registries', href: '/docs/concepts/registry/' },
        { name: 'What’s new', href: '/docs/whats-new/' },
        { name: 'Safety', href: '/docs/safety/' },
        { name: 'Supported CLIs', href: '/docs/clis/' },
      ],
    },
    {
      label: 'Commands',
      items: [{ name: 'Overview', href: '/docs/commands/' }, ...commandNames().map(name => ({ name: `team ${name}`, href: `/docs/commands/${name}/` }))],
    },
  ];
}

/** The Documentation sidebar, kept as `nav` for the pages and checks that name it directly. */
export const nav: NavGroup[] = navFor('Documentation');
/** The reading order within the Documentation section, for the previous and next links under a page. */
export const readingOrder = nav.flatMap(group => group.items);

/** The page list: every public page, its content, and the sources its lastmod is read from. */
export function pages(): PageMeta[] {
  const page = (path: string, title: string, priority: string, content: Rendered, files: string[]): PageMeta => {
    const section = sectionOf(path);
    return { path, title, description: descriptionFor(path), priority, section, nav: navFor(section), files, ...content };
  };
  // Models: the overview — "Set up your agents" first, then the matrix — one page per lab, the
  // overview of its families and routes, and one page per family, holding the versions with
  // their figures. All read from the catalog and the dated figures file beside it.
  const modelFiles = ['src/server/models.ts', 'src/data/models.json', 'src/data/model-figures.json', 'scripts/refresh-model-figures.ts'];
  const models = [
    page('/models/', 'Models — team', '0.9', modelsOverview(), modelFiles),
    ...LABS.flatMap(lab => [
      page(labHref(lab.slug), `${lab.name} — team`, '0.7', labPage(lab.slug), modelFiles),
      ...familiesOf(lab.vendor).map(family => page(familyHref(lab.slug, family.slug), `${family.name} — team`, '0.6', familyPage(lab.slug, family.slug), modelFiles)),
    ]),
  ];
  const group = [
    page('/docs/', 'Getting started — team', '0.9', gettingStarted(), ['src/server/pages.ts']),
    page('/docs/config/', 'Team configuration — team', '0.8', teamFile(), ['src/server/pages.ts']),
    ...FILE_SECTIONS.map(card => page(card.path, card.title, '0.6', card.path === '/docs/config/delivery-order/' ? deliveryOrderPage() : fileSectionPage(card), ['src/server/pages.ts'])),
    page('/docs/concepts/registry/', 'The agent, team and project registries — team', '0.7', registryPage(), ['src/server/pages.ts']),
    page('/docs/commands/', 'Commands — team', '0.9', commandIndex(), ['src/server/pages.ts']),
    page('/docs/whats-new/', 'What’s new — team', '0.8', whatsNew(), ['src/server/pages.ts', 'content/team/README.md']),
    page('/docs/safety/', 'Safety — team', '0.7', safety(), ['src/server/pages.ts']),
    page('/docs/clis/', 'Supported CLIs — team', '0.7', clis(), ['src/server/pages.ts']),
  ];
  // Every command is the one page the reference gives it, in the table's order.
  const commands = commandNames().map(name =>
    page(`/docs/commands/${name}/`, `team ${name} — team`, '0.8', commandPageContent(name), [`content/team/docs/commands/${name}.md`]));
  // Guide: the section's index; its first guides come later.
  const guide = [page('/guide/', 'Guide — team', '0.6', guideIndex(), ['src/server/models.ts'])];
  return [...models, ...group, ...commands, ...guide];
}

/**
 * A command page's description: the site's own words, because a page's first sentence
 * runs past what a search result shows. The page's body is the reference; this is the
 * signpost to it. docs:check holds each to one line of at most 160 characters.
 */
const DESCRIPTIONS: Record<string, string> = {
  ack: 'Marks a message record read without printing it: the same signed read receipt team messages publishes, written once in the addressee’s own folder.',
  archive: 'Snapshots the team — the team’s configuration, the state and the send queues — into one archive folder, then stops it with team down in the same run.',
  brief: 'Delivers TeamCLI’s general seat brief to the team’s declared seats without a launch: the built-in first text every seat gets.',
  bus: 'Runs the process that owns the project’s event log, reconciles durable message and seat records, and serves publish and subscribe on the bus socket.',
  client: 'The app-key side of a client grant: keygen writes one Ed25519 pair for a client app, the private half mode 0600, and never replaces it.',
  config: 'The settings registry: each setting TeamCLI knows, the levels it may be set at, what it accepts, its release default and when a change takes effect.',
  daemon: 'The one machine-wide TeamCLI daemon: one process serves every team and checkout on this machine over the one machine socket.',
  'development-mode': 'Reads or sets the one machine-wide development mode — local-fast, pr-per-change or off — that governs the caller gates and owner-gate admission.',
  drops: 'Lists the drop files waiting in the calling seat’s own drop folder: each one signed message record another seat’s team send left there.',
  import: 'Legacy: makes a leftover .agents/team.yaml this team’s registry record — the repair check and status name, or the first import without migrate.',
  migrate: 'Moves this team’s definition from .agents/team.yaml into the registry, once; every command then reads the team from the registry.',
  'owner-seat': 'Sets up the owner’s own seat: an agent runs it on the owner’s behalf, and every step that needs the owner ends in a native prompt on their device.',
  pause: 'Stops the whole team, or one seat, taking new work: kept in the team state, never the configuration; ongoing work finishes and nothing new is claimed.',
  queue: 'Adds one record to the team’s local task queue, or lists it: the task source when the team declares none.',
  raise: 'A lead’s own line to the owner, delivered at once: release.ready when a release needs the owner’s go, decision.needed when a call is theirs.',
  reply: 'Answers the sender of a message record, or closes its thread: one signed record in the seat it answers, on the same thread.',
  resume: 'Clears the pause team pause placed, for the team or one seat: team next claims again and the watch dispatches work to idle seats.',
  seat: 'One seat as an object: its settings and where each value comes from, its team seats row, its last turn and its newest recorded session.',
  sessions: 'Lists the sessions TeamCLI recorded for each seat: one append-only record per CLI session, written by the launch and stop commands themselves.',
  settings: 'One seat’s settings, each with where its value comes from: a signed record at the seat, team, project or entity level, the team’s configuration or the default.',
  swap: 'Brings a seat back within the entity’s model rule: it takes the model fields of a donor seat that already runs an allowed model.',
  workflow: 'Checks, dry-runs or replays a workflow definition: its schema, its transition graph, reachability, ordering and hook effects.',
  init: 'Writes a new team into the registry: a skeleton record for this project, or with --restore the copy this machine stored; never a file.',
  commits: 'Checks a commit, or a range of commits, against the signature rule and forbidden patterns; exit 1 when a commit is refused.',
  pr: 'Checks a pull request body against the signature rule and forbidden patterns, needing no repository; exit 1 when refused.',
  doctor: 'What this machine still needs: herdr, each CLI, its version and login, each launch’s model, and the watch.',
  status: 'The team as it stands: one line per seat, every difference between the team’s configuration, the state and the live session, and each repair.',
  list: 'The herdr sessions on this machine, the running ones by default; --all includes stopped sessions, and nothing is changed.',
  projects: 'The projects this machine’s registry holds: each immutable id, display name, entity, lead by agent id and teams; --json prints them.',
  up: 'Starts the session, a workspace and each seat the team declares, plus the watch; --dry-run prints the plan and the refusals.',
  down: 'Stops the team: asks every free seat to exit, closes its workspace, stops the watch, and stops the session.',
  hold: 'A note on the team’s work — why, who and until when — kept in the state, printed first by team status and last by team doctor.',
  watch: 'Watches a running team: reports idle seats and nudges the operator, in one fixed line, into an empty idle prompt only.',
  tempo: 'Sets the team’s tempo to relaxed, normal or urgent, which scales the watch’s idle and nudge waits; normal is the key left out.',
  messages: 'Verifies a message that is already waiting, prints its body and writes the receipt; no command writes a message record.',
  send: 'Writes one message to one seat: the body in a 0600 drop file, one trigger line, and the seat’s delivery order deciding the channel.',
  issues: 'Lists the typed records in the one file the team names: file order, priorities shown and not reordering, nothing claimed.',
  next: 'Claims one record from the team’s one task source, with a lease in this clone; the source is a file the owner committed or a broker’s read.',
  plan: 'Prints the queue a claim would consider, in the order team next would consider it; it claims nothing and writes no lease.',
  broker: 'Holds the tracker credential and answers team next over a local socket, filtering every record through the team’s tasks.policy.',
  policy: 'Reads and resolves the effective policies for a team or seat across the tighten-only chain, or sets and unsets owner-signed policy declarations.',
  add: 'Starts one declared seat, or a temporary one beside the team with --temporary --like <seat> --until <result:path|merged:branch>.',
  register: 'Writes the record for a seat that is already running, so team send, team seats, team watch and team down can address it; types nothing.',
  answer: 'Presses the one recorded key of a seat’s folder-trust dialog when the team allows it; every check has to pass, and anything else sends nothing.',
  release: 'Checks a release on npm and GitHub. When the team has the pairs: Linear milestone, qualifying status update, and the release marker in the public activity file.',
  remove: 'Stops one seat and takes it out of the team; --keep leaves it stopped; --abandon is the owner’s, and types nothing.',
  rename: 'Renames a seat, or renumbers numbered seats with --renumber, carrying its identity and records across the team’s record, state, registry, herdr and seat files.',
  worktree: 'Creates a task worktree from an up-to-date base, or removes one; the branch is never deleted.',
  'ask-show': 'Prints the question a signed ask carries, once the marker’s HMAC and its expiry check out; a marker that does not verify prints nothing.',
  check: 'One answer to one question: is anything wrong with this team that someone should act on? It reads and reports; it grants nothing.',
  delegate: 'Adds or replaces one external delegate in the team’s configuration; replacing an entry sets its complete command list, and other entries keep theirs.',
  feed: 'Reads and follows the project’s message history: the JSONL file, the briefs and Desk audit lines beside it, and the deliveries team send wrote.',
  grant: 'Writes an authority record: the team’s one grant by --scope, or a standing owner-signed --capabilities record naming the grantee by registry id.',
  lock: 'Takes a named lock on this machine so one heavy run holds it at a time; the take is one mkdir, and a second caller is refused.',
  mcp: 'Reads the MCP bridge’s local state — the helper, every lobby config, the seat guards and the public front — and reports it without changing a thing.',
  proc: 'The processes a team’s seats started, kept as a register in the team’s state: one record per name, with its seat, time, pid and note.',
  reload: 'Closes one running seat and launches it again when the team’s model, version or effort differs from the seat’s last launch.',
  restart: 'Restarts one declared seat in place, without editing the team’s configuration; a busy seat is left as it is unless --abandon is given.',
  revoke: 'Removes a grant or one external delegate from the team’s configuration, or ends a standing grant; an absent target is a successful no-op.',
  route: 'Answers one seat’s address for the native channel, and records that it handed the address out; the CLI delivers nothing itself.',
  seats: 'The seat registry for the team: each seat’s stable seat handle, role, CLI, model, effort, status, state, last active time and pane.',
  unlock: 'Releases a lock team lock took, and only that caller’s: the holder file has to name the same project and by line; anyone else is refused.',
  usage: 'What this machine holds: every team with an approval store here, its accounts and windows, what is left and used, and when each figure was read.',
};
/** Build once, on first use: this module and the models module read each other — the models
 *  module renders its pages through Doc from here, and this one reads the catalog from there —
 *  so a map built at module level races whichever of the two loads first. */
const lazy = <T>(build: () => T): (() => T) => {
  let value: T | undefined;
  return () => (value ??= build());
};
/** A lab page's description: the site's own one line, built from the lab's name. */
const labDescriptions = lazy((): Record<string, string> => Object.fromEntries(
  LABS.map(lab => [lab.slug, `${lab.name} with TeamCLI: its families, the ways in, how to subscribe or get an API key, and its known quirks.`]),
));
/** A family page's description: the family's own tagline, which already names its lab. */
const familyDescriptions = lazy((): Record<string, string> => Object.fromEntries(
  LABS.flatMap(lab => familiesOf(lab.vendor).map(family => [`${lab.slug}/${family.slug}`, family.tagline])),
));

const SITE_PAGES: Record<string, string> = {
  '/privacy/': 'How teamcli.io reaches you, and what stays in your browser.',
  '/models/': 'Set up your agents: install the CLI or app, get the key, log in — then every lab\'s model families against each way in, each row linking to its family page.',
  '/guide/': 'Task guides for running a team with TeamCLI — your first team, and running a release — with an index now and the first guides coming soon.',
  '/docs/': 'Your first team in five minutes: install team, write the team with team init and team config, and start the session from the owner’s terminal.',
  '/docs/config/': 'The team’s registry record, edited with team config: tasks, seats, delivery order, grant, delegates and tempo — then the format by example and its other fields.',
  '/docs/config/tasks/': 'The team configuration’s tasks section: one task source, the policy that decides which fields cross a broker, and the pull, fallback and cadence rules.',
  '/docs/config/seats/': 'The team configuration’s seats section: each seat’s model and launch, its label and the pane’s two lines, and the effort word its lab allows.',
  '/docs/config/delivery-order/': 'The team configuration’s delivery order: the legs a send walks, and how each level of the chain may drop or reorder them but never add one.',
  '/docs/config/grant/': 'The team configuration’s grant: the one authority record the owner gives the orchestrator’s seat, its closed scope, and what each act admits.',
  '/docs/config/delegates/': 'The team configuration’s delegates: panes outside the session that may run some commands, the allowlist guard, and the placement that is an accident guard.',
  '/docs/config/tempo/': 'The team configuration’s tempo: relaxed, normal or urgent — which waits the word scales, and when it takes effect.',
  '/docs/concepts/registry/': 'The agent, team and project records this machine keeps: what each field means, and why an id is the identity.',
  '/docs/commands/': 'Every command of team: what each reads and writes, who may run it, its refusals, its exit codes and its examples.',
  '/docs/whats-new/': 'What the release this site documents adds: the README’s own “What’s new” section, and a pointer to the full changelog.',
  '/docs/safety/': 'Why team is safe to run: the owner outside herdr, the live record, grants and delegates the owner alone, and what team never does.',
  '/docs/clis/': 'Every launch profile team ships — claude-code, codex, cursor, antigravity, grok, gemini, muse and jules: the command, the flags, and the sign-in check.',
};

/** A description from the map above; a page that has none is a mistake, not a default. */
export function descriptionFor(path: string): string {
  const description = path === '/'
    ? 'Set up and run a team of specialized AI agents in herdr: you set the roster, agents do the work, and you decide.'
    : path.startsWith('/docs/commands/') && path !== '/docs/commands/'
    ? DESCRIPTIONS[path.slice('/docs/commands/'.length, -1)]
    : path.startsWith('/models/') && path !== '/models/'
    ? familyDescriptions()[path.slice('/models/'.length, -1)] ?? labDescriptions()[path.slice('/models/'.length, -1)]
    : SITE_PAGES[path];
  if (!description) throw new ReferenceError(`no description for ${path}`);
  return description;
}
