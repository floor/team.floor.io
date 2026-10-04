// Where the site's content comes from: the `team` repository at one pinned ref.
//
// Nothing is copied by hand. `scripts/content.ts` extracts the ref's README, its
// docs/ and examples/ into content/team/ (gitignore'd), and every page reads from
// there, so the site cannot drift from the package it documents. TEAM_REF is the
// one setting to move when the package is tagged: `v0.1.2`, the commit floor/team
// released 0.1.2 from.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const root = resolve(import.meta.dir, '../..');
/** The clone the content is extracted from. Override with TEAM_REPO. */
export const TEAM_REPO = process.env.TEAM_REPO ?? resolve(root, '../team');
/** The ref every page is built against. Override with TEAM_REF. */
export const TEAM_REF = process.env.TEAM_REF ?? 'v0.1.2';
export const contentDir = resolve(root, 'content/team');

export const contentReady = (): boolean => existsSync(resolve(contentDir, 'README.md'));
/** A file of the extracted ref, as text. Throws when the content was never fetched. */
export const read = (path: string): string => readFileSync(resolve(contentDir, path), 'utf8');

export interface RefInfo { ref: string; commit: string; version: string; date: string }
/** What the pages say they are built from: the ref, its commit, the package version, its date. */
export function refInfo(): RefInfo {
  try {
    return JSON.parse(read('.ref.json')) as RefInfo;
  } catch {
    return { ref: TEAM_REF, commit: TEAM_REF, version: '', date: '' };
  }
}
