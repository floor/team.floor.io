// The Models section, built from one data file: src/data/models.json.
//
// A seat is a model reached by a way in. The catalog holds the labs, their model families and
// models, the five ways a model is reached — the lab's own CLI, the Antigravity or Cursor
// connectors, Claude Code with a provider endpoint, or the API directly — the subscription or
// API each spends, the TeamCLI seat line it maps to, and whether the team has run it (verified)
// or only documented it (listed). Prices and benchmarks are not the catalog's to hold: they live
// in the dated, sourced figures file (src/data/model-figures.json), rendered on the family pages.
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
/** A model family: the line a lab sells under one name — Claude Opus, Gemini Flash, GPT Sol —
 *  across its versions. `modelSlug` names the catalog model the team actually runs, when it
 *  runs one; its routes and seat lines are the family's ways in. `reach` says, in prose, how a
 *  family with no catalog model would run, and `reachRoutes` holds the same statement as
 *  transport ids — documented routes, not yet run, so the matrix lists them; a family with
 *  neither is one TeamCLI cannot reach yet. */
export interface Family {
  slug: string; vendor: string; name: string; tagline: string; summary: string;
  good: string[]; limits: string[]; modelSlug?: string; reach?: string[]; reachRoutes?: string[];
}
export interface Catalog { verifiedOn: string; ways: Way[]; labs: Lab[]; transports: Record<string, Transport>; models: Model[]; families: Family[] }

/** A figure as read from a named source: the value verbatim, the source's id, and its note. */
export interface Figure { v: string; s: string; note?: string }
export interface BenchmarkFigure extends Figure { name: string }
export interface CostFigure extends Figure { label: string }
export interface FigureSource { label: string; href: string; read: string }
/** One version's figures. An absent field is a dash — a figure the source does not publish,
 *  never a guess; every field that is there names the page it was read on. `extraCosts` holds
 *  a priced variant the source publishes beside the standard prices (Opus 5.5's fast mode). */
export interface VersionFigures {
  name: string; anchor: string; current?: boolean; apiId?: string; note?: string;
  released?: Figure; context?: Figure; maxOut?: Figure; priceIn?: Figure; priceOut?: Figure;
  speed?: Figure; latency?: Figure; benchmarks?: BenchmarkFigure[]; extraCosts?: CostFigure[];
}
export interface FiguresFile {
  refreshedAt: string; sources: Record<string, FigureSource>;
  families: Record<string, { versions: VersionFigures[]; sources?: string[] }>;
}

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
  need(Array.isArray(parsed.families) && parsed.families.length > 0, 'has no families');
  const familySlugs = new Set<string>();
  for (const family of parsed.families) {
    need(family.slug && /^[a-z0-9-]+$/.test(family.slug), `has a family with a bad slug "${family.slug}"`);
    // A family slug may equal a model slug (kimi-k3 is both the family and the version the seat
    // runs — /models/moonshot/kimi-k3/ beside the old /models/kimi-k3/), never a lab's or another family's.
    need(!familySlugs.has(family.slug) && !labSlugs.has(family.slug), `reuses the slug "${family.slug}"`);
    familySlugs.add(family.slug);
    need(family.name, `family "${family.slug}" has no name`);
    need(labVendors.has(family.vendor), `family "${family.slug}" has vendor "${family.vendor}", which no lab declares`);
    need(family.tagline, `family "${family.slug}" has no tagline`);
    need(family.summary, `family "${family.slug}" has no summary`);
    need(Array.isArray(family.good) && family.good.length > 0, `family "${family.slug}" has no good list`);
    need(Array.isArray(family.limits) && family.limits.length > 0, `family "${family.slug}" has no limits list`);
    if (family.reach) need(Array.isArray(family.reach) && family.reach.length > 0, `family "${family.slug}" has an empty reach list`);
    if (family.reachRoutes) {
      need(Array.isArray(family.reachRoutes) && family.reachRoutes.length > 0, `family "${family.slug}" has an empty reachRoutes list`);
      for (const id of family.reachRoutes) need(parsed.transports[id] !== undefined, `names the unknown transport "${id}" for the family "${family.slug}"`);
    }
    if (family.modelSlug) {
      const model = parsed.models.find(entry => entry.slug === family.modelSlug);
      need(model, `family "${family.slug}" names an unknown model "${family.modelSlug}"`);
      need(model!.vendor === family.vendor, `family "${family.slug}" names the model "${family.modelSlug}", which belongs to another lab`);
    }
  }
  return parsed;
}

/** Read, parse and validate the figures file. Every figure names a source, every source a page
 *  and the date it was read, and every family a version list with unique anchors. A field the
 *  source does not publish is absent — rendered as a dash — never guessed. A malformed file
 *  throws at load, so a broken figures file is a failed build. */
function loadFigures(): FiguresFile {
  let parsed: FiguresFile;
  try {
    parsed = JSON.parse(readFileSync(resolve(import.meta.dir, '../data/model-figures.json'), 'utf8')) as FiguresFile;
  } catch (error) {
    throw new CatalogError(`src/data/model-figures.json could not be read or parsed: ${(error as Error).message}`);
  }
  need(/^\d{4}-\d{2}-\d{2}$/.test(parsed.refreshedAt), 'holds no refreshedAt date');
  need(parsed.sources && Object.keys(parsed.sources).length > 0, 'holds no sources');
  for (const [id, source] of Object.entries(parsed.sources)) {
    need(source.label, `source "${id}" has no label`);
    need(/^https:\/\//.test(source.href ?? ''), `source "${id}" has no https href`);
    need(/^\d{4}-\d{2}-\d{2}$/.test(source.read ?? ''), `source "${id}" has no read date`);
  }
  const known = (value: unknown): value is Figure => {
    const figure = value as Figure;
    return typeof figure?.v === 'string' && figure.v !== '' && typeof figure?.s === 'string' && parsed.sources[figure.s] !== undefined;
  };
  const checkFigure = (figure: Figure | undefined, what: string): void => {
    if (figure !== undefined) need(known(figure), `${what} is a figure without a value or a known source`);
  };
  need(parsed.families && typeof parsed.families === 'object', 'holds no families');
  const anchors = new Set<string>();
  for (const family of CATALOG.families) {
    const entry = parsed.families[family.slug];
    need(entry && Array.isArray(entry.versions) && entry.versions.length > 0, `holds no versions for the family "${family.slug}"`);
    for (const version of entry.versions) {
      need(version.name, `family "${family.slug}" has a version with no name`);
      need(version.anchor && /^[a-z0-9-]+$/.test(version.anchor), `family "${family.slug}" has a version with a bad anchor "${version.anchor}"`);
      need(!anchors.has(version.anchor), `reuses the version anchor "${version.anchor}"`);
      anchors.add(version.anchor);
      checkFigure(version.released, `family "${family.slug}" version "${version.name}" released`);
      checkFigure(version.context, `family "${family.slug}" version "${version.name}" context`);
      checkFigure(version.maxOut, `family "${family.slug}" version "${version.name}" maxOut`);
      checkFigure(version.priceIn, `family "${family.slug}" version "${version.name}" priceIn`);
      checkFigure(version.priceOut, `family "${family.slug}" version "${version.name}" priceOut`);
      checkFigure(version.speed, `family "${family.slug}" version "${version.name}" speed`);
      checkFigure(version.latency, `family "${family.slug}" version "${version.name}" latency`);
      for (const benchmark of version.benchmarks ?? []) {
        need(benchmark.name, `family "${family.slug}" version "${version.name}" has a benchmark with no name`);
        need(known(benchmark), `family "${family.slug}" version "${version.name}" has a benchmark without a value or a known source`);
      }
      for (const cost of version.extraCosts ?? []) {
        need(cost.label, `family "${family.slug}" version "${version.name}" has an extra cost with no label`);
        need(known(cost), `family "${family.slug}" version "${version.name}" has an extra cost without a value or a known source`);
      }
    }
    // A family the sources dash out (Meta publishes no figures) still links the vendor page its
    // dashes stand on; a family may also name the page its lineup was read from.
    if (entry.sources) {
      for (const id of entry.sources) need(parsed.sources[id] !== undefined, `lists the unknown source "${id}" for the family "${family.slug}"`);
    }
  }
  for (const slug of Object.keys(parsed.families)) {
    need(CATALOG.families.some(family => family.slug === slug), `holds figures for the unknown family "${slug}"`);
  }
  // Every catalog model anchors as a version on its family's page — the one exception is a
  // model the launcher picks itself (Jules), which stays a section of its lab's page.
  for (const model of CATALOG.models) {
    const launcherPicked = model.routes.length > 0 && model.routes.every(route => route.seat?.modelFrom === 'launcher' && TRANSPORTS[route.transport]!.way === 'own-cli' && route.transport === 'jules');
    need(launcherPicked || anchors.has(model.slug), `the model "${model.slug}" is not a version anchor on any family page`);
  }
  return parsed;
}

export const CATALOG = load();
export const TRANSPORTS = CATALOG.transports;
export const MODELS = CATALOG.models;
export const LABS = CATALOG.labs;
export const WAYS = CATALOG.ways;
export const VERIFIED_ON = CATALOG.verifiedOn;
export const FAMILIES = CATALOG.families;
export const FIGURES = loadFigures();
export const FIGURE_SOURCES = FIGURES.sources;
export const FIGURES_REFRESHED_ON = FIGURES.refreshedAt;

/** A model's old page path (now a 301), or a lab's own page path — they never collide, slugs are checked apart at load. */
export const modelHref = (slug: string): string => `/models/${slug}/`;
export const labHref = (slug: string): string => `/models/${slug}/`;
/** A family's own page path: /models/<lab>/<family>/. */
export const familyHref = (labSlug: string, familySlug: string): string => `/models/${labSlug}/${familySlug}/`;
/** The Models overview page — set-up first, then the matrix — and the anchor of one way's
 *  set-up on it, for a cell or a page to link into. */
const MODELS_PAGE = '/models/';
const SET_UP_ANCHOR = 'set-up-your-agents';
const setupAnchor = (transportId: string): string => `setup-${transportId}`;
const setupHref = (transportId: string): string => `${MODELS_PAGE}#${setupAnchor(transportId)}`;

const labByVendor = (vendor: string): Lab | undefined => LABS.find(lab => lab.vendor === vendor);
const labBySlug = (slug: string): Lab | undefined => LABS.find(lab => lab.slug === slug);
const modelBySlug = (slug: string): Model | undefined => MODELS.find(model => model.slug === slug);
/** The models a lab holds, in the catalog's order. */
const modelsOfLab = (vendor: string): Model[] => MODELS.filter(model => model.vendor === vendor);
/** The families a lab offers, in the catalog's order. */
export const familiesOf = (vendor: string): Family[] => FAMILIES.filter(family => family.vendor === vendor);
/** The family a catalog model belongs to, when one claims it. */
const familyOfModel = (model: Model): Family | undefined => FAMILIES.find(family => family.modelSlug === model.slug);
/** A model's section anchor on its lab page: /models/<lab>/#<model-slug>. The one model a
 *  launcher picks itself (Jules) lives as a section of its lab's page; every other link to a
 *  model goes to its family's page. */
export function modelAnchorHref(model: Model): string {
  const lab = labByVendor(model.vendor);
  return lab ? `${labHref(lab.slug)}#${model.slug}` : `#${model.slug}`;
}
/** The 301s from retired URLs: the old per-model pages now point at the family pages' version
 *  anchors — /models/<lab>/<family>/#<version> — so every link kept from the lab-anchor era
 *  still lands on the model, and the set-up page's URL points at the overview's set-up anchor. */
export function modelRedirects(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const model of MODELS) {
    const lab = labByVendor(model.vendor);
    if (!lab) continue;
    const family = familyOfModel(model);
    map[modelHref(model.slug)] = family ? `${familyHref(lab.slug, family.slug)}#${model.slug}` : modelAnchorHref(model);
  }
  map['/models/set-up/'] = `${MODELS_PAGE}#${SET_UP_ANCHOR}`;
  return map;
}
/** A route's status in words. */
const statusLabel = (status: Route['status']): string => (status === 'verified' ? 'Verified' : 'Listed — not yet verified');
/** The route of a model that is reached by a given way, if any. */
const routeForWay = (model: Model, wayId: string): Route | undefined =>
  model.routes.find(route => TRANSPORTS[route.transport]!.way === wayId);
/** One table cell's inline markdown — code, strong, links — as HTML. The cells are all
 *  code-built, so the three forms the builders emit are the whole grammar. */
function cellHtml(markdown: string): string {
  return escapeHtml(markdown)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/** A table from header cells and rows of markdown cells, in the same frame the markdown
 *  renderer gives its own tables. Every body cell carries its column name in data-label,
 *  so the phone-width stacking — which hides the header row — still names each line. */
function mdTable(head: string[], rows: string[][]): string {
  const headCells = head.map(cell => `<th scope="col">${cellHtml(cell)}</th>`).join('');
  const body = rows.map(cells => `<tr>${cells.map((cell, index) => `<td data-label="${attr(head[index]!)}">${cellHtml(cell)}</td>`).join('')}</tr>`).join('');
  return `<div class="table-wrap" tabindex="0"><table><thead><tr>${headCells}</tr></thead>${body ? `<tbody>${body}</tbody>` : ''}</table></div>\n`;
}
const code = (text: string): string => `\`${text}\``;
const link = (text: string, href: string): string => `[${text}](${href})`;
const attr = (text: string): string => escapeHtml(text).replace(/'/g, '&#39;');

// ---------------------------------------------------------------- the overview matrix

/** /models/ — the overview: "Set up your agents" first, then the matrix — labs and their
 *  families down, the ways in across. */
export function modelsOverview(): Rendered {
  const doc = new Doc().h1('Models');
  doc.md('Every model family the labs offer, and the ways in. Set a route up once and it serves every model on it — the set-up below walks each route in, and the matrix then shows which families it reaches.');

  doc.heading('Set up your agents');
  doc.md('A TeamCLI seat is a model reached by a route. Install the CLI or app the route uses, get the subscription or API key it spends, log in, and name the model in the team’s configuration.');

  doc.heading('The seat line');
  doc.md('In the team’s configuration, each seat names its model and how it is launched — the same six fields whichever route carries the model:');
  doc.raw(mdTable(
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
  doc.note('A launcher script, an account, a token or a key never goes in the team’s configuration. An Anthropic-compatible endpoint reads its key from the OS keychain through a small launcher on the PATH, and marks the seat <code>model_from: launcher</code>.');

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

  doc.heading('The models, at a glance');
  doc.md('A row is a family, linking to its page; a column is a way to reach it — the lab\'s own CLI, the Antigravity or Cursor connectors, Claude Code pointed at a provider\'s endpoint, or the API directly. Each cell is the route\'s status, and links to its set-up above.');
  doc.note('<strong>Verified</strong> is a seat the team has run; <strong>Listed</strong> is a documented route not yet run; a dash is a way that does not reach the family.');

  const header = `<thead><tr><th scope="col">Family</th>${WAYS.map(way => `<th scope="col">${escapeHtml(way.short)}</th>`).join('')}</tr></thead>`;
  const span = WAYS.length + 1;
  const row = (name: string, href: string, model: Model | undefined, family?: Family): string => {
    const cells = WAYS.map(way => {
      const route = model ? routeForWay(model, way.id) : undefined;
      let inner: string;
      if (route) {
        inner = `<a href="${setupHref(route.transport)}">${route.status === 'verified' ? 'Verified' : 'Listed'}</a>`;
      } else {
        // A family with no catalog model may still name its routes: its reach prose, kept as
        // transport ids — documented routes, not yet run, so the cell lists rather than dashes.
        const reach = family?.reachRoutes?.find(id => TRANSPORTS[id]!.way === way.id);
        inner = reach ? `<a href="${setupHref(reach)}">Listed</a>` : '<span class="matrix__none">—</span>';
      }
      return `<td data-label="${attr(way.short)}">${inner}</td>`;
    }).join('');
    return `<tr><td class="matrix__model"><a href="${href}">${escapeHtml(name)}</a></td>${cells}</tr>`;
  };
  const body = LABS.map(lab => {
    const groupRow = `<tr class="matrix__group"><td colspan="${span}"><a href="${labHref(lab.slug)}">${escapeHtml(lab.name)}</a></td></tr>`;
    const familyRows = familiesOf(lab.vendor)
      .map(family => row(family.name, familyHref(lab.slug, family.slug), family.modelSlug ? modelBySlug(family.modelSlug) : undefined, family))
      .join('');
    // The one model no family claims — a launcher that picks its own — keeps its row on the lab's page.
    const leftoverRows = modelsOfLab(lab.vendor)
      .filter(model => !familyOfModel(model))
      .map(model => row(model.name, modelAnchorHref(model), model))
      .join('');
    return groupRow + familyRows + leftoverRows;
  }).join('');

  doc.raw(`<div class="table-wrap matrix-wrap" tabindex="0"><table class="matrix"><caption class="visually-hidden">Families down, ways in across; each cell is a route's status.</caption>${header}<tbody>${body}</tbody></table></div>\n`);
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

/** The families a transport reaches, as links to their pages, for the "serves" line — the
 *  catalog models it carries, and the families whose documented-but-unrun routes name it. */
function servesLine(transportId: string): string {
  const carried = MODELS.filter(model => model.routes.some(route => route.transport === transportId)).map(model => {
    const family = familyOfModel(model);
    return family && labByVendor(model.vendor)
      ? link(family.name, familyHref(labByVendor(model.vendor)!.slug, family.slug))
      : link(model.name, modelAnchorHref(model));
  });
  const reached = FAMILIES.filter(family => !family.modelSlug && family.reachRoutes?.includes(transportId)).map(family => {
    const lab = labByVendor(family.vendor)!;
    return link(family.name, familyHref(lab.slug, family.slug));
  });
  const names = [...carried, ...reached];
  return names.length ? `Serves ${names.join(', ')}.` : '';
}

// ---------------------------------------------------------------- one page per lab, one page per family

/** One model as a section of its lab's page — the shape kept for the one model a launcher
 *  picks itself (Jules): its heading is its own anchor (the slug), then the shared block. */
function modelSection(doc: Doc, model: Model): void {
  doc.raw(`<h2 id="${escapeHtml(model.slug)}">${escapeHtml(model.name)}</h2>\n`);
  doc.toc.push({ title: model.name, id: model.slug });
  doc.md(model.summary);
  modelWays(doc, model);
}

/** A model's ways to reach it, its seat lines and its quirks, at depth 3 — shared by the lab
 *  page's sections and the family pages' "Reaching it with TeamCLI". */
function modelWays(doc: Doc, model: Model): void {
  doc.heading('Ways to reach it', 3);
  doc.raw(mdTable(
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
    doc.raw(mdTable(
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

/** /models/<lab>/ — one lab: an overview of its families and the routes that reach them. */
export function labPage(slug: string): Rendered {
  const lab = need(labBySlug(slug), `has no lab "${slug}"`);
  const doc = new Doc().h1(lab.name);
  doc.md(lab.blurb);
  doc.note(`Part of <a href="/models/">Models</a>. Sign-up and pricing for ${escapeHtml(lab.name)} live on the vendor's own pages: <a href="${attr(lab.subscribeHref)}" rel="noopener noreferrer">${escapeHtml(lab.name)}</a> — never put a key in the team file. Set each route up on <a href="/models/#set-up-your-agents">Set up your agents</a>.`);

  doc.heading('Families');
  doc.md(`Every family ${escapeHtml(lab.name)} offers today, each with its own page — the versions, the prices, the benchmarks the vendor publishes, and how TeamCLI reaches it:`);
  doc.raw(mdTable(
    ['Family', 'What it is', 'Ways in'],
    familiesOf(lab.vendor).map(family => {
      const model = family.modelSlug ? modelBySlug(family.modelSlug) : undefined;
      const ways = model
        ? model.routes.map(route => TRANSPORTS[route.transport]!.name).join(' · ')
        : family.reachRoutes?.length ? `${family.reachRoutes.map(id => TRANSPORTS[id]!.name).join(' · ')} — no seat run yet`
        : family.reach?.length ? 'Reachable — no seat run yet' : 'Not reachable yet';
      return [link(family.name, familyHref(lab.slug, family.slug)), family.tagline, ways];
    }),
  ));

  doc.heading('The ways in');
  const transportIds: string[] = [];
  for (const model of modelsOfLab(lab.vendor)) {
    for (const route of model.routes) if (!transportIds.includes(route.transport)) transportIds.push(route.transport);
  }
  for (const family of familiesOf(lab.vendor)) {
    for (const id of family.reachRoutes ?? []) if (!transportIds.includes(id)) transportIds.push(id);
  }
  const wayLines = transportIds.map(transportId => {
    const transport = TRANSPORTS[transportId]!;
    const served = familiesOf(lab.vendor).filter(family => {
      if (family.reachRoutes?.includes(transportId)) return true;
      const model = family.modelSlug ? modelBySlug(family.modelSlug) : undefined;
      return model?.routes.some(route => route.transport === transportId);
    });
    const serves = served.length ? ` — serves ${served.map(family => link(family.name, familyHref(lab.slug, family.slug))).join(', ')}` : '';
    return `- **${link(transport.name, setupHref(transportId))}**${serves}`;
  });
  doc.md(wayLines.length ? wayLines.join('\n') : 'No route reaches this lab\'s models yet.');
  for (const model of modelsOfLab(lab.vendor).filter(model => !familyOfModel(model))) modelSection(doc, model);
  doc.note(`Verified on ${escapeHtml(VERIFIED_ON)}. Each route is marked verified — a seat the team has run — or listed, not yet verified.`);
  return doc.render();
}

// ---------------------------------------------------------------- one page per family, its versions

/** One figure as a table cell: the value as read, then the source page and the date it was read. */
const figureCell = (figure: Figure | undefined): string => {
  if (!figure) return '—';
  const source = FIGURE_SOURCES[figure.s]!;
  const note = figure.note ? ` ${figure.note}` : '';
  return `**${figure.v}** — ${link(source.label, source.href)} (read ${source.read}).${note}`;
};
/** One figure as a labeled list line: what it measures, then the sourced, dated value. The
 *  label takes a colon, so an unpublished field reads as one dash, not a dash after a dash. */
const figureBullet = (label: string, figure: Figure | undefined): string => `- **${label}:** ${figureCell(figure)}`;

/** One version as a section of the family's Versions page part: Abilities, Costs, then
 *  Benchmarks the lab itself reports. The anchor keeps the old catalog slug when the team
 *  runs that version, so every kept link to the model lands here. */
function versionSection(doc: Doc, family: Family, version: VersionFigures): void {
  doc.raw(`<h3 id="${escapeHtml(version.anchor)}">${escapeHtml(version.name)}${version.current ? ' — current' : ''}</h3>\n`);
  doc.md(`- **Model id:** ${version.apiId ? code(version.apiId) : '—'}${version.note ? `\n- ${inline(version.note)}` : ''}`);
  doc.md('**Abilities**');
  doc.md([
    figureBullet('Released', version.released),
    figureBullet('Context window', version.context),
    figureBullet('Max output', version.maxOut),
    figureBullet('Output speed', version.speed),
    figureBullet('Latency', version.latency),
  ].join('\n'));
  doc.md('**Costs**');
  const costs = [figureBullet('Input price', version.priceIn), figureBullet('Output price', version.priceOut)];
  for (const cost of version.extraCosts ?? []) {
    const source = FIGURE_SOURCES[cost.s]!;
    const note = cost.note ? ` ${cost.note}` : '';
    costs.push(`- **${cost.label}:** **${cost.v}** — ${link(source.label, source.href)} (read ${source.read}).${note}`);
  }
  doc.md(costs.join('\n'));
  if (version.benchmarks?.length) {
    doc.md('**Benchmarks — as reported by the lab**');
    doc.md(version.benchmarks.map(benchmark => {
      const source = FIGURE_SOURCES[benchmark.s]!;
      const note = benchmark.note ? ` — ${benchmark.note}` : '';
      return `- **${benchmark.name}** — ${benchmark.v} (${link(source.label, source.href)}, read ${source.read})${note}`;
    }).join('\n'));
  }
  if (family.modelSlug && version.anchor === family.modelSlug) doc.md('This is the version the seat lines above run.');
}

/** The Versions comparison: every version across, the costs and the family's own benchmark
 *  columns side by side, values verbatim — every one sourced and dated in its version's
 *  section below and in the Sources list. A dash is a figure the source does not publish. */
function versionsComparisonTable(family: Family): string {
  const versions = FIGURES.families[family.slug]!.versions;
  const benchmarkNames: string[] = [];
  for (const version of versions) for (const benchmark of version.benchmarks ?? []) if (!benchmarkNames.includes(benchmark.name)) benchmarkNames.push(benchmark.name);
  const value = (figure: Figure | undefined): string => figure?.v ?? '—';
  const benchmark = (version: VersionFigures, name: string): string => version.benchmarks?.find(entry => entry.name === name)?.v ?? '—';
  return mdTable(
    ['Version', 'Released', 'Context', 'Input price', 'Output price', ...benchmarkNames],
    versions.map(version => [
      `${link(version.name, `#${version.anchor}`)}${version.current ? ' — current' : ''}`,
      value(version.released),
      value(version.context),
      value(version.priceIn),
      value(version.priceOut),
      ...benchmarkNames.map(name => benchmark(version, name)),
    ]),
  );
}

/** The sources a family's figures were read from, in first-read order, for the Sources list —
 *  the family's own named sources first (the page a dashed-out family stands on, or the page
 *  its lineup was read from), then every figure's source. */
function usedFigureSources(family: Family): FigureSource[] {
  const ids: string[] = [];
  const claim = (id: string): void => { if (!ids.includes(id)) ids.push(id); };
  for (const id of FIGURES.families[family.slug]!.sources ?? []) claim(id);
  for (const version of FIGURES.families[family.slug]!.versions) {
    for (const figure of [version.released, version.context, version.maxOut, version.priceIn, version.priceOut, version.speed, version.latency]) {
      if (figure) claim(figure.s);
    }
    for (const benchmark of version.benchmarks ?? []) claim(benchmark.s);
    for (const cost of version.extraCosts ?? []) claim(cost.s);
  }
  return ids.map(id => FIGURE_SOURCES[id]!);
}

/** /models/<lab>/<family>/ — one family: what it is and where it fits for coding-agent work, the
 *  ways TeamCLI reaches it, and one block per version with its dated, sourced figures. */
export function familyPage(labSlug: string, familySlug: string): Rendered {
  const lab = need(labBySlug(labSlug), `has no lab "${labSlug}"`);
  const family = need(familiesOf(lab.vendor).find(entry => entry.slug === familySlug), `has no family "${familySlug}" under "${labSlug}"`);
  const model = family.modelSlug ? modelBySlug(family.modelSlug) : undefined;

  const doc = new Doc().h1(family.name);
  doc.note(`Part of <a href="${labHref(lab.slug)}">${escapeHtml(lab.name)}</a> on <a href="/models/">Models</a>.`);
  doc.md(`**${family.tagline}**`);
  doc.md(family.summary);

  doc.heading('What it is good at');
  doc.md(family.good.map(line => `- ${line}`).join('\n'));
  doc.heading('What it is less good at');
  doc.md(family.limits.map(line => `- ${line}`).join('\n'));

  doc.heading('Reaching it with TeamCLI');
  if (model) {
    doc.md(`TeamCLI runs ${escapeHtml(family.name)} as ${escapeHtml(model.name)}:`);
    modelWays(doc, model);
  } else if (family.reach?.length) {
    doc.md(family.reach.map(line => `- ${line}`).join('\n'));
  } else {
    doc.note(`TeamCLI cannot reach ${escapeHtml(family.name)} yet — no verified or listed route carries it. It is listed because ${escapeHtml(lab.name)} offers it today.`);
  }

  doc.heading('Versions');
  doc.md(`One block per version, the current one first, each with its own anchor. The comparison table puts the costs and the family's benchmark columns side by side; the values are verbatim, and every one is sourced and dated in its version's section below and in the Sources list. A dash means the source publishes no figure, and nothing here is estimated.`);
  doc.note('No independent intelligence or speed index is republished here: <a href="https://artificialanalysis.ai/models" rel="noopener noreferrer">Artificial Analysis</a> measures both across labs, and its terms allow the link but not the copy — its figures live on its own pages.');
  doc.raw(versionsComparisonTable(family));
  for (const version of FIGURES.families[family.slug]!.versions) versionSection(doc, family, version);

  doc.heading('Sources');
  doc.md(usedFigureSources(family).map(source => `- ${link(source.label, source.href)} — read ${source.read}`).join('\n'));
  doc.note(`Figures refreshed ${escapeHtml(FIGURES_REFRESHED_ON)}; benchmarks are vendor-reported. Prices are per million tokens unless a figure says otherwise.`);
  return doc.render();
}

/** /guide/ — the Guide section's index: the task guides planned, and where to start until they land. */
export function guideIndex(): Rendered {
  return new Doc()
    .h1('Guide')
    .md('Task guides for running a team with TeamCLI, start to finish. The first guides are on their way.')
    .heading('Guides')
    .md('- **Your first team** — write the team with `team init` and `team config`, start the session, and watch the seats come up.\n- **Running a release with TeamCLI** — take a change from a task to a reviewed, shipped release.')
    .note('These first guides are coming. Until then, start with <a href="/docs/">the documentation</a> and <a href="/models/">the models</a>.')
    .render();
}
