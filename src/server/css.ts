// The stylesheets a page asks for.
//
// material's own sheets — the colour theme, its tokens and the components the pages
// use — are served as files of their own under /dist/material/, content-hashed and
// cached for a year: they change when material is upgraded, not when a page is edited.
// Each page type then links one bundle of the site's own sheets, written by
// scripts/build.ts. The site is small, so those sheets are joined and served as they
// are written; there is no minifier between the source and what a browser reads.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const style = (name: string) => readFileSync(resolve(root, 'styles', `${name}.css`), 'utf8');
const material = (path: string) => readFileSync(resolve(root, 'node_modules/material/dist', path), 'utf8');

/**
 * The colour scheme: one seed of `material` 3.0.1, light and dark. It defines
 * `--mtrl-sys-color-*` under `[data-theme=ocean]` and
 * `[data-theme=ocean][data-theme-mode=dark]`, which base.eta sets on <html>.
 */
export const theme = (): string => material('themes/ocean.css');

/**
 * material's tokens other than colour — the type scale and the shape scale — its ripple
 * keyframes, and the two resets its components expect. From base.css, without base.css's
 * own page and body styles, which are for a material application, not for a page of this
 * site: those resets are scoped to the components the site uses.
 */
export function tokens(css = material('styles/base.css')): string {
  const start = css.indexOf(':root{--mtrl-ref-typeface');
  const ripple = css.indexOf('.mtrl-ripple{');
  const rippleEnd = css.indexOf('}}', css.indexOf('@keyframes mtrl-ripple-expand')) + 2;
  const resets = [...css.matchAll(/(?<=[}])(button|ul,ol)(\{[^}]*\})/g)].map(([, selector, body]) => `:where(.mtrl-button,.mtrl-icon-button) :is(${selector})${body}`);
  if (start < 0 || ripple < 0 || rippleEnd < 2 || resets.length !== 2) throw new Error('material base.css: tokens, ripple or resets not found');
  return `${css.slice(start, css.indexOf('}', start) + 1)}\n${css.slice(ripple, rippleEnd)}\n@layer mtrl.base{${resets.join('')}}`;
}

/** material's own sheets, in the order a page links them. */
export const materialSheets: { url: string; read: () => string }[] = [
  { url: '/dist/material/theme.css', read: theme },
  { url: '/dist/material/tokens.css', read: () => tokens() },
  ...(['button', 'icon-button'] as const).map(component => ({ url: `/dist/material/${component}.css`, read: () => material(`styles/${component}.css`) })),
];

/** The site's own sheets one bundle joins, in order, after material's. */
export const stylesheetBundles = {
  home: ['tokens', 'shell', 'content', 'syntax', 'homepage', 'search'],
  page: ['tokens', 'shell', 'content', 'syntax', 'search'],
} as const;

export type StylesheetBundle = keyof typeof stylesheetBundles;

/** A page type's own stylesheet: the site's sheets, in the order they are written to. */
export function bundleCss(name: StylesheetBundle): string {
  return `${stylesheetBundles[name].map(style).join('\n')}\n`;
}
