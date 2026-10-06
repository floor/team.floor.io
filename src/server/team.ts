// Where the site's content comes from: the published `team` package, extracted at its tag.
//
// Nothing is copied by hand. `scripts/content.ts` extracts the ref's README, its
// docs/ and examples/ into content/team/ (gitignore'd), and every page reads from
// there, so the site cannot drift from the package it documents. The content
// script reads the published package's version and extracts that tag. TEAM_REF
// overrides it; the version on the page is never typed here.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const root = resolve(import.meta.dir, '../..');
/** The clone the content is extracted from. Override with TEAM_REPO. */
export const TEAM_REPO = process.env.TEAM_REPO ?? resolve(root, '../team');
/** Set TEAM_REF to extract a chosen tag. Unset, the content script uses the published package. */
export const TEAM_REF = process.env.TEAM_REF ?? '';
export const contentDir = resolve(root, 'content/team');

export const contentReady = (): boolean => existsSync(resolve(contentDir, 'README.md'));
/** A file of the extracted ref, as text. Throws when the content was never fetched. */
export const read = (path: string): string => readFileSync(resolve(contentDir, path), 'utf8');

/** The tool's version, read from the package.json the content script extracted. A missing file or a missing version throws: the eyebrow cannot fall back to a number typed in the page. */
export function packageVersion(): string {
  let parsed: { version?: unknown };
  try {
    parsed = JSON.parse(read('package.json')) as { version?: unknown };
  } catch {
    throw new Error('content/team/package.json is missing: run `bun run content`');
  }
  if (typeof parsed.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(parsed.version)) {
    throw new Error('content/team/package.json has no version');
  }
  return parsed.version;
}

export interface RefInfo { ref: string; commit: string; version: string; date: string }
/** What the pages say they are built from: the ref, its commit, the package version, its date. */
export function refInfo(): RefInfo {
  try {
    return JSON.parse(read('.ref.json')) as RefInfo;
  } catch {
    return { ref: TEAM_REF, commit: TEAM_REF, version: '', date: '' };
  }
}
