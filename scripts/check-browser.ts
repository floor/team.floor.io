// test:browser — the site in a real browser, once, at the end of a cut.
//
//	1. Every width the reader may arrive at — 390, 768, 1440 — in light and in dark:
//	   the page fits without a sideways scroll, the theme actually changed the colours,
//	   the content is there, and nothing was logged to the console.
//	2. The home page with JavaScript off: the spec's promise that no page needs the
//	   client to exist, and the home page least of all.
//	3. What needs the client, on the page that carries it: the dialog (⌘K, a query, a
//	   result, Escape), the theme toggle, what it remembers, and the copy button.
//	4. The home page's hero at 390, 375 and 1440: the block, each child's own content and the
//	   two pills' combined bounds within 2px of the viewport's centre — measured on what the
//	   reader sees, not on the full-width flex row, whose own box sits on the centre whatever
//	   it does with its buttons — and both pills — the reset zeroes every padding, so the
//	   hero's scoped rule is what carries theirs — 40px tall, one line each, no overflow,
//	   centred, equal padding left and right.
//	5. Prose links: the site's link colour in both themes — the --accent token itself held
//	   to resolving and to differing from the body's own text, and no anchor on the pages in
//	   the browser's default blue (the landing's sentence under the transcripts once was,
//	   unreadable on the dark background — and its replacement colour alone did not carry a
//	   link's cue either) — and every name the prose rule carries underlined at rest: a
//	   paragraph, a list item, a blockquote, a table cell, a table header, the note class
//	   (on a `div.note`, the one structure only that name reaches — the notes the renderer
//	   emits are `<p class="note">`, which the paragraph's name already covers), the privacy
//	   article and the samples foot, each on a real link where the site carries one and
//	   otherwise on a probe in a real container, held to the hairline 1px, the 3px offset,
//	   the full-strength turn of hover and of keyboard focus (with the global outline), and a
//	   computed 3:1 contrast of the rest decoration over the ground it is drawn on, the
//	   page's background and a note's tint alike. The anchors that are not prose — the docs
//	   toolbar, the table of contents, the pager, the cards, the navigation and the 404
//	   page's action — wear no underline at rest, and a `.text-link` probe placed in a note
//	   and in the samples foot, two containers the rest-underline rule owns, stays bare there
//	   while hover and focus still underline it.
//	6. The code blocks: the code inside a pre wears no inline-code chip (one once painted a
//	   background and a border around every line there), the chip applies only outside — and
//	   still loses to the site's own de-chip rules for the places that are names, a card title
//	   among them — and a block wider than its box scrolls inside it, in light and in dark.
//	7. The home page's two transcripts, as the reference records them: the rendered text is
//	   the fence's own text line for line — while the line spans were block-level every line
//	   was followed by an empty one — and the block is no taller than one line-height per
//	   line plus its padding.
//	8. The header on every page of the sitemap: the logo, and a section only where there is
//	   one — the home page and privacy carry no section, so they carry neither the separator
//	   nor an empty span ("&gt;_ team /" with nothing after it).
//	9. The home page's install block: a click and an arrow key each switch the visible
//	   command, Copy hands over that command, and a reload shows the same tab.
//	10. Light-mode syntax tokens, measured from computed colour against the code block's
//	    own background: .hljs-attr, .hljs-string, .hljs-comment and .hljs-built_in, and
//	    every other highlighted token on those pages, each at least 4.5:1.
//
// The server is the site's own request handler on a free port, so this opens no
// process of its own; the browser opens once and is closed in the end.
import { chromium, type Browser, type Page } from 'playwright';
import { handleRequest } from '../server';
import { homeSamples, installCommands } from '../src/server/pages';
import { sitemapPages } from '../src/server/seo';

const problems: string[] = [];
const check = (condition: boolean, message: string) => { if (!condition) problems.push(message); };

/** A colour as its three numbers, to compare one theme with the other. */
function rgb(colour: string): [number, number, number] {
  const [r = 0, g = 0, b = 0] = [...colour.matchAll(/\d+/g)].map(match => Number(match[0]));
  return [r, g, b];
}
const brightness = (colour: string) => rgb(colour).reduce((sum, channel) => sum + channel, 0);

/** A computed colour as channels 0-255 plus alpha: rgba()'s four numbers, or `color(srgb …)`'s. */
const channels = (colour: string): [number, number, number, number] => {
  const srgb = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(colour);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] === undefined ? 1 : Number(srgb[4])];
  const [r = 0, g = 0, b = 0, a = 1] = (colour.match(/[\d.]+/g) ?? []).map(Number);
  return [r, g, b, a];
};
/** A colour laid over an opaque one. */
const over = (source: [number, number, number, number], backdrop: number[]): [number, number, number] =>
  [0, 1, 2].map(channel => source[channel]! * source[3] + backdrop[channel]! * (1 - source[3])) as [number, number, number];
/** The opaque colour a mark drawn on the element lands on: the element's ancestors' own
    backgrounds, composited — a note's tint over the page over the body. */
const backdrop = (backgrounds: string[]): [number, number, number] => {
  const layers = backgrounds.map(channels);
  let base: [number, number, number] = [255, 255, 255];
  let opaque = -1;
  for (let index = layers.length - 1; index >= 0; index--) {
    if (layers[index]![3] === 1) { base = layers[index]!.slice(0, 3) as [number, number, number]; opaque = index; break; }
  }
  for (let index = opaque - 1; index >= 0; index--) base = over(layers[index]!, base);
  return base;
};
/** A colour's relative luminance, WCAG 2.1. */
const luminance = (colour: number[]) => {
  const channel = (value: number) => { const s = value / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(colour[0]!) + 0.7152 * channel(colour[1]!) + 0.0722 * channel(colour[2]!);
};
/** The contrast two colours stand in, WCAG's (lighter + 0.05) / (darker + 0.05). */
const contrast = (one: number[], other: number[]) => {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
};

const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: handleRequest });
const origin = `http://127.0.0.1:${server.port}`;
const browser: Browser = await chromium.launch();

try {
  // ── 1. every width, both modes ──────────────────────────────────────────────
  const backgrounds = new Map<string, number>();
  for (const width of [390, 768, 1440]) {
    for (const mode of ['light', 'dark'] as const) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: mode, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const logged: string[] = [];
      page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') logged.push(`${message.type()}: ${message.text()}`); });
      page.on('pageerror', error => logged.push(`threw: ${error.message}`));

      await page.goto(`${origin}/docs/commands/up/`, { waitUntil: 'load' });
      const where = `${width}px ${mode}`;

      const facts = await page.evaluate(() => ({
        theme: document.documentElement.dataset.themeMode,
        scheme: getComputedStyle(document.body).backgroundColor,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        heading: document.querySelector('#content h1')?.textContent?.trim() ?? '',
        blocks: document.querySelectorAll('#content pre').length,
        footer: document.querySelector('.site-footer a[href="https://floor.io"]')?.textContent?.trim() ?? '',
        sidebar: Math.round(document.querySelector('#sidebar')!.getBoundingClientRect().right),
        stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].length,
      }));

      check(facts.theme === mode, `${where}: the bootstrap chose ${JSON.stringify(facts.theme)}`);
      check(facts.overflow <= 1, `${where}: the page is ${facts.overflow}px wider than the window`);
      check(facts.heading.length > 0, `${where}: no heading in the content`);
      check(facts.blocks > 0, `${where}: the page shows no blocks`);
      check(facts.footer === 'Floor IO', `${where}: the footer does not name Floor IO`);
      check(facts.stylesheets >= 5, `${where}: ${facts.stylesheets} stylesheets: material's four and the page's`);
      // The sidebar is the drawer's, waiting off the left edge under 900px.
      check(width < 900 ? facts.sidebar <= 0 : facts.sidebar > 0, `${where}: the sidebar's right edge is at ${facts.sidebar}px`);
      check(logged.length === 0, `${where}: the console said ${JSON.stringify(logged.slice(0, 2))}`);
      backgrounds.set(where, brightness(facts.scheme));

      if (width === 1440) {
        // The copy button hands over the block's own text, the block it belongs to.
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
        const example = page.locator('figure.example').first();
        const block = await example.locator('pre').innerText();
        await example.locator('[data-copy]').click();
        const clipboard = await page.evaluate(() => navigator.clipboard.readText());
        check(clipboard.trim() === block.trim(), `1440px ${mode}: the copy button handed over ${JSON.stringify(clipboard.slice(0, 40))}`);
      }
      await context.close();
    }
    // The theme is not decoration: the two modes have to actually differ.
    const light = backgrounds.get(`${width}px light`) ?? 0;
    const dark = backgrounds.get(`${width}px dark`) ?? 0;
    check(dark < light, `${width}px: dark is not darker than light (${dark} vs ${light})`);
  }

  // ── 2. the home page without JavaScript ─────────────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    const facts = await page.evaluate(() => ({
      heading: document.querySelector('#content h1')?.textContent?.trim() ?? '',
      install: document.querySelector('#content')?.textContent?.includes('npm install -g team') ?? false,
      tablist: document.querySelector('[role="tablist"]') !== null,
      shown: [...document.querySelectorAll<HTMLElement>('.doc-install__panel')].filter(panel => getComputedStyle(panel).display !== 'none').map(panel => panel.dataset.command ?? ''),
      samples: document.querySelectorAll('#content pre').length,
      background: getComputedStyle(document.body).backgroundColor,
      header: Math.round(document.querySelector('.header')!.getBoundingClientRect().height),
    }));
    check(facts.heading.length > 0, 'no JavaScript: the home page has no heading');
    check(facts.install, 'no JavaScript: the install line is not on the home page');
    check(facts.tablist, 'no JavaScript: the install block has no tablist');
    check(facts.shown.length === 1 && facts.shown[0] === installCommands()[0]!.command, `no JavaScript: the visible install command is ${JSON.stringify(facts.shown)}`);
    check(facts.samples >= 3, `no JavaScript: the home page shows ${facts.samples} blocks`);
    check(facts.background !== 'rgba(0, 0, 0, 0)', 'no JavaScript: the stylesheets did not apply');
    // The header is the site's own height (`--header-height`), not the browser's line box.
    check(facts.header === 56, `no JavaScript: the header is ${facts.header}px tall, the stylesheet says 56`);
    await context.close();
  }

  // ── 3. the dialog, the toggle and what it remembers, with the client on ─────
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(`${origin}/docs/`, { waitUntil: 'load' });

    await page.keyboard.press('Control+K');
    await page.waitForSelector('#search-dialog[open]', { timeout: 4000 });
    check(await page.locator('#search-dialog[open]').count() === 1, 'the dialog did not open on Ctrl+K');
    check(await page.locator('#search-results .search-result').count() > 5, 'the dialog opened without offering the documentation');

    await page.fill('#search-input', 'doctor');
    // The dialog opens on the documentation itself, so wait for the query's own answer.
    await page.waitForFunction(() => document.querySelector('#search-results .search-result')?.getAttribute('href') === '/docs/commands/doctor/', null, { timeout: 4000 })
      .catch(() => {});
    const first = await page.locator('#search-results .search-result').first().getAttribute('href');
    check(first === '/docs/commands/doctor/', `the first result for "doctor" is ${first}`);

    await page.keyboard.press('Escape');
    check(await page.locator('#search-dialog[open]').count() === 0, 'Escape did not close the dialog');

    // The toggle switches the theme, and the reader's choice is there on the next page.
    const before = await page.evaluate(() => document.documentElement.dataset.themeMode);
    await page.click('#theme-toggle');
    const after = await page.evaluate(() => document.documentElement.dataset.themeMode);
    check(after !== before, `the theme toggle left the page in ${after}`);
    check(await page.evaluate(() => localStorage.getItem('team-site-mode')) === after, 'the theme is not remembered');
    await page.reload({ waitUntil: 'load' });
    check(await page.evaluate(() => document.documentElement.dataset.themeMode) === after, 'the remembered theme did not come back');

    // The drawer, on a phone: it opens, the overlay closes it.
    await page.setViewportSize({ width: 390, height: 780 });
    await page.click('#hamburger');
    check(await page.locator('.sidebar--open').count() === 1, 'the drawer did not open');
    check(await page.evaluate(() => document.body.classList.contains('nav-open')), 'the page does not know the drawer is open');
    await page.click('#overlay', { position: { x: 380, y: 400 } });
    check(await page.locator('.sidebar--open').count() === 0, 'the overlay did not close the drawer');
    await context.close();
  }

  // ── 4. the hero: its centring, and its buttons, at phone and desktop width ──
  // The hero sits on the viewport's centre to the pixel; a screenshot's crop once read as a
  // 65px offset, so the measurement is held here — and held on what the reader sees. The
  // content's bounds stand for the boxes: `.hero__actions` is a full-width flex row, so its
  // own box sits on the centre whatever `justify-content` does with the pills; the two
  // pills' combined bounds are the claim (under `flex-start` they land 314.8px left at 1440
  // while the row's box stays centred). The buttons: the reset (shell.css, unlayered) zeroes
  // every padding, so the hero's own scoped rule (.hero__actions .mtrl-button) is what keeps
  // the labels off the pills' edges — held at 40px, padded, one line, on the centre.
  for (const width of [390, 375, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    const hero = await page.evaluate(() => {
      const centre = document.documentElement.clientWidth / 2;
      const round = (value: number) => Math.round(value * 10) / 10;
      const boxOffset = (selector: string) => {
        const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
        return round(rect.left + rect.width / 2 - centre);
      };
      const contentOffset = (selector: string) => {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector<HTMLElement>(selector)!);
        const rect = range.getBoundingClientRect();
        return round(rect.left + rect.width / 2 - centre);
      };
      const pills = [...document.querySelectorAll<HTMLElement>('.hero__actions .mtrl-button')].map(button => button.getBoundingClientRect());
      const left = Math.min(...pills.map(rect => rect.left));
      const right = Math.max(...pills.map(rect => rect.right));
      return {
        block: boxOffset('.hero'),
        textAlign: getComputedStyle(document.querySelector('.hero')!).textAlign,
        children: ['.eyebrow', '#hero-title', '.hero__install', '.hero__notes']
          .map(selector => ({ selector, offset: contentOffset(selector) })),
        buttons: { offset: round((left + right) / 2 - centre), span: round(right - left) },
      };
    });
    const buttons = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.hero__actions .mtrl-button')].map(button => {
      const css = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      const label = [...button.childNodes].find(node => node.nodeType === 3)!;
      const range = document.createRange();
      range.selectNodeContents(label);
      const labelRect = range.getBoundingClientRect();
      return {
        text: button.textContent!.trim(),
        start: parseFloat(css.paddingInlineStart),
        end: parseFloat(css.paddingInlineEnd),
        height: Math.round(rect.height),
        lines: range.getClientRects().length,
        overflow: button.scrollWidth - button.clientWidth,
        offCentre: Math.round((labelRect.top + labelRect.height / 2) - (rect.top + rect.height / 2)),
      };
    }));
    const where = `home ${width}px`;
    check(buttons.length === 2, `${where}: ${buttons.length} hero buttons, not 2`);
    for (const button of buttons) {
      check(button.start > 0 && button.end > 0, `${where}: "${button.text}" has inline padding ${button.start}/${button.end}`);
      check(button.start === button.end, `${where}: "${button.text}" is padded ${button.start} left, ${button.end} right`);
      check(button.height === 40, `${where}: "${button.text}" is ${button.height}px tall, not the design's 40`);
      check(button.lines === 1, `${where}: "${button.text}" wraps to ${button.lines} lines`);
      check(button.overflow <= 1, `${where}: "${button.text}" overflows its pill by ${button.overflow}px`);
      check(Math.abs(button.offCentre) <= 2, `${where}: "${button.text}" sits ${button.offCentre}px off the pill's centre`);
    }
    check(buttons.length !== 2 || buttons[0]!.height === buttons[1]!.height, `${where}: the pills are ${buttons[0]!.height}px and ${buttons[1]!.height}px tall`);
    // The design centres the hero's text; the block, every child's content and the two
    // pills' combined bounds ride the viewport's centre.
    check(Math.abs(hero.block) <= 2, `${where}: the hero's centre is ${hero.block}px off the viewport's centre`);
    check(hero.textAlign === 'center', `${where}: the hero's text is ${hero.textAlign}, not centred`);
    for (const child of hero.children) {
      check(Math.abs(child.offset) <= 2, `${where}: ${child.selector}'s content sits ${child.offset}px off the viewport's centre`);
    }
    check(Math.abs(hero.buttons.offset) <= 2, `${where}: the two buttons' combined bounds sit ${hero.buttons.offset}px off the viewport's centre (${hero.buttons.span}px together)`);
    await context.close();
  }

  // ── 5. prose links: the site's link colour, and the underline the prose rule carries ───
  // The landing's sentence under the transcripts sits outside the markdown body, so no
  // prose-link rule reached it and its links fell to the browser's default blue, unreadable
  // on the dark background. The colour is compared with the --accent token itself, read
  // live, so the rule and the token can only move together — and the token is held to
  // resolving at all (a sentinel colour is assigned first, so a missing --accent leaves the
  // sentinel) and to differing from the body's own text, so a token that went missing
  // cannot let the comparison pass on two inherited colours. Colour is not the whole cue:
  // every family the prose rule names is underlined at rest — on its real link where a page
  // carries one, and otherwise on a probe placed in that container on a real page, so a
  // family dropped from the rule has nothing left to pass on. Every name is asserted on its
  // own: the note's probe is a `div.note`, the one structure only the note name reaches —
  // the notes the renderer emits are `<p class="note">`, which the paragraph's name already
  // covers — so removing the note name from the rule cannot pass on the paragraph's back.
  // The decoration must also be
  // readable as a mark: blended over the ground the link is drawn on — the page's own
  // background, a note's tint, a table header's — it is held to 3:1, the contrast a cue
  // drawn in colour has to clear. Hover is the mouse and focus a real Tab from the page's
  // top, both turning the mark full-strength, the focus drawing the global outline; every
  // state is read from the computed style, so a rule that only renames things cannot pass.
  // The anchors around the prose — the docs toolbar, the table of contents, the pager, a
  // card, the navigation in its two places and the 404 page's action — carry no underline
  // at rest, so the widened rule cannot have quietly swallowed them. The 404 page's actions
  // are the site's only real `.text-link` and sit in containers of their own, so the class's
  // guarantee is probed where it was once at risk: a `.text-link` placed in a note and in
  // the samples foot stays bare at rest, and hover and focus still underline it there.
  // The families, and where each is exercised.
  const PROSE: { id: string; what: string; path: string; selector?: string; container?: string; box?: string; boxClass?: string }[] = [
    { id: 'paragraph', what: 'a paragraph of the reference', path: '/docs/', selector: '.md p a' },
    { id: 'privacy', what: 'the privacy article', path: '/privacy/', selector: '.md p a' },
    { id: 'cell', what: 'a table cell', path: '/docs/commands/up/', selector: '.md td a' },
    { id: 'foot', what: 'the samples foot', path: '/', selector: '.samples__foot a' },
    { id: 'list', what: 'a list-item probe', path: '/docs/safety/', container: '.md ul li' },
    { id: 'quote', what: 'a blockquote probe', path: '/docs/safety/', container: '.md', box: 'blockquote' },
    { id: 'head', what: 'a table-header probe', path: '/docs/safety/', container: '.md th' },
    { id: 'note', what: 'a note probe on a div.note', path: '/docs/safety/', container: '.md', box: 'div', boxClass: 'note' },
  ];
  for (const mode of ['light', 'dark'] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: mode });
    const page = await context.newPage();
    for (const item of PROSE) {
      const link = item.selector ?? `[data-probe="${item.id}"]`;
      const where = `${item.what} ${mode}`;
      await page.goto(`${origin}${item.path}`, { waitUntil: 'load' });
      if (item.container) {
        const placed = await page.evaluate(spec => {
          const host = document.querySelector<HTMLElement>(spec.container);
          if (!host) return false;
          const anchor = document.createElement('a');
          anchor.href = '/docs/';
          anchor.textContent = 'underline probe';
          anchor.dataset.probe = spec.id;
          // Two containers are not already there: the blockquote, and the `div.note` the
          // note name alone can reach. Either probe goes inside a fresh block at the
          // article's head, on screen without hunting for it.
          const holder = spec.box ? host.insertBefore(document.createElement(spec.box), host.firstChild) : host;
          if (spec.boxClass) holder.className = spec.boxClass;
          holder.append(anchor);
          return true;
        }, { id: item.id, container: item.container, box: item.box, boxClass: item.boxClass });
        check(placed, `${where}: ${item.path} carries no ${item.container} to hold the probe`);
      }
      const facts = await page.evaluate((link) => {
        const sentinel = document.createElement('span');
        sentinel.style.color = 'rgb(1, 2, 3)';
        sentinel.style.color = 'var(--accent)';
        document.body.append(sentinel);
        const token = getComputedStyle(sentinel).color;
        sentinel.remove();
        const anchor = document.querySelector<HTMLElement>(link);
        const backgrounds: string[] = [];
        for (let node: Element | null = anchor; node; node = node.parentElement) backgrounds.push(getComputedStyle(node).backgroundColor);
        const css = anchor ? getComputedStyle(anchor) : null;
        return {
          token,
          body: getComputedStyle(document.body).color,
          defaultBlue: [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(element => getComputedStyle(element).color === 'rgb(0, 0, 238)').length,
          link: css ? { colour: css.color, line: css.textDecorationLine, decoration: css.textDecorationColor, thickness: css.textDecorationThickness, offset: css.textUnderlineOffset, backgrounds } : null,
        };
      }, link);
      const at = facts.link;
      check(at !== null, `${where}: ${item.selector ? `no link on ${item.path} matches ${item.selector}` : `the probe did not land on ${item.path}`}`);
      check(facts.token !== 'rgb(1, 2, 3)' && /^(rgb|rgba|color)\(/.test(facts.token), `${where}: --accent does not resolve to a colour (the sentinel probe computed ${facts.token})`);
      check(facts.token !== facts.body, `${where}: --accent resolves to the body text colour (${facts.token})`);
      check(facts.defaultBlue === 0, `${where}: ${facts.defaultBlue} links on ${item.path} are the browser's default blue`);
      if (at) {
        check(at.colour === facts.token, `${where}: the link is ${at.colour}, the --accent token resolves to ${facts.token}`);
        check(at.line === 'underline', `${where}: the link carries no underline at rest (text-decoration-line: ${at.line})`);
        check(at.thickness === '1px', `${where}: the rest underline is ${at.thickness} thick, not the hairline 1px`);
        check(at.offset === '3px', `${where}: the rest underline sits ${at.offset} off the text, not 3px`);
        check(at.decoration !== at.colour, `${where}: the rest underline is the link's own colour (${at.decoration}), not quieter than it`);
        const ground = backdrop(at.backgrounds);
        const ratio = contrast(over(channels(at.decoration), ground), ground);
        check(ratio >= 3, `${where}: the rest underline stands ${ratio.toFixed(2)}:1 over rgb(${ground.map(channel => Math.round(channel)).join(', ')}), under the 3:1 a colour cue has to clear`);

        await page.hover(link);
        const hover = await page.evaluate((link) => {
          const css = getComputedStyle(document.querySelector<HTMLElement>(link)!);
          return { line: css.textDecorationLine, decoration: css.textDecorationColor };
        }, link);
        check(hover.line === 'underline', `${where}: the underline leaves the link on hover (text-decoration-line: ${hover.line})`);
        check(hover.decoration === at.colour, `${where}: the hover underline is ${hover.decoration}, not the full-strength ${at.colour}`);

        // The keyboard's own path to the link, so the state read is the keyboard's.
        await page.mouse.move(0, 0);
        let reached = false;
        for (let step = 0; step < 400 && !reached; step++) {
          await page.keyboard.press('Tab');
          reached = await page.evaluate(link => document.activeElement === document.querySelector(link), link);
        }
        check(reached, `${where}: Tab never reached the link`);
        if (reached) {
          const focus = await page.evaluate((link) => {
            const element = document.querySelector<HTMLElement>(link)!;
            const css = getComputedStyle(element);
            return {
              visible: element.matches(':focus-visible'),
              line: css.textDecorationLine, decoration: css.textDecorationColor,
              outline: `${css.outlineStyle} ${css.outlineWidth} ${css.outlineColor}`,
            };
          }, link);
          check(focus.visible, `${where}: the link was focused without :focus-visible`);
          check(focus.line === 'underline', `${where}: the underline leaves the link on keyboard focus (text-decoration-line: ${focus.line})`);
          check(focus.decoration === at.colour, `${where}: the focus underline is ${focus.decoration}, not the full-strength ${at.colour}`);
          check(focus.outline === `solid 2px ${at.colour}`, `${where}: the focus outline is ${focus.outline}`);
        }
      }
    }
    await context.close();
  }

  // The anchors around the prose keep their own treatment: the widened rule must not have
  // swallowed the toolbar, the table of contents, the pager, a card, the navigation in its
  // two places or the 404 page's action — none wears an underline at rest.
  const NEGATIVE = [
    { what: 'the documentation toolbar link', path: '/docs/', selector: '.doc-toolbar a' },
    { what: 'the table-of-contents link', path: '/docs/', selector: '.doc-toc a' },
    { what: 'the pager link', path: '/docs/file/', selector: '.page-nav a' },
    { what: 'the card link', path: '/docs/commands/', selector: '.doc-entry' },
    { what: 'the header navigation link', path: '/docs/', selector: '.header__nav a' },
    { what: 'the sidebar navigation link', path: '/docs/', selector: '.sidebar__link' },
    { what: 'the 404 page action', path: '/nope/', selector: '.text-link' },
  ];
  for (const mode of ['light', 'dark'] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: mode });
    const page = await context.newPage();
    for (const item of NEGATIVE) {
      const where = `${item.what} ${mode}`;
      await page.goto(`${origin}${item.path}`, { waitUntil: 'load' });
      const lines = await page.evaluate(selector => [...document.querySelectorAll<HTMLElement>(selector)].map(element => getComputedStyle(element).textDecorationLine), item.selector);
      check(lines.length > 0, `${where}: ${item.path} carries no ${item.selector}, so its rest state is untested`);
      const underlined = lines.filter(line => line !== 'none');
      check(underlined.length === 0, `${where}: ${underlined.length} of ${lines.length} wear an underline at rest (text-decoration-line: ${underlined[0]})`);
    }
    await context.close();
  }

  // The class's guarantee, on both sides of it. The 404 page's action is the site's one
  // real `.text-link`, and it sits in a paragraph of its own — a container the prose rule
  // owns — so a `.text-link` is placed in the two other such containers: a note and the
  // samples foot. It must stay bare at rest while the hover and the focus rules still
  // underline it — the exclusion covers every rest-underline branch without disarming
  // those two states.
  const ACTION = [
    { what: 'a text-link probe in a note', path: '/docs/safety/', container: '.md .note' },
    { what: 'a text-link probe in the samples foot', path: '/', container: '.samples__foot' },
  ];
  for (const mode of ['light', 'dark'] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: mode });
    const page = await context.newPage();
    for (const item of ACTION) {
      const where = `${item.what} ${mode}`;
      await page.goto(`${origin}${item.path}`, { waitUntil: 'load' });
      const placed = await page.evaluate(spec => {
        const host = document.querySelector<HTMLElement>(spec.container);
        if (!host) return false;
        const anchor = document.createElement('a');
        anchor.href = '/docs/';
        anchor.className = 'text-link';
        anchor.dataset.probe = 'text-link';
        anchor.textContent = 'action probe';
        host.append(anchor);
        return true;
      }, { container: item.container });
      check(placed, `${where}: ${item.path} carries no ${item.container} to hold the probe`);
      if (!placed) continue;
      const link = '[data-probe="text-link"]';
      const rest = await page.evaluate(target => getComputedStyle(document.querySelector<HTMLElement>(target)!).textDecorationLine, link);
      check(rest === 'none', `${where}: a rest-underline branch reaches the class (text-decoration-line: ${rest})`);
      await page.hover(link);
      const hover = await page.evaluate(target => getComputedStyle(document.querySelector<HTMLElement>(target)!).textDecorationLine, link);
      check(hover === 'underline', `${where}: the hover rule no longer underlines the class (text-decoration-line: ${hover})`);
      await page.mouse.move(0, 0);
      let reached = false;
      for (let step = 0; step < 400 && !reached; step++) {
        await page.keyboard.press('Tab');
        reached = await page.evaluate(target => document.activeElement === document.querySelector(target), link);
      }
      check(reached, `${where}: Tab never reached the probe`);
      if (reached) {
        const focus = await page.evaluate(target => {
          const element = document.querySelector<HTMLElement>(target)!;
          return { visible: element.matches(':focus-visible'), line: getComputedStyle(element).textDecorationLine };
        }, link);
        check(focus.visible, `${where}: the probe was focused without :focus-visible`);
        check(focus.line === 'underline', `${where}: the focus rule no longer underlines the class (text-decoration-line: ${focus.line})`);
      }
    }
    await context.close();
  }

  // ── 6. the code blocks: no chip in a pre, and the block scrolls its long lines ──────────
  // The inline-code chip once reached the code inside a pre: a background and a border around
  // every line, padding on the lines' ends. It belongs to inline code alone, and a block wider
  // than its box has to scroll inside it — the file page carries the team.yaml example and a
  // comment line longer than the column.
  // The chip rule must also keep its old weight where it applies: a card title and a heading
  // are names, and the styles de-chip them with a rule of their own that the chip has to lose
  // to — which it only does at 0-1-1 (`.md :where(:not(pre)) > code`). The commands index's
  // card titles are the place that caught it when the exclusion was a bare `:not(pre)`.
  for (const mode of ['light', 'dark'] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: mode });
    const page = await context.newPage();
    await page.goto(`${origin}/docs/file/`, { waitUntil: 'load' });
    const facts = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll<HTMLElement>('#content pre')].map(block => ({
        overflowX: getComputedStyle(block).overflowX,
        fits: block.scrollWidth <= block.clientWidth + 1,
        scrolled: (() => { block.scrollLeft = 99999; const moved = block.scrollLeft > 0; block.scrollLeft = 0; return moved; })(),
        chips: [...block.querySelectorAll<HTMLElement>('code')].map(element => {
          const css = getComputedStyle(element);
          return { background: css.backgroundColor, border: css.borderTopWidth, padding: css.padding };
        }),
      }));
      const inline = [...document.querySelectorAll<HTMLElement>('#content code')].find(element => !element.closest('pre'));
      const inlineCss = inline ? getComputedStyle(inline) : null;
      return {
        blocks,
        inline: inlineCss ? { background: inlineCss.backgroundColor, padding: inlineCss.padding } : null,
      };
    });
    const where = `file ${mode}`;
    check(facts.blocks.length > 2, `${where}: ${facts.blocks.length} code blocks, not the page's several`);
    check(facts.blocks.some(block => !block.fits), `${where}: no block is wider than its box, so scrolling is untested`);
    for (const [index, block] of facts.blocks.entries()) {
      check(block.overflowX === 'auto', `${where}: block ${index + 1} has overflow-x ${block.overflowX}`);
      if (!block.fits) check(block.scrolled, `${where}: block ${index + 1} is wider than its box and does not scroll`);
      for (const chip of block.chips) {
        check(chip.background === 'rgba(0, 0, 0, 0)', `${where}: code in block ${index + 1} has background ${chip.background}`);
        check(chip.border === '0px', `${where}: code in block ${index + 1} has a ${chip.border} border`);
        check(chip.padding === '0px', `${where}: code in block ${index + 1} has ${chip.padding} padding`);
      }
    }
    check(facts.inline !== null, `${where}: no inline code outside the blocks`);
    if (facts.inline) {
      check(facts.inline.background !== 'rgba(0, 0, 0, 0)', `${where}: the inline code wears no chip (${facts.inline.background})`);
      check(facts.inline.padding !== '0px', `${where}: the inline code wears no chip padding (${facts.inline.padding})`);
    }
    await page.goto(`${origin}/docs/commands/`, { waitUntil: 'load' });
    const title = await page.evaluate(() => {
      const element = document.querySelector<HTMLElement>('.doc-entry__name code');
      if (!element) return null;
      const css = getComputedStyle(element);
      return { background: css.backgroundColor, border: css.borderTopWidth, padding: css.padding };
    });
    check(title !== null, `${where}: the commands index shows no card title`);
    if (title) {
      check(title.background === 'rgba(0, 0, 0, 0)', `${where}: the card title wears a chip background (${title.background})`);
      check(title.border === '0px', `${where}: the card title wears a ${title.border} chip border`);
      check(title.padding === '0px', `${where}: the card title wears ${title.padding} chip padding`);
    }
    await context.close();
  }

  // ── 7. the home transcripts: the reference's lines, and only them ──────────
  // A transcript's line is a span of the pre's text and the newline between the spans is
  // the line break; while the spans were block-level, each one added a break of its own
  // and every line was followed by an empty one. The rendered text is held to the fence
  // itself, line for line, and the block to one line-height per line plus its padding.
  const transcriptSources = homeSamples()
    .filter(sample => sample.fence.lang === 'console')
    .map(sample => sample.fence.text.replace(/\n$/, ''));
  for (const mode of ['light', 'dark'] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: mode });
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    const facts = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#content pre.term')].map(pre => {
      const code = pre.querySelector('code')!;
      const css = getComputedStyle(pre);
      return {
        rendered: code.innerText.replace(/\n$/, ''),
        height: pre.getBoundingClientRect().height,
        lineHeight: parseFloat(css.lineHeight),
        padding: parseFloat(css.paddingTop) + parseFloat(css.paddingBottom),
      };
    }));
    check(facts.length === transcriptSources.length, `home ${mode}: ${facts.length} transcripts, the home page's samples carry ${transcriptSources.length}`);
    transcriptSources.forEach((source, index) => {
      const fact = facts[index];
      if (!fact) return;
      const expected = source.split('\n');
      const rendered = fact.rendered.split('\n');
      const wrong = rendered.length !== expected.length ? `the fence has ${expected.length}` : (() => {
        const line = rendered.findIndex((text, at) => text !== expected[at]);
        return line < 0 ? '' : `line ${line + 1} reads ${JSON.stringify(rendered[line])}, the fence has ${JSON.stringify(expected[line])}`;
      })();
      check(wrong === '', `home ${mode}: transcript ${index + 1} renders ${rendered.length} lines, ${wrong}`);
      const bound = expected.length * fact.lineHeight + fact.padding;
      check(fact.height <= bound + 0.5, `home ${mode}: transcript ${index + 1} is ${fact.height.toFixed(2)}px tall, ${expected.length} lines × ${fact.lineHeight} + ${fact.padding} is ${bound.toFixed(2)}`);
    });
    await context.close();
  }

  // ── 8. the header on every page: a section, or neither of its parts ─────────
  // A page with no section (the home page, privacy) rendered the separator anyway and an
  // empty span after it: ">_ team /" with nothing following. The separator and the section
  // travel together — a page that has one keeps ">_ team / Documentation".
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    for (const { path } of sitemapPages()) {
      await page.goto(`${origin}${path}`, { waitUntil: 'load' });
      const facts = await page.evaluate(() => ({
        logo: document.querySelector('.header__logo')?.textContent?.trim() ?? '',
        sep: document.querySelector('.header__sep')?.textContent ?? null,
        section: document.querySelector('.header__section')?.textContent ?? null,
      }));
      const where = `header ${path}`;
      check(facts.logo === '>_team', `${where}: the logo reads ${JSON.stringify(facts.logo)}`);
      check(facts.section === null || facts.section.trim() !== '', `${where}: the section span is empty`);
      check((facts.sep === null) === (facts.section === null), `${where}: the separator ${facts.sep === null ? 'is missing beside' : 'stands with no'} section`);
      if (path.startsWith('/docs/')) {
        check(facts.sep === '/' && facts.section === 'Documentation', `${where}: the header reads ${JSON.stringify([facts.logo, facts.sep, facts.section])}`);
      } else {
        check(facts.sep === null, `${where}: a page without a section still shows the separator ${JSON.stringify(facts.sep)}`);
      }
    }
    await context.close();
  }

  // ── 9. the install block: click, arrow key, copy, and the remembered tab ──
  {
    const commands = installCommands();
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    const visible = () => page.evaluate(() => {
      const selected = document.querySelector<HTMLElement>('.doc-install__option[aria-selected="true"]');
      const shown = [...document.querySelectorAll<HTMLElement>('.doc-install__panel')].filter(panel => getComputedStyle(panel).display !== 'none');
      return { tab: selected?.dataset.packageManager ?? '', command: shown.map(panel => panel.dataset.command ?? ''), focused: document.activeElement?.getAttribute('data-package-manager') ?? '' };
    });

    await page.click('.doc-install__option[data-package-manager="pnpm"]');
    const clicked = await visible();
    check(clicked.tab === 'pnpm' && clicked.command.length === 1 && clicked.command[0] === commands.find(item => item.id === 'pnpm')!.command, `install: a click left ${JSON.stringify(clicked)}`);

    await page.keyboard.press('ArrowLeft');
    const arrowed = await visible();
    check(arrowed.tab === 'npm' && arrowed.focused === 'npm' && arrowed.command.length === 1 && arrowed.command[0] === commands.find(item => item.id === 'npm')!.command, `install: ArrowLeft left ${JSON.stringify(arrowed)}`);

    await page.keyboard.press('ArrowRight');
    const returned = await visible();
    check(returned.tab === 'pnpm' && returned.focused === 'pnpm', `install: ArrowRight left ${JSON.stringify(returned)}`);

    await page.click('.doc-install__copy');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    check(clipboard === commands.find(item => item.id === 'pnpm')!.command, `install: Copy handed over ${JSON.stringify(clipboard)}`);

    await page.reload({ waitUntil: 'load' });
    const remembered = await visible();
    check(remembered.tab === 'pnpm' && remembered.command.length === 1 && remembered.command[0] === commands.find(item => item.id === 'pnpm')!.command, `install: after a reload the tab is ${JSON.stringify(remembered)}`);
    await context.close();
  }

  // ── 10. light-mode syntax tokens clear 4.5:1 on the code background ──
  // The four classes the audit named, plus every other highlighted token on the same
  // pages. The ratio is the computed colour over the block's composited background.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    const page = await context.newPage();
    const wanted = ['hljs-attr', 'hljs-string', 'hljs-comment', 'hljs-built_in'];
    const seen = new Set<string>();
    const worst = new Map<string, number>();
    for (const path of ['/', '/docs/', '/docs/commands/up/', '/docs/file/']) {
      await page.goto(`${origin}${path}`, { waitUntil: 'load' });
      const tokens = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[class*="hljs-"]')].map(element => {
        const backgrounds: string[] = [];
        let node: Element | null = element;
        while (node) {
          backgrounds.push(getComputedStyle(node).backgroundColor);
          node = node.parentElement;
        }
        return { classes: [...element.classList].filter(name => name.startsWith('hljs-')), color: getComputedStyle(element).color, backgrounds };
      }));
      for (const token of tokens) {
        const ratio = contrast(channels(token.color), backdrop(token.backgrounds));
        for (const name of token.classes) {
          seen.add(name);
          const previous = worst.get(name);
          if (previous === undefined || ratio < previous) worst.set(name, ratio);
        }
      }
    }
    for (const name of wanted) check(seen.has(name), `light syntax: ${name} was not on the pages`);
    for (const [name, ratio] of worst) check(ratio >= 4.5, `light syntax: ${name} is ${ratio.toFixed(2)}:1`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.stop(true);
}

if (problems.length) {
  console.error(`test:browser — ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const problem of [...new Set(problems)]) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('test:browser passed: 390/768/1440 × light/dark, the home page without JavaScript, the hero\'s content centred at 390/375/1440 and its buttons padded, the dialog, the theme and the drawer, every name the prose rule carries, the note class on a div.note among them, wearing the link token and a 3:1 mark at rest, turning full-strength on hover and on the keyboard, while the anchors around them, and the action class in a note and in the samples foot, stay bare, the code blocks chip-free inside, scrolling their long lines, and bare where the styles de-chip a name, the home transcripts rendering the reference line for line, the header on every sitemap page wearing a section only where there is one, and the install block switching by click and by arrow key, copying the visible command, and remembering the tab, and the light-mode syntax tokens, .hljs-attr, .hljs-string, .hljs-comment and .hljs-built_in among them, at 4.5:1 on their code background.');
