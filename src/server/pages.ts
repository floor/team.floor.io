// Every page of the site, assembled from the reference at TEAM_REF.
//
// Nothing here retypes what the reference says. A page is built from named pieces of the
// README and the command pages — a section, a paragraph, a bullet, a sentence, a table
// row, a fenced block — and reference.ts throws when the reference no longer has one. So
// a ref that moved fails loudly here, in `bun test` and in docs:check, instead of quietly
// shipping a page that says something the package no longer does.
import { bullet, commandNames, commandPage, commandTable, fenceWith, paragraph, section, sentence, README, ReferenceError } from './reference';
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

/** The words of the hero's second line, in one place: the landing renders them (the
    sentence's period is the template's) and the shell ends the preview image's alt text
    with them, so the two can only be re-worded together. Taken from RFC 000, Part 1,
    "whether they come from one lab or several." The title that carries the same words
    has to stay within 70 characters once its apostrophe is escaped, and these do. */
export const heroLine = 'from one lab or several';

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

/** The three points of the home page, each one sentence of the reference. */
export function homePoints(): { title: string; text: string }[] {
  const watch = commandTable().find(row => row.name === 'watch');
  if (!watch) throw new ReferenceError('the commands table no longer lists `team watch`');
  const capitalised = watch.summary.charAt(0).toUpperCase() + watch.summary.slice(1);
  return [
    { title: 'One file declares the team', text: sentence(README, 'A project declares its team in') },
    { title: 'Safe by design', text: `${sentence(README, 'The owner is a terminal outside herdr')} ${sentence(README, 'Nothing writes a vendor config')} ${sentence(README, 'Launching a Cursor seat')}` },
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

// ---------------------------------------------------------------- safety and CLIs

/**
 * /docs/safety/ — the safety model in plain words, each claim a piece of the reference.
 *
 * "Nothing writes a vendor config or an `AGENTS.md`" is the reference's sentence about
 * what team does, and its Cursor paragraph is the one that says what a launch still
 * writes: Cursor's own project record. The claim and that sentence travel together here,
 * as docs:check holds them to, so the page never promises more than the reference does.
 */
export function safety(): Rendered {
  const up = commandPage('up');
  const approve = commandPage('approve');
  const watch = commandPage('watch');
  const never = [
    sentence(README, 'Nothing writes a vendor config'),
    sentence(README, 'It never answers prompts'),
    sentence(README, 'A file you receive from someone else'),
    sentence(README, '`up` and `down` take `--dry-run`'),
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
    .heading('Trust is left to the owner')
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
    .md(paragraph(README, '**Status: 0.1, early'))
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
  approve: 'The owner reads the whole file back, then records it, its ceilings and its seats on this machine; --show prints it.',
  check: 'Checks one commit, a range, or a PR body against the signature rule; exit 1 when a commit is refused.',
  doctor: 'What this machine still needs: the approval, herdr, each CLI, its version and login, each launch’s model, and the watch.',
  status: 'The team as it stands: one line per seat, and every difference between the file, the state and the live session, with its repair.',
  up: 'Starts the session, a workspace and a seat for every seat the file declares, and the watch; --dry-run prints the plan.',
  down: 'Stops the team: asks every free seat to exit, closes its workspace, stops the watch, and stops the session.',
  watch: 'Watches a running team: reports idle seats and nudges the operator, in one fixed line, into an empty idle prompt only.',
  add: 'Starts one declared seat, or a temporary one beside the team with --temporary --like <seat> --until <end>.',
  remove: 'Stops one seat and takes it out of the file; --keep leaves it stopped; --abandon is the owner’s, and types nothing.',
  worktree: 'Creates a task worktree from an up-to-date base, or removes one; the branch is never deleted.',
};
const SITE_PAGES: Record<string, string> = {
  '/': 'A project declares its team in one file: the seats, the models, the rules and the folders each one may touch. Set it up, change it and watch it run.',
  '/privacy/': 'How teamcli.io reaches you, and what stays in your browser.',
  '/docs/': 'Your first team in five minutes: install team, write .agents/team.yaml, approve it, and start the session.',
  '/docs/file/': 'Every part of .agents/team.yaml: the head, identity, workspace, machine, seats, watch and budgets, from the README, the example and the watch command page.',
  '/docs/commands/': 'The eleven commands of team: what each reads and writes, who may run it, its refusals, its exit codes and its examples.',
  '/docs/safety/': 'Why team is safe to run: the owner outside herdr, the approved copy, trust left to the owner, and the prompts team never answers.',
  '/docs/clis/': 'What team knows of claude-code, codex, cursor and antigravity: the launch profile, the sign-in check, and what it never writes.',
};

/** A description from the map above; a page that has none is a mistake, not a default. */
export function descriptionFor(path: string): string {
  const description = path.startsWith('/docs/commands/') && path !== '/docs/commands/'
    ? DESCRIPTIONS[path.slice('/docs/commands/'.length, -1)]
    : SITE_PAGES[path];
  if (!description) throw new ReferenceError(`no description for ${path}`);
  return description;
}
