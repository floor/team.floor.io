// Extracts the content the site is built from: the published `team` package's tag,
// read with `git archive` so the clone is never checked out, edited or written to.
// The archive lands in content/team/ (gitignore'd); every page reads it from there.
// The version is read from the registry at build time. TEAM_REF overrides the tag.
//
//   bun scripts/content.ts          # TEAM_REPO (default ../team); TEAM_REF optional
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { contentDir, root, TEAM_REPO } from '../src/server/team';

/** The version npm publishes for `team`. The eyebrow reads this, so it is never typed here. */
function publishedVersion(): string {
  const result = Bun.spawnSync(['npm', 'view', 'team', 'version'], { stdout: 'pipe', stderr: 'pipe' });
  const version = result.stdout.toString().trim();
  if (result.exitCode !== 0 || !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`Could not read the published version of team${result.stderr.toString().trim() ? `: ${result.stderr.toString().trim()}` : ''}.`);
    process.exit(1);
  }
  return version;
}

const pinned = process.env.TEAM_REF?.trim() ?? '';
const published = pinned ? '' : publishedVersion();
const TEAM_REF = pinned || `v${published}`;

if (!existsSync(resolve(TEAM_REPO, '.git'))) {
  console.error(`No team checkout at ${TEAM_REPO}. Clone floor/teamcli beside this repository, or set TEAM_REPO.`);
  process.exit(1);
}

const git = (...args: string[]) => Bun.spawnSync(['git', '-C', TEAM_REPO, ...args], { stdout: 'pipe', stderr: 'pipe' });

const commit = git('rev-parse', '--verify', `${TEAM_REF}^{commit}`);
if (commit.exitCode !== 0) {
  console.error(`TEAM_REF ${TEAM_REF} does not resolve to a commit in ${TEAM_REPO}.`);
  process.exit(1);
}
const sha = commit.stdout.toString().trim();
const packageJson = git('show', `${sha}:package.json`);
if (packageJson.exitCode !== 0) {
  console.error(`No package.json at ${TEAM_REF} in ${TEAM_REPO}.`);
  process.exit(1);
}
const version = (JSON.parse(packageJson.stdout.toString()) as { version: string }).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`package.json at ${TEAM_REF} has no version.`);
  process.exit(1);
}
if (published && version !== published) {
  console.error(`The tag ${TEAM_REF} says ${version}, and the published package says ${published}.`);
  process.exit(1);
}
// The ref's own date: what the pages are built against, and the sitemap's lastmod for
// a page whose text comes from the reference.
const date = git('log', '-1', '--format=%cd', '--date=short', sha).stdout.toString().trim();
// The site shows the docs and the example, and docs:check validates the example's YAML with
// the ref's own validator, which lives in its src/.
const paths = ['README.md', 'docs', 'examples', 'src', 'package.json', 'LICENSE'];

await rm(contentDir, { recursive: true, force: true });
await mkdir(contentDir, { recursive: true });
const archive = Bun.spawn(['git', '-C', TEAM_REPO, 'archive', '--format=tar', sha, ...paths], { stdout: 'pipe', stderr: 'inherit' });
const untar = Bun.spawn(['tar', '-x', '-C', contentDir], { stdin: archive.stdout, stdout: 'inherit', stderr: 'inherit' });
if (await archive.exited !== 0 || await untar.exited !== 0) {
  console.error('Extracting the team archive failed.');
  process.exit(1);
}
await writeFile(resolve(contentDir, '.ref.json'), `${JSON.stringify({ ref: TEAM_REF, commit: sha, version, date }, null, 2)}\n`);
console.log(`Content: team ${version} at ${TEAM_REF} (${sha.slice(0, 7)}) into ${resolve(root, 'content/team')}.`);
