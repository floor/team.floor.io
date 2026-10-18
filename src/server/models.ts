// The Models section, built from one data file: src/data/models.json.
//
// A seat is a model reached by a route. The catalog holds, for each model, the routes it
// has — its own CLI, a connector app, Claude Code with a provider endpoint, or the API
// directly — the subscription or API each route spends, the TeamCLI seat line it maps to,
// and whether the team has run it (verified) or only documented it (listed). Nothing here
// is a price or a benchmark; sign-up and pricing live on each vendor's own pages, linked.
//
// The shape is the one TeamCLI's own registry (registry/models.json) is being built to, so
// this file can be replaced by that registry without the pages changing: model × transport
// × subscription × seat line maps one row to one row. A malformed catalog throws at load,
// the same discipline the reference pages hold to, so a broken catalog is a failed build.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { escapeHtml, type Rendered } from './markdown';
import { Doc, inline } from './pages';

/** What the catalog asked for and did not have. */
export class CatalogError extends Error {}

export interface Seat { cli: string; vendor: string; model?: string; version?: string; display?: string; launch: string }
export interface Route { transport: string; status: 'verified' | 'listed'; bill?: string; seat?: Seat; quirks?: string[] }
export interface Model { slug: string; name: string; vendor: string; summary: string; routes: Route[]; quirks?: string[] }
export interface Transport {
  name: string; kind: string; vendor: string; cli: string | null; reaches: string;
  install: string | null; installHref: string | null; account: string; accountHref: string | null;
  login: string; profileNote: string | null;
}
export interface Catalog { verifiedOn: string; transports: Record<string, Transport>; models: Model[] }

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
  need(parsed.transports && typeof parsed.transports === 'object', 'has no transports');
  for (const [id, transport] of Object.entries(parsed.transports)) {
    need(transport.name, `transport "${id}" has no name`);
    need(transport.vendor, `transport "${id}" has no vendor`);
    need(transport.reaches, `transport "${id}" says nothing about what it reaches`);
    need(transport.account, `transport "${id}" names no account`);
    need(transport.login, `transport "${id}" names no log-in step`);
    need(['own-cli', 'connector', 'endpoint', 'cloud', 'api'].includes(transport.kind), `transport "${id}" has an unknown kind "${transport.kind}"`);
  }
  need(Array.isArray(parsed.models) && parsed.models.length > 0, 'has no models');
  const slugs = new Set<string>();
  for (const model of parsed.models) {
    need(model.slug && /^[a-z0-9-]+$/.test(model.slug), `has a model with a bad slug "${model.slug}"`);
    need(!slugs.has(model.slug), `lists the slug "${model.slug}" twice`);
    slugs.add(model.slug);
    need(model.name, `model "${model.slug}" has no name`);
    need(model.vendor, `model "${model.slug}" has no vendor`);
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
export const VERIFIED_ON = CATALOG.verifiedOn;

/** A model's own page path. */
export const modelHref = (slug: string): string => `/models/${slug}/`;
/** The landing anchor for one transport's set-up, for a model page to link into. */
const setupAnchor = (id: string): string => `setup-${id}`;
/** A route's status in words. */
const statusLabel = (status: Route['status']): string => (status === 'verified' ? 'Verified' : 'Listed — not yet verified');

/** A markdown table from header cells and rows of markdown cells. */
function table(head: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

const code = (text: string): string => `\`${text}\``;
const link = (text: string, href: string): string => `[${text}](${href})`;

/** The transports in the catalog's own order. */
const transportEntries = (): [string, Transport][] => Object.entries(TRANSPORTS);

/**
 * /models/ — "Set up your agents": the route for each CLI and app (install, the subscription
 * or API key, log in, and the TeamCLI seat line), then a card per model.
 */
export function modelsLanding(): Rendered {
  const doc = new Doc().h1('Set up your agents');
  doc.md('A TeamCLI seat is a model reached by a route. Install the CLI or app the route uses, get the subscription or API key it spends, log in, and name it in the team file. This page sets up each route; a page of its own then documents each model and the seat line for every way to reach it.');
  doc.md('A route is one of four shapes: a lab\'s **own CLI**, a **connector app** that carries several labs (Antigravity, Cursor), **Claude Code pointed at a provider\'s endpoint**, or the **API directly**. Each spends a different subscription or API bill, noted below.');
  doc.note('Every route is marked <strong>verified</strong> — a seat the team has run — or <strong>listed</strong> — a documented route not yet run. A model page carries the mark for each of its routes.');

  for (const [id, transport] of transportEntries()) {
    doc.raw(`<h2 id="${escapeHtml(setupAnchor(id))}">${escapeHtml(transport.name)}</h2>\n`);
    doc.toc.push({ title: transport.name, id: setupAnchor(id) });
    doc.md(`${transport.reaches} *(${transport.vendor})*`);
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
    doc.md(steps.map(step => `- ${step}`).join('\n'));
    if (transport.profileNote) doc.note(inline(transport.profileNote));
  }

  doc.heading('Use it with TeamCLI');
  doc.md('In the team file, each seat names its model and how it is launched. The seat line is the same six fields whichever route carries the model:');
  doc.md(table(
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
  doc.note('A launcher script, an account, a token or a key never goes in the team file. An Anthropic-compatible endpoint reads its key from the OS keychain through a small launcher on the PATH.');

  doc.heading('The models');
  const cards = MODELS.map(model =>
    `<a class="doc-entry" href="${modelHref(model.slug)}"><span class="doc-entry__name">${escapeHtml(model.name)}</span>` +
    `<span class="doc-entry__summary">${escapeHtml(model.summary)}</span>` +
    `<span class="doc-entry__who">${escapeHtml(model.vendor)}</span></a>`).join('');
  doc.raw(`<div class="doc-grid">${cards}</div>\n`);
  doc.note(`Verified on ${escapeHtml(VERIFIED_ON)}.`);
  return doc.render();
}

/** /models/<slug>/ — one model: the ways to reach it, the seat line per route, its quirks, and when each route was verified. */
export function modelPage(slug: string): Rendered {
  const model = need(MODELS.find(entry => entry.slug === slug), `has no model "${slug}"`);
  const doc = new Doc().h1(model.name);
  doc.md(model.summary);
  doc.note(`Part of <a href="/models/">Set up your agents</a> — ${escapeHtml(model.vendor)}.`);

  doc.heading('Ways to reach it');
  doc.md(table(
    ['Route', 'Spends', 'Status'],
    model.routes.map(route => {
      const transport = TRANSPORTS[route.transport]!;
      return [
        link(transport.name, `/models/#${setupAnchor(route.transport)}`),
        route.bill ?? transport.account,
        statusLabel(route.status),
      ];
    }),
  ));

  const seated = model.routes.filter((route): route is Route & { seat: Seat } => Boolean(route.seat));
  if (seated.length) {
    doc.heading('The seat line');
    doc.md('Each route maps to a TeamCLI seat line — the same fields, written generically. No machine paths, no launcher script of anybody\'s, no team\'s own seat names.');
    const dash = '—';
    doc.md(table(
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
    if (seated.some(route => !route.seat.display)) {
      doc.note('A blank <code>display</code> is a seat whose model is chosen inside the connector; <code>team status</code> then reads the running model off the connector\'s own status row.');
    }
  }

  const quirks = [...(model.quirks ?? []), ...model.routes.flatMap(route => route.quirks ?? [])];
  if (quirks.length) {
    doc.heading('Known quirks');
    doc.md(quirks.map(quirk => `- ${quirk}`).join('\n'));
  }

  doc.note(`Verified on ${escapeHtml(VERIFIED_ON)}. Each route above is marked verified — a seat the team has run — or listed, not yet verified.`);
  return doc.render();
}

/** /guide/ — the Guide section's index: the task guides planned, and where to start until they land. */
export function guideIndex(): Rendered {
  return new Doc()
    .h1('Guide')
    .md('Task guides for running a team with TeamCLI, start to finish. The first guides are on their way.')
    .heading('Guides')
    .md('- **Your first team** — write `.agents/team.yaml`, start the session, and watch the seats come up.\n- **Running a release with TeamCLI** — take a change from a task to a reviewed, shipped release.')
    .note('These first guides are coming. Until then, start with <a href="/docs/">the documentation</a> and <a href="/models/">Set up your agents</a>.')
    .render();
}
