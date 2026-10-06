// The site's icons and its link preview, drawn in a browser and committed: the server
// serves them from public/ and a deploy builds nothing. Run after changing the mark or
// the card below: `bun run brand-images`. The browser opens once and closes.
//
//   - favicon.svg: the mark, light and dark by the reader's own setting.
//   - favicon.ico: the same mark at 16 and 32 px (PNG payloads in an ICO).
//   - apple-touch-icon.png: 180 px, the mark on the dark scheme, square: iOS rounds it.
//   - og-image.png: the 1200×630 link preview. The eyebrow is TeamCLI, the line under
//     the wordmark is the manifesto's, and the pills are read from the package.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { headline, homeSamples, installLine, tagline } from '../src/server/pages';
import { commandNames, README } from '../src/server/reference';
import { escapeHtml } from '../src/server/markdown';

const root = resolve(import.meta.dir, '..');
const publicDir = resolve(root, 'public');

// The colour scheme, taken from material's ocean theme: the dark side for the icons,
// since a favicon's pixels cannot read the page's own mode, and both sides for the SVG.
const DARK = { surface: '#191c1e', primary: '#8dcdff', text: '#e1e3e4', muted: '#c1c8cd', outline: '#41484d' };
const LIGHT = { surface: '#f8fdff', primary: '#006493' };

/** The mark's glyph: a prompt and a cursor, drawn as paths so no font has to be there. */
const glyph = (colour: string): string =>
  `<g fill="none" stroke="${colour}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M8.5 10.5 13.5 16l-5 5.5"/><path d="M16 21.5h7.5"/></g>`;

/**
 * The mark in a rounded square. `mode` picks the colours: a rendered image has to be
 * told (a headless browser reads `prefers-color-scheme` as light), while favicon.svg
 * is left adaptive so a reader's own setting decides.
 */
function markSvg(mode: 'dark' | 'light' | 'adaptive'): string {
  const scheme = (colour: 'surface' | 'primary', adaptive: boolean) =>
    mode === 'dark' || (adaptive && mode === 'adaptive') ? DARK[colour] : LIGHT[colour];
  const tile = (fill: string, stroke: string) => `<rect width="32" height="32" rx="7" fill="${fill}"/>${glyph(stroke)}`;
  const body = mode === 'adaptive'
    ? `<style>.light { display: none } @media (prefers-color-scheme: light) { .dark { display: none } .light { display: inline } }</style>` +
      `<g class="dark">${tile(DARK.surface, DARK.primary)}</g><g class="light">${tile(LIGHT.surface, LIGHT.primary)}</g>`
    : tile(scheme('surface', false), scheme('primary', false));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" role="img" aria-label="team">${body}</svg>\n`;
}

/** An ICO of PNG images: a 6-byte header, a 16-byte entry per image, then the images. */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size % 256, entry);
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(image => image.png)]);
}

// ── the link preview ──────────────────────────────────────────────────────────

if (tagline === headline || tagline.includes(headline)) throw new Error('the card would repeat the headline');
/** The card's facts, each read from the package rather than written here. */
const node = /Node \d+ or later/.exec(README)?.[0];
if (!node) throw new Error('the README no longer says which Node version runs team: the card would have to claim one');
const pills = [node, 'MIT', `${commandNames().length} commands`];

/** The install line, then the reference's own `team up --dry-run` transcript. */
const lines = [installLine(), ...homeSamples()[1]!.fence.text.split('\n').map(line => line.replace(/^\$ /, ''))];
const transcript = lines.filter(line => line.trim()).slice(0, 9)
  .map(line => escapeHtml(line).replace(/^((?:npm|team|herdr)\b[^\n]*)/, '<span class="command">$1</span>'))
  .join('\n');

const card = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative; color: ${DARK.text};
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
    background: radial-gradient(ellipse 1000px 760px at 8% -10%, #0b3448 0%, #10242c 42%, #0e1113 100%); }
  .text { position: absolute; left: 84px; top: 84px; width: 620px; }
  .eyebrow { font-size: 23px; font-weight: 700; letter-spacing: 5px; color: ${DARK.primary}; }
  .wordmark { display: flex; align-items: center; gap: 20px; margin: 30px 0 26px; }
  .tile { width: 78px; height: 78px; border-radius: 20px; background: rgba(141,205,255,.13);
    border: 2px solid rgba(141,205,255,.28); display: flex; align-items: center; justify-content: center; }
  .tile svg { width: 54px; height: 54px; }
  .wordmark span { font-size: 74px; font-weight: 700; letter-spacing: -2.5px; white-space: nowrap; }
  .tagline { font-size: 29px; line-height: 1.4; color: ${DARK.muted}; }
  .pills { display: flex; gap: 10px; margin-top: 34px; }
  .pill { font-size: 18px; padding: 9px 16px; border-radius: 999px; border: 1.5px solid ${DARK.outline};
    background: rgba(255,255,255,.04); color: ${DARK.text}; white-space: nowrap; }
  .panel { position: absolute; right: 76px; top: 84px; width: 380px; height: 462px; border-radius: 18px;
    background: #0b0e10; border: 1.5px solid ${DARK.outline}; overflow: hidden; display: flex; flex-direction: column; }
  .bar { padding: 13px 18px; border-bottom: 1.5px solid ${DARK.outline}; color: #8b9297; font-size: 15px; }
  .bar i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #3b4247; margin-right: 7px; }
  pre { flex: 1; margin: 0; padding: 16px 18px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px; line-height: 1.85; color: #9aa2a7; white-space: pre-wrap; overflow-wrap: anywhere; }
  pre .command { color: ${DARK.text}; }
  pre .command::before { content: "$ "; color: ${DARK.primary}; }
</style></head><body>
  <div class="text">
    <div class="eyebrow">TEAMCLI</div>
    <div class="wordmark"><span class="tile">${markSvg('dark').replace('<rect width="32" height="32" rx="7" fill="#191c1e"/>', '').replace(/width="32" height="32"/, '').replace('role="img" aria-label="team"', 'aria-hidden="true"')}</span><span>team</span></div>
    <div class="tagline">${escapeHtml(tagline)}</div>
    <div class="pills">${pills.map(pill => `<span class="pill">${pill}</span>`).join('')}</div>
  </div>
  <div class="panel"><div class="bar"><i></i><i></i><i></i>Terminal</div><pre>${transcript}</pre></div>
</body></html>`;

// ── draw them ─────────────────────────────────────────────────────────────────

/** The mark at a size, on a background, ready to be screenshotted. */
async function renderMark(page: import('playwright').Page, size: number, padding = 0, background = 'transparent'): Promise<Buffer> {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:${background}}svg{display:block;box-sizing:border-box;width:${size}px;height:${size}px;padding:${padding}px}</style>` +
    markSvg('dark').replace(' role="img" aria-label="team"', ''),
  );
  return page.screenshot({ omitBackground: background === 'transparent' });
}

await mkdir(publicDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await writeFile(resolve(publicDir, 'favicon.svg'), markSvg('adaptive'));
  const icon32 = await renderMark(page, 32);
  const icon16 = await renderMark(page, 16);
  await writeFile(resolve(publicDir, 'favicon.ico'), ico([{ size: 16, png: icon16 }, { size: 32, png: icon32 }]));
  await writeFile(resolve(publicDir, 'apple-touch-icon.png'), await renderMark(page, 180, 26, DARK.surface));
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(card);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await writeFile(resolve(publicDir, 'og-image.png'), await page.screenshot());
} finally {
  await browser.close();
}
console.log('wrote public/favicon.svg, public/favicon.ico, public/apple-touch-icon.png and public/og-image.png');
