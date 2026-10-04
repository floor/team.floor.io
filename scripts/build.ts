// The build: the client script, one stylesheet per page type, then the hashed names
// and the manifest the server reads. The pages themselves are rendered on request —
// there is nothing to pre-render, so a build never touches the HTML.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bundleCss, materialSheets, stylesheetBundles, type StylesheetBundle } from '../src/server/css';

const root = resolve(import.meta.dir, '..');
const dist = resolve(root, 'dist');

// The one client script. The search dialog is a module inside it, so a page asks for
// one file and nothing else; the home page reads without it.
const result = await Bun.build({
  entrypoints: [resolve(root, 'src/client/site.ts')],
  outdir: dist,
  naming: 'site.js',
  target: 'browser',
  minify: true,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// material's own sheets, then one stylesheet per page type: material changes when it is
// upgraded, a page's sheets when the site is edited, so the two are cached apart.
const materialDir = resolve(dist, 'material');
await mkdir(materialDir, { recursive: true });
await Promise.all(materialSheets.map(sheet => writeFile(resolve(dist, sheet.url.slice('/dist/'.length)), sheet.read())));

const cssDir = resolve(dist, 'css');
await mkdir(cssDir, { recursive: true });
await Promise.all((Object.keys(stylesheetBundles) as StylesheetBundle[]).map(name =>
  writeFile(resolve(cssDir, `${name}.css`), bundleCss(name))));

// The hashed names the templates' URLs are rewritten to, and dist/asset-manifest.json.
const manifest = Bun.spawnSync(['bun', resolve(root, 'scripts/write-asset-manifest.ts')], { stdout: 'inherit', stderr: 'inherit' });
if (manifest.exitCode !== 0) process.exit(1);
console.log('Built site.js and the stylesheets.');
