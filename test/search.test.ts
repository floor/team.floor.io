// The search index: one document per page, built from what the page serves, and a query
// answered over it. Only pages that exist, so every result is a place to go.
import { describe, expect, test } from 'bun:test';
import { documents, searchSite, suggestions } from '../src/server/search';
import { pages } from '../src/server/pages';

const routes = new Set(['/', '/privacy/', ...pages().map(page => page.path)]);

describe('the index', () => {
  test('every page of the site, and only pages of the site', () => {
    expect(new Set(documents.map(document => document.id))).toEqual(routes);
  });

  test('a document carries the text a reader sees, not the markup', () => {
    const file = documents.find(document => document.id === '/docs/config/')!;
    expect(file.text).toContain('seats');
    // The reference's prose shows metavariable placeholders as reader-visible text
    // (<home>, <entity>, <iso>, <name>, rendered from code spans). Those aren't real
    // HTML elements, so any OTHER tag-shaped token is leaked markup — which must never
    // reach the search text. A plain `no <` guard would false-trip on the placeholders.
    const placeholders = new Set(['<home>', '<entity>', '<iso>', '<name>', '<team id>', '<path>', '<value>']);
    const tags = (file.text.match(/<\/?[a-zA-Z][^<>]*>/g) ?? []).filter(tag => !placeholders.has(tag));
    expect(tags).toEqual([]);
    expect(file.text).not.toContain('&amp;');
    expect(file.description.length).toBeGreaterThan(0);
  });

  test('the commands group is named, so a result can say what it is', () => {
    expect(documents.find(document => document.id === '/docs/commands/up/')?.kind).toBe('Commands');
    expect(documents.find(document => document.id === '/docs/config/')?.kind).toBe('Documentation');
  });
});

describe('a query', () => {
  test('a word of the reference finds the pages that say it', () => {
    const results = searchSite('seat');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(result => routes.has(result.path))).toBe(true);
    expect(results.map(result => result.path)).toContain('/docs/config/seats/');
  });

  test("a command's own name finds its page", () => {
    expect(searchSite('doctor').map(result => result.path)).toContain('/docs/commands/doctor/');
  });

  test('a command page ranks first for its own name, and no page serves a command the reference dropped', () => {
    expect(searchSite('doctor', 50)[0]?.path).toBe('/docs/commands/doctor/');
    // The reference has no approve command, so nothing may answer for it — not even the
    // file pages that still name the act of approving.
    expect(documents.some(document => document.id === '/docs/commands/approve/')).toBe(false);
    expect(searchSite('approve', 50).map(result => result.path)).not.toContain('/docs/commands/approve/');
  });

  test('a query with nothing in it answers nothing', () => {
    expect(searchSite('')).toEqual([]);
    expect(searchSite('   ')).toEqual([]);
  });

  test('the markup characters of a query are read as text', () => {
    expect(() => searchSite('<script> & "x"')).not.toThrow();
  });

  test('the limit is the limit', () => {
    expect(searchSite('team', 3).length).toBeLessThanOrEqual(3);
  });
});

describe('before anything is typed', () => {
  test('the dialog offers the documentation, each a page that exists', () => {
    expect(suggestions.length).toBeGreaterThan(10);
    expect(suggestions.every(suggestion => routes.has(suggestion.path))).toBe(true);
    expect(suggestions.every(suggestion => suggestion.description.length > 0)).toBe(true);
    expect(suggestions[0]).toEqual({ path: '/docs/', title: 'Getting started', description: expect.any(String), kind: 'Documentation' });
  });
});
