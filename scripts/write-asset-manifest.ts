// After the build, copy every asset the pages link to a content-hashed name and write
// dist/asset-manifest.json. Templates keep the logical path (`/dist/site.js`); the
// server rewrites it from this file. The unhashed file stays too, so a page cached
// before hashed names still has a URL that answers.
//
// Hashed copies that are no longer in the manifest stay in dist, so a browser holding
// yesterday's HTML keeps working; `bun run clean` (or a fresh clone) starts over.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const dist = resolve(root, 'dist');

const hashOf = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex').slice(0, 10);
const hashedName = (name: string, hash: string) => {
  const extension = extname(name);
  return `${name.slice(0, -extension.length)}.${hash}${extension}`;
};
/** A copy this script wrote on an earlier run. Walking it again would hash the hash. */
const alreadyHashed = (name: string) => /\.[a-f0-9]{10}\.(?:js|css|svg|png|ico)$/.test(name);

const manifest: Record<string, string> = {};

/** Write the hashed copy beside the original, and remember the URL the pages should use. */
async function publish(file: string) {
  const bytes = readFileSync(file);
  const directory = dirname(file);
  const name = hashedName(basename(file), hashOf(bytes));
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, name), bytes);
  manifest[`/dist/${relative(dist, file).split('\\').join('/')}`] = `/dist/${relative(dist, join(directory, name)).split('\\').join('/')}`;
}

function walk(directory: string, accept: (name: string) => boolean): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path, accept);
    return entry.isFile() && accept(entry.name) && !alreadyHashed(entry.name) ? [path] : [];
  });
}

// The built client scripts and the stylesheet bundles, and nothing else: dist holds
// no other kind of file the pages link.
for (const file of walk(dist, name => name.endsWith('.js') || name.endsWith('.css'))) await publish(file);

await writeFile(resolve(dist, 'asset-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Hashed ${Object.keys(manifest).length} assets.`);
