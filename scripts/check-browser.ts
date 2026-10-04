// test:browser — the site in a real browser, once, at the end of a cut.
//
//	1. Every width the reader may arrive at — 390, 768, 1440 — in light and in dark:
//	   the page fits without a sideways scroll, the theme actually changed the colours,
//	   the content is there, and nothing was logged to the console.
//	2. The home page with JavaScript off: the spec's promise that no page needs the
//	   client to exist, and the home page least of all.
//	3. What needs the client, on the page that carries it: the dialog (⌘K, a query, a
//	   result, Escape), the theme toggle, what it remembers, and the copy button.
//	4. The home page's hero at 390, 375 and 1440: the block and each of its children within
//	   2px of the viewport's centre (measured at 0px; the check keeps it so), and both pills'
//	   own inline padding (a layered reset once left their labels flush against the edges),
//	   one line each, no overflow, centred, one height.
//
// The server is the site's own request handler on a free port, so this opens no
// process of its own; the browser opens once and is closed in the end.
import { chromium, type Browser, type Page } from 'playwright';
import { handleRequest } from '../server';

const problems: string[] = [];
const check = (condition: boolean, message: string) => { if (!condition) problems.push(message); };

/** A colour as its three numbers, to compare one theme with the other. */
function rgb(colour: string): [number, number, number] {
  const [r = 0, g = 0, b = 0] = [...colour.matchAll(/\d+/g)].map(match => Number(match[0]));
  return [r, g, b];
}
const brightness = (colour: string) => rgb(colour).reduce((sum, channel) => sum + channel, 0);

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
      samples: document.querySelectorAll('#content pre').length,
      background: getComputedStyle(document.body).backgroundColor,
      header: Math.round(document.querySelector('.header')!.getBoundingClientRect().height),
    }));
    check(facts.heading.length > 0, 'no JavaScript: the home page has no heading');
    check(facts.install, 'no JavaScript: the install line is not on the home page');
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
  // 65px offset, so the measurement is held here. The buttons: the site's reset is layered
  // first (base.eta, shell.css) so a material button's own box rules stand; unlayered, the
  // reset flattened the pills and the labels sat on the edges.
  for (const width of [390, 375, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    const hero = await page.evaluate(() => {
      const centre = document.documentElement.clientWidth / 2;
      const offset = (selector: string) => {
        const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
        return Math.round((rect.left + rect.width / 2 - centre) * 10) / 10;
      };
      return {
        block: offset('.hero'),
        textAlign: getComputedStyle(document.querySelector('.hero')!).textAlign,
        children: ['.eyebrow', '#hero-title', '.hero__tagline', '.hero__actions', '.hero__install', '.hero__notes']
          .map(selector => ({ selector, offset: offset(selector) })),
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
      check(button.lines === 1, `${where}: "${button.text}" wraps to ${button.lines} lines`);
      check(button.overflow <= 1, `${where}: "${button.text}" overflows its pill by ${button.overflow}px`);
      check(Math.abs(button.offCentre) <= 2, `${where}: "${button.text}" sits ${button.offCentre}px off the pill's centre`);
    }
    check(buttons.length !== 2 || buttons[0]!.height === buttons[1]!.height, `${where}: the pills are ${buttons[0]!.height}px and ${buttons[1]!.height}px tall`);
    // The design centres the hero's text; the block and every child ride the viewport's centre.
    check(Math.abs(hero.block) <= 2, `${where}: the hero's centre is ${hero.block}px off the viewport's centre`);
    check(hero.textAlign === 'center', `${where}: the hero's text is ${hero.textAlign}, not centred`);
    for (const child of hero.children) {
      check(Math.abs(child.offset) <= 2, `${where}: ${child.selector} sits ${child.offset}px off the viewport's centre`);
    }
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
console.log('test:browser passed: 390/768/1440 × light/dark, the home page without JavaScript, the hero centred at 390/375/1440 and its buttons padded, the dialog, the theme and the drawer.');
