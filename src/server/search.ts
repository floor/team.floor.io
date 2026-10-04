// The site's search: one MiniSearch index over the pages, built when the server starts
// from the same page list the routes serve. /api/search answers the dialog in
// src/client/search.ts; the index itself never leaves the server.
import MiniSearch from 'minisearch';
import { decodeEntities } from './markdown';
import { crewWords, descriptionFor, homePoints, info, nav, pages } from './pages';

/** A page's rendered HTML as searchable text: the tags out, the entities decoded. */
function plainText(html: string): string {
  return decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export interface SearchDocument { id: string; title: string; headings: string; text: string; description: string; kind: string }

/** Every page of the site as a search document: the home page and Privacy included. */
export function searchDocuments(): SearchDocument[] {
  const home = {
    id: '/', title: `team — a project's AI team, ${crewWords}`, headings: 'team', kind: 'Home',
    description: descriptionFor('/'),
    text: plainText(homePoints().map(point => `${point.title}. ${point.text}`).join(' ')),
  };
  const privacy = { id: '/privacy/', title: 'Privacy — team', headings: 'Privacy', kind: 'Page', description: descriptionFor('/privacy/'), text: '' };
  const docs = pages().map(page => ({
    id: page.path,
    title: page.title,
    headings: page.toc.map(item => item.title).join(' · '),
    text: plainText(page.html),
    description: page.description,
    kind: page.path === '/docs/commands/' || page.path.startsWith('/docs/commands/') ? 'Commands' : 'Documentation',
  }));
  return [home, ...docs, privacy];
}

export const documents = searchDocuments();

export const search = new MiniSearch<SearchDocument>({
  fields: ['title', 'headings', 'text'],
  storeFields: ['title', 'description', 'kind'],
  searchOptions: { boost: { title: 4, headings: 2 }, prefix: true, fuzzy: 0.2, combineWith: 'AND' },
});
search.addAll(documents);

/** The search results for a query, best first, each with the page it opens. */
export function searchSite(query: string, limit = 10): { path: string; title: string; description: string; kind: string }[] {
  if (!query.trim()) return [];
  return search.search(query).slice(0, limit).map(result => ({
    path: result.id,
    title: String(result.title ?? ''),
    description: String(result.description ?? ''),
    kind: String(result.kind ?? ''),
  }));
}

/** The pages the dialog offers before anything is typed: the documentation, in order. */
export const suggestions = nav.flatMap(group =>
  group.items.map(item => ({ path: item.href, title: item.name, description: descriptionFor(item.href), kind: group.label })));
