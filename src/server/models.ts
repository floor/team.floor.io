// The Models section, built from one data file: src/data/models.json.
//
// A seat is a model reached by a way in. The catalog holds the labs, their models, the five
// ways a model is reached — the lab's own CLI, the Antigravity or Cursor connectors, Claude
// Code with a provider endpoint, or the API directly — the subscription or API each spends,
// the TeamCLI seat line it maps to, and whether the team has run it (verified) or only
// documented it (listed). Nothing here is a price or a benchmark; sign-up and pricing live on
// each vendor's own pages, linked.
//
// The shape is the one TeamCLI's own registry (registry/models.json) is being built to, so
// this file can be replaced by that registry without the pages changing. A malformed catalog
// throws at load, the same discipline the reference pages hold to, so a broken catalog is a
// failed build.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { escapeHtml, type Rendered } from './markdown';
import { Doc, inline } from './pages';

/** What the catalog asked for and did not have. */
export class CatalogError extends Error {}

export interface Way { id: string; name: string; short: string }
export interface Lab { slug: string; name: string; vendor: string; blurb: string; subscribeHref: string; quirks: string[] }
export interface Seat { cli: string; vendor: string; model?: string; version?: string; display?: string; modelFrom?: string; launch: string }
export interface Route { transport: string; status: 'verified' | 'listed'; bill?: string; seat?: Seat; quirks?: string[] }
export interface Model { slug: string; name: string; vendor: string; summary: string; routes: Route[]; quirks?: string[] }
export interface Transport {
  name: string; kind: string; way: string; vendor: string; cli: string | null; reaches: string;
  install: string | null; installHref: string | null; account: string; accountHref: string | null;
  login: string; profileNote: string | null;
}
export interface Catalog { verifiedOn: string; ways: Way[]; labs: Lab[]; transports: Record<string, Transport>; models: Model[] }

function need<T>(value: T | undefined | null | false, what: string): T {
  if (value === undefined || value === null || value === false || value === '') throw new CatalogError(`the models catalog ${what}`);
  return value as T;
}

/** Read, parse and validate the catalog once. A shape the pages rely on that is missing stops the build. */
function load(): Catalog {
  let parsed: Catalog;
  try {
    parsed = JSON.parse(readFileSync(resolve(import.meta.dir, '../data/models.json'), 'utf8')) as Catalog;
  } catch (error) {
    throw new CatalogError(`src/data/models.json could not be read or parsed: ${(error as Error).message}`);
  }
  need(/^\d{4}-\d{2}-\d{2}$/.test(parsed.verifiedOn), 'has no verifiedOn date');
  need(Array.isArray(parsed.ways) && parsed.ways.length > 0, 'has no ways in');
  const wayIds = new Set(parsed.ways.map(way => way.id));
  for (const way of parsed.ways) need(way.id && way.name && way.short, `has a way missing id, name or short (${JSON.stringify(way)})`);
  need(Array.isArray(parsed.labs) && parsed.labs.length > 0, 'has no labs');
  const labSlugs = new Set<string>();
  const labVendors = new Set<string>();
  for (const lab of parsed.labs) {
    need(lab.slug && /^[a-z0-9-]+$/.test(lab.slug), `has a lab with a bad slug "${lab.slug}"`);
    need(!labSlugs.has(lab.slug), `lists the lab slug "${lab.slug}" twice`);
    labSlugs.add(lab.slug);
    labVendors.add(need(lab.vendor, `lab "${lab.slug}" has no vendor`));
    need(lab.name, `lab "${lab.slug}" has no name`);
    need(lab.blurb, `lab "${lab.slug}" has no blurb`);
    need(Array.isArray(lab.quirks), `lab "${lab.slug}" has no quirks list`);
  }
  need(parsed.transports && typeof parsed.transports === 'object', 'has no transports');
  for (const [id, transport] of Object.entries(parsed.transports)) {
    need(transport.name, `transport "${id}" has no name`);
    need(transport.vendor, `transport "${id}" has no vendor`);
    need(transport.reaches, `transport "${id}" says nothing about what it reaches`);
    need(transport.account, `transport "${id}" names no account`);
    need(transport.login, `transport "${id}" names no log-in step`);
    need(wayIds.has(transport.way), `transport "${id}" names an unknown way "${transport.way}"`);
    need(['own-cli', 'connector', 'endpoint', 'cloud', 'api'].includes(transport.kind), `transport "${id}" has an unknown kind "${transport.kind}"`);
  }
  need(Array.isArray(parsed.models) && parsed.models.length > 0, 'has no models');
  const slugs = new Set<string>();
  for (const model of parsed.models) {
    need(model.slug && /^[a-z0-9-]+$/.test(model.slug), `has a model with a bad slug "${model.slug}"`);
    need(!slugs.has(model.slug) && !labSlugs.has(model.slug), `reuses the slug "${model.slug}"`);
    slugs.add(model.slug);
    need(model.name, `model "${model.slug}" has no name`);
    need(labVendors.has(model.vendor), `model "${model.slug}" has vendor "${model.vendor}", which no lab declares`);
    need(model.summary, `model "${model.slug}" has no summary`);
    need(Array.isArray(model.routes) && model.routes.length > 0, `model "${model.slug}" has no routes`);
    for (const route of model.routes) {
      need(parsed.transports[route.transport], `model "${model.slug}" names an unknown transport "${route.transport}"`);
      need(route.status === 'verified' || route.status === 'listed', `model "${model.slug}" has a route with an unknown status "${route.status}"`);
      if (route.seat) {
        need(route.seat.cli, `model "${model.slug}" has a seat with no cli on the ${route.transport} route`);
        need(route.seat.vendor, `model "${model.slug}" has a seat with no vendor on the ${route.transport} route`);
        need(route.seat.launch, `model "${model.slug}" has a seat with no launch on the ${route.transport} route`);
      }
    }
  }
  return parsed;
}

export const CATALOG = load();
export const TRANSPORTS = CATALOG.transports;
export const MODELS = CATALOG.models;
export const LABS = CATALOG.labs;
export const WAYS = CATALOG.ways;
export const VERIFIED_ON = CATALOG.verifiedOn;

/** A model's, or a lab's, own page path (they never collide — slugs are checked apart at load). */
export const modelHref = (slug: string): string => `/models/${slug}/`;
export const labHref = (slug: string): string => `/models/${slug}/`;
/** The setup page, and the anchor for one way's set-up on it, for a cell or a page to link into. */
const SET_UP = '/models/set-up/';
const setupAnchor = (transportId: string): string => `setup-${transportId}`;
const setupHref = (transportId: string): string => `${SET_UP}#${setupAnchor(transportId)}`;

const labByVendor = (vendor: string): Lab | undefined => LABS.find(lab => lab.vendor === vendor);
const labBySlug = (slug: string): Lab | undefined => LABS.find(lab => lab.slug === slug);
/** The models a lab holds, in the catalog's order. */
const modelsOfLab = (vendor: string): Model[] => MODELS.filter(model => model.vendor === vendor);
/** A model's section anchor on its lab page: /models/<lab>/#<model-slug>. Each model lives as a
 *  section of its lab's page, not a page of its own, so this is where every link to a model goes. */
export function modelAnchorHref(model: Model): string {
  const lab = labByVendor(model.vendor);
  return lab ? `${labHref(lab.slug)}#${model.slug}` : `#${model.slug}`;
}
/** The 301s from the old per-model URLs to the new lab-page anchors, so no old link breaks. */
export function modelRedirects(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const model of MODELS) if (labByVendor(model.vendor)) map[modelHref(model.slug)] = modelAnchorHref(model);
  return map;
}
/** A route's status in words. */
const statusLabel = (status: Route['status']): string => (status === 'verified' ? 'Verified' : 'Listed — not yet verified');
/** The route of a model that is reached by a given way, if any. */
const routeForWay = (model: Model, wayId: string): Route | undefined =>
  model.routes.find(route => TRANSPORTS[route.transport]!.way === wayId);
/** A markdown table from header cells and rows of markdown cells. */
function mdTable(head: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}
const code = (text: string): string => `\`${text}\``;
const link = (text: string, href: string): string => `[${text}](${href})`;
const attr = (text: string): string => escapeHtml(text).replace(/'/g, '&#39;');

// ---------------------------------------------------------------- the overview matrix

/** /models/ — the overview: a matrix, labs and their models down, the ways in across. */
export function modelsOverview(): Rendered {
  const doc = new Doc().h1('Models');
  doc.md('Every model the team runs, and the ways in. A row is a model; a column is a way to reach it — the lab\'s own CLI, the Antigravity or Cursor connectors, Claude Code pointed at a provider\'s endpoint, or the API directly. Each cell is the route\'s status, and links to its set-up.');
  doc.note('<strong>Verified</strong> is a seat the team has run; <strong>Listed</strong> is a documented route not yet run; a dash is a way that does not reach the model. Start with <a href="/models/set-up/">Set up your agents</a>.');

  const header = `<thead><tr><th scope="col">Model</th>${WAYS.map(way => `<th scope="col">${escapeHtml(way.short)}</th>`).join('')}</tr></thead>`;
  const span = WAYS.length + 1;
  const body = LABS.map(lab => {
    const groupRow = `<tr class="matrix__group"><td colspan="${span}"><a href="${labHref(lab.slug)}">${escapeHtml(lab.name)}</a></td></tr>`;
    const modelRows = modelsOfLab(lab.vendor).map(model => {
      const cells = WAYS.map(way => {
        const route = routeForWay(model, way.id);
        const inner = route
          ? `<a href="${setupHref(route.transport)}">${route.status === 'verified' ? 'Verified' : 'Listed'}</a>`
          : '<span class="matrix__none">—</span>';
        return `<td data-label="${attr(way.short)}">${inner}</td>`;
      }).join('');
      return `<tr><td class="matrix__model"><a href="${modelAnchorHref(model)}">${escapeHtml(model.name)}</a></td>${cells}</tr>`;
    }).join('');
    return groupRow + modelRows;
  }).join('');

  doc.raw(`<div class="table-wrap matrix-wrap" tabindex="0"><table class="matrix"><caption class="visually-hidden">Models down, ways in across; each cell is a route's status.</caption>${header}<tbody>${body}</tbody></table></div>\n`);
  doc.note(`Verified on ${escapeHtml(VERIFIED_ON)}.`);
  return doc.render();
}

// ---------------------------------------------------------------- set up your agents

/** The bullet steps for one transport: install, account, log in, and the TeamCLI profile. */
function transportSteps(transport: Transport): string {
  const steps: string[] = [];
  if (transport.install) {
    const command = /^(npm|bun|pnpm|yarn|brew) /.test(transport.install);
    const where = transport.installHref ? ` — ${link(transport.name, transport.installHref)}` : '';
    steps.push(`**Install** — ${command ? code(transport.install) : transport.install}${where}`);
  } else {
    steps.push('**Install** — nothing to install locally for this route.');
  }
  const account = transport.accountHref ? `${transport.account} ${link('Sign-up and pricing', transport.accountHref)}.` : transport.account;
  steps.push(`**Account** — ${account}`);
  steps.push(`**Log in** — ${transport.login}`);
  steps.push(`**TeamCLI** — ${transport.cli ? `the launch profile is ${code(transport.cli)}.` : 'no launch profile of its own in this build.'}`);
  return steps.map(step => `- ${step}`).join('\n');
}

/** The models a transport reaches, as links, for the "serves" line. */
function servesLine(transportId: string): string {
  const models = MODELS.filter(model => model.routes.some(route => route.transport === transportId));
  if (!models.length) return '';
  return `Serves ${models.map(model => link(model.name, modelAnchorHref(model))).join(', ')}.`;
}

/** /models/set-up/ — "Set up your agents", grouped by the way in: install and log in once per route. */
export function setUp(): Rendered {
  const doc = new Doc().h1('Set up your agents');
  doc.md('A TeamCLI seat is a model reached by a route. Install the CLI or app the route uses, get the subscription or API key it spends, log in, and name the model in the team file. Set up a route once and it serves every model on it; the matrix on the <a href="/models/">overview</a> shows which models each route reaches.');

  doc.heading('The seat line');
  doc.md('In the team file, each seat names its model and how it is launched — the same six fields whichever route carries the model:');
  doc.md(mdTable(
    ['Field', 'What it is'],
    [
      [code('cli'), 'The launch profile — which CLI or app runs the seat.'],
      [code('vendor'), 'The lab the model is from.'],
      [code('model'), 'The model\'s name.'],
      [code('version'), 'Its version, a token of its own.'],
      [code('display'), 'The proper-case label `team status` shows.'],
      [code('launch'), 'The command that starts the seat.'],
    ],
  ));
  doc.note('A launcher script, an account, a token or a key never goes in the team file. An Anthropic-compatible endpoint reads its key from the OS keychain through a small launcher on the PATH, and marks the seat <code>model_from: launcher</code>.');

  for (const way of WAYS) {
    const transports = Object.entries(TRANSPORTS).filter(([, transport]) => transport.way === way.id);
    if (!transports.length) continue;
    doc.heading(way.name);
    for (const [id, transport] of transports) {
      doc.raw(`<h3 id="${escapeHtml(setupAnchor(id))}">${escapeHtml(transport.name)}</h3>\n`);
      doc.md(`${transport.reaches} *(${transport.vendor})*`);
      doc.md(transportSteps(transport));
      const serves = servesLine(id);
      if (serves) doc.md(serves);
      if (transport.profileNote) doc.note(inline(transport.profileNote));
    }
  }
  doc.note(`Verified on ${escapeHtml(VERIFIED_ON)}.`);
  return doc.render();
}

// ---------------------------------------------------------------- one page per lab, its models as sections

/** One model as a section of its lab's page: the heading is its own anchor (the slug), then its
 *  ways to reach it, the seat line per route, and its quirks. A model is a section here, not a
 *  page of its own, so every link to a model is a link to this anchor. */
function modelSection(doc: Doc, model: Model): void {
  doc.raw(`<h2 id="${escapeHtml(model.slug)}">${escapeHtml(model.name)}</h2>\n`);
  doc.toc.push({ title: model.name, id: model.slug });
  doc.md(model.summary);

  doc.heading('Ways to reach it', 3);
  doc.md(mdTable(
    ['Route', 'Spends', 'Status'],
    model.routes.map(route => {
      const transport = TRANSPORTS[route.transport]!;
      return [link(transport.name, setupHref(route.transport)), route.bill ?? transport.account, statusLabel(route.status)];
    }),
  ));

  const seated = model.routes.filter((route): route is Route & { seat: Seat } => Boolean(route.seat));
  if (seated.length) {
    doc.heading('The seat line', 3);
    doc.md('Each route maps to a TeamCLI seat line — the same fields, written generically. No machine paths, no launcher script of anybody\'s, no team\'s own seat names.');
    const dash = '—';
    doc.md(mdTable(
      ['Route', 'cli', 'vendor', 'model', 'version', 'display', 'launch'],
      seated.map(route => {
        const seat = route.seat;
        return [
          TRANSPORTS[route.transport]!.name,
          code(seat.cli),
          code(seat.vendor),
          seat.model ? code(seat.model) : dash,
          seat.version ? code(seat.version) : dash,
          seat.display ? code(seat.display) : dash,
          code(seat.launch),
        ];
      }),
    ));
    if (seated.some(route => route.seat.modelFrom)) {
      doc.note('A seat with <code>model_from: launcher</code> leaves the running model to what the launch runs — the provider\'s launcher, or Jules — so <code>team doctor</code> reads the model from the seat rather than from the file.');
    }
  }

  const quirks = [...(model.quirks ?? []), ...model.routes.flatMap(route => route.quirks ?? [])];
  if (quirks.length) {
    doc.heading('Known quirks', 3);
    doc.md(quirks.map(quirk => `- ${quirk}`).join('\n'));
  }
}

/** /models/<lab>/ — one lab: its blurb and how to subscribe, then each of its models as a section. */
export function labPage(slug: string): Rendered {
  const lab = need(labBySlug(slug), `has no lab "${slug}"`);
  const doc = new Doc().h1(lab.name);
  doc.md(lab.blurb);
  doc.note(`Part of <a href="/models/">Models</a>. Sign-up and pricing for ${escapeHtml(lab.name)} live on the vendor's own pages: <a href="${attr(lab.subscribeHref)}" rel="noopener noreferrer">${escapeHtml(lab.name)}</a> — never put a key in the team file. Set each route up on <a href="/models/set-up/">Set up your agents</a>.`);
  for (const model of modelsOfLab(lab.vendor)) modelSection(doc, model);
  doc.note(`Verified on ${escapeHtml(VERIFIED_ON)}. Each route is marked verified — a seat the team has run — or listed, not yet verified.`);
  return doc.render();
}

/** /guide/ — the Guide section's index: the task guides planned, and where to start until they land. */
export function guideIndex(): Rendered {
  return new Doc()
    .h1('Guide')
    .md('Task guides for running a team with TeamCLI, start to finish. The first guides are on their way.')
    .heading('Guides')
    .md('- **Your first team** — write `.agents/team.yaml`, start the session, and watch the seats come up.\n- **Running a release with TeamCLI** — take a change from a task to a reviewed, shipped release.')
    .note('These first guides are coming. Until then, start with <a href="/docs/">the documentation</a> and <a href="/models/">the models</a>.')
    .render();
}
