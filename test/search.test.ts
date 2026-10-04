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
    const file = documents.find(document => document.id === '/docs/file/')!;
    expect(file.text).toContain('seats');
    expect(file.text).not.toContain('<');
    expect(file.text).not.toContain('&amp;');
    expect(file.description.length).toBeGreaterThan(0);
  });

  test('the commands group is named, so a result can say what it is', () => {
    expect(documents.find(document => document.id === '/docs/commands/up/')?.kind).toBe('Commands');
    expect(documents.find(document => document.id === '/docs/file/')?.kind).toBe('Documentation');
  });
});

describe('a query', () => {
  test('a word of the reference finds the pages that say it', () => {
    const results = searchSite('seat');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(result => routes.has(result.path))).toBe(true);
    expect(results.map(result => result.path)).toContain('/docs/file/');
  });

  test("a command's own name finds its page", () => {
    expect(searchSite('doctor').map(result => result.path)).toContain('/docs/commands/doctor/');
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
