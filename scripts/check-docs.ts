// docs:check — the site says what the reference says, and nothing else.
//
//   1. Every named piece of the reference still resolves: importing the pages throws
//      with the name of the piece that is gone.
//   2. Every YAML block the site shows is a file `team`'s own validator accepts — the
//      validator built from the same ref (content/team/src/file/validate.ts), not npm.
//   3. Every block on a page is a fenced block of the reference, text for text: a
//      command page shows exactly the console and YAML fences of its own page, and a
//      page built from pieces only ever shows a whole fence.
//   4. No private material anywhere in the site's own sources: no user paths, no
//      internal ids, no mention of the private docs.
//   5. Every page has a description of one line, at most 160 characters.
//   6. A "who may run it" cell speaks for one command: the reference's shorthand for a
//      row that names two ("`up`: the owner; `down`: …") never reaches a page whole.
//   7. A page that says no vendor config is written says what a launch still writes.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { handleRequest } from '../server';
import { decodeEntities, fences, type Fence } from '../src/server/markdown';
import { commandNames, commandPage, README } from '../src/server/reference';
import { homeSamples, installLine, pages, descriptionFor } from '../src/server/pages';
import { SITE, sitemapPages } from '../src/server/seo';
import { read } from '../src/server/team';
// The ref's own validator, from the same content/team checkout the pages are built from.
import { validateTeamFile } from '../content/team/src/file/validate.ts';

const root = resolve(import.meta.dir, '..');
const problems: string[] = [];
const check = (condition: boolean, message: string) => { if (!condition) problems.push(message); };

/** The text of an HTML fragment: the tags out, the entities decoded, the spaces kept. */
function text(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\n$/, '');
}

/** Every block a rendered page shows, in order: its terminals, then its code blocks. */
function blocks(html: string): string[] {
  return [...html.matchAll(/<pre class="(?:example__code|term)"[^>]*>([\s\S]*?)<\/pre>/g)].map(match => text(match[1]!));
}

const normalise = (markdown: string) => markdown.replace(/\n$/, '').replace(/\r\n/g, '\n');

// ── 2. the YAML the site shows, through the ref's own validator ────────────────

const yamlSources: { where: string; page: string; paragraph: string; yaml: string }[] = [];
const sources = new Map<string, Fence[]>([['README.md', fences(README)], ['examples/team.yaml', []]]);
for (const name of commandNames()) {
  const markdown = commandPage(name);
  sources.set(`docs/commands/${name}.md`, fences(markdown));
  for (const fence of fences(markdown)) {
    if (fence.lang !== 'yaml') continue;
    // The last paragraph above the fence, for a fence that is a file that does not parse.
    const above = markdown.slice(0, fence.start).split(/\n\s*\n/).filter(part => part.trim()).at(-1) ?? '';
    yamlSources.push({ where: `docs/commands/${name}.md:${fence.line}`, page: name, paragraph: above, yaml: fence.text });
  }
}
yamlSources.push({ where: 'examples/team.yaml', page: 'the example', paragraph: '', yaml: read('examples/team.yaml') });
/**
 * A fence is allowed not to parse only where the reference says so in the sentence
 * above it: both pages that carry one broken say what the command does with it. The
 * example file and every other fence must be a file `team` accepts.
 */
const SAYS_BROKEN = /\b(broken|no longer validates|does not parse|refused?|refuses)\b/i;
for (const { where, paragraph, yaml } of yamlSources) {
  const result = validateTeamFile(yaml);
  if (result.ok) continue;
  const reason = `line ${result.errors[0]?.line} ${result.errors[0]?.message}`;
  check(SAYS_BROKEN.test(paragraph), `${where}: team's own validator refuses this YAML (${reason}), and the page does not say it is broken`);
}

// ── 3. every block a page shows is a fence of the reference ────────────────────

const referenceFences = [...sources.values()].flat().filter(fence => fence.lang !== 'fixture');
const fenceTexts = new Map<string, string[]>(referenceFences.map(fence => [normalise(fence.text), []]));
for (const [file, list] of sources) for (const fence of list) if (fence.lang !== 'fixture') fenceTexts.get(normalise(fence.text))?.push(file);

/** A block may be shown more than once, never invented. */
function notInvented(where: string, shown: string[]) {
  for (const block of shown) {
    const from = fenceTexts.get(block);
    check(Boolean(from?.length), `${where}: a block is not a fence of the reference: ${JSON.stringify(block.slice(0, 60))}…`);
  }
}

/** A run of whole lines of a reference fence, or of the example file: how /docs/file/
 *  shows the file section by section, and the README shows one part of its format. */
function partOfFence(block: string): boolean {
  const lines = block.split('\n');
  const sourcesToSearch = [...referenceFences.map(fence => normalise(fence.text)), read('examples/team.yaml').replace(/\n$/, '')];
  return sourcesToSearch.some(source => {
    const sourceLines = source.split('\n');
    return sourceLines.some((_, start) => lines.every((line, offset) => sourceLines[start + offset] === line));
  });
}

for (const name of commandNames()) {
  const page = pages().find(entry => entry.path === `/docs/commands/${name}/`)!;
  // A command page is its own reference page: what it shows is what that page fences.
  const expected = (sources.get(`docs/commands/${name}.md`) ?? []).filter(fence => fence.lang !== 'fixture').map(fence => normalise(fence.text));
  const shown = blocks(page.html);
  check(shown.join('\u0000') === expected.join('\u0000'), `/docs/commands/${name}/: the page and the reference page's fences differ (${shown.length} shown, ${expected.length} fenced)`);
}
// /docs/file/ shows the example file section by section: every block is whole lines
// of a fence, so a section can be short but never invented.
const file = pages().find(entry => entry.path === '/docs/file/')!;
for (const block of blocks(file.html)) check(partOfFence(block), `/docs/file/: a block is not whole lines of a reference fence: ${JSON.stringify(block.slice(0, 60))}…`);
for (const page of pages().filter(entry => !entry.path.startsWith('/docs/commands/') && entry.path !== '/docs/file/')) notInvented(page.path, blocks(page.html));
// The home page shows three whole fences, and the install line — the README's own
// install command, the same line from the same fence.
notInvented('/', homeSamples().map(sample => normalise(sample.fence.text)));
check(referenceFences.some(fence => normalise(fence.text).split('\n').some(line => line.trim().split('#')[0]!.trim() === installLine())), 'the install line is not a line of any reference fence');

// ── 4. no private material in the site's own sources ──────────────────────────

// Built from pieces, so that this file can name the things it refuses without holding
// them: a scan that spells its own patterns would flag itself.
//
// `/home/<name>` is refused except in the deploy script, whose subject is a directory on
// the server: it is the one file that has to name one, and it names the same deploy user
// the site's sibling projects are deployed as. A reader's own home is what the rule is for.
const PRIVATE: { pattern: RegExp; what: string; except?: string }[] = [
  { pattern: new RegExp('/' + 'Users/'), what: 'an absolute user path' },
  { pattern: new RegExp('/' + 'home/[a-z]'), what: 'an absolute home path', except: 'scripts/deploy.sh' },
  { pattern: new RegExp('FLO' + '-\\d'), what: 'an internal id' },
  { pattern: new RegExp('Claude' + '-Session'), what: 'a session id' },
  { pattern: new RegExp('Co-' + '[Aa]uthored-[Bb]y'), what: 'a co-author line' },
  { pattern: new RegExp('floor' + '/docs'), what: 'a private repository' },
];
const walk = (directory: string): string[] => readdirSync(directory).flatMap(name => {
  if (['node_modules', 'dist', 'content', '.git'].includes(name)) return [];
  const path = resolve(directory, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
for (const file of walk(root)) {
  if (/\.(png|ico|jpg|woff2?)$/.test(file)) continue;
  const name = relative(root, file);
  const body = readFileSync(file, 'utf8');
  for (const { pattern, what, except } of PRIVATE) {
    if (except === name) continue;
    const found = pattern.exec(body);
    check(!found, `${name} holds ${what}: ${JSON.stringify(body.slice(Math.max(0, found?.index ?? 0), (found?.index ?? 0) + 60))}`);
  }
}

// ── 5. one line per description ───────────────────────────────────────────────

for (const path of ['/', '/privacy/', ...pages().map(page => page.path)]) {
  const description = descriptionFor(path);
  check(description.length <= 160, `${path}: the description is ${description.length} characters, over 160`);
  check(!description.includes('\n'), `${path}: the description is more than one line`);
}

// ── 6. a "who may run it" cell speaks for one command ─────────────────────────
//
// The reference spells a row that names two commands as one cell — "`up`: the owner;
// `down`: the owner, the coordinator or the operator seat" — which is its own shorthand
// for two rules. Shown whole, the row for `team up` hands its reader who may run
// `team down`; a label that reached a page means a cell was shown unresolved.
const WHO_CELL = /<td><code>team [a-z]+<\/code><\/td><td>([\s\S]*?)<\/td>|<span class="doc-entry__who">([\s\S]*?)<\/span>/g;
for (const path of ['/docs/safety/', '/docs/commands/']) {
  const page = pages().find(entry => entry.path === path)!;
  const cells = [...page.html.matchAll(WHO_CELL)].map(match => text(match[1] ?? match[2] ?? ''));
  // A page that stopped showing them would take this rule with it.
  check(cells.length === commandNames().length, `${path}: ${cells.length} who cells for ${commandNames().length} commands`);
  for (const cell of cells) {
    check(!/^[a-z][a-z-]*: /.test(cell), `${path}: a who cell reads ${JSON.stringify(cell.slice(0, 60))}: a rule labelled for another command reached the page`);
  }
}

// ── 7. a claim about what a launch writes carries what a launch still writes ───
//
// "Nothing writes a vendor config or an `AGENTS.md`" is the reference's sentence about
// the Codex and the Antigravity profiles, and its Cursor paragraph is the one that says
// a launch does write Cursor's own project record. A page that repeats the claim for
// every CLI has to say that too, or it promises more than the reference does.
for (const { path } of sitemapPages()) {
  const response = await handleRequest(new Request(`${SITE}${path}`));
  check(response.status === 200, `${path}: the server answered ${response.status}`);
  const page = text(await response.text());
  check(!/vendor config/i.test(page) || /project record/i.test(page), `${path}: says nothing writes a vendor config, and does not say what a CLI launch still writes`);
}

if (problems.length) {
  console.error(`docs:check — ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`docs:check passed: ${pages().length} pages, ${referenceFences.length} reference fences, ${yamlSources.length} YAML blocks through team's validator.`);
