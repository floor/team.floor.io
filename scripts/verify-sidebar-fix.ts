// verify-sidebar-fix.ts — gate for fix/sidebar-tab-stops (c39a30c), run once the
// machine lock frees:
//
//	bun scripts/verify-sidebar-fix.ts
//
// What it proves, on the site's own request handler (no extra process):
//
//   1. At 390px, drawer closed: `.sidebar` computes to `visibility: hidden` (so its
//      links are out of the Tab order and the accessibility tree) while still
//      `translateX(-102%)` off-canvas, and `visibility` rides the transition so the
//      slide-out still shows. A Tab walk from the top of the page never lands inside
//      `#sidebar`, and every focused element's box lies inside the viewport — the
//      re-audit's fault was a focus ring drawn at x≈-290 (WCAG 2.4.7 / 2.4.3).
//   2. At 390px, drawer opened by #hamburger: `.sidebar` computes `visible` at once,
//      the Tab walk after the hamburger enters the drawer and walks every one of its
//      links, and closing via the overlay leaves `visibility: visible` while the
//      140ms slide-out runs, then flips to `hidden`.
//   3. At 1024px and 1440px: zero regression — the sidebar computes `visible` with
//      no transform and its links are full Tab stops.
//
// Each step runs in light and in dark. Captures land in
// briefs/extra/e4-sidebar-fix/ (after-*), named to pair with the re-audit's
// f4-up-390-* before-captures; the manifest is briefs/manifest-sidebar-fix.md.
import { chromium, type Browser, type Page } from 'playwright';
import { handleRequest } from '../server';
import { mkdirSync } from 'node:fs';

const OUT = '/Users/jvial/Code/floor/team.floor.io/briefs/extra/e4-sidebar-fix';
const PAGE = '/docs/commands/up/';
mkdirSync(OUT, { recursive: true });

const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: handleRequest });
const ORIGIN = `http://127.0.0.1:${server.port}`;

let failures = 0;
const check = (ok: boolean, label: string, detail: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${detail}`);
  if (!ok) failures++;
};

interface Stop { who: string; x: number; y: number; w: number; inSidebar: boolean }

async function tabStop(page: Page): Promise<Stop> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const r = el.getBoundingClientRect();
    const who = el.id ? `#${el.id}`
      : el.className && typeof el.className === 'string' ? `${el.tagName.toLowerCase()}.${el.className.split(' ')[0]}`
      : el.tagName.toLowerCase();
    return { who, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), inSidebar: !!el.closest('#sidebar') };
  });
}

const sidebarStyle = (page: Page) => page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('sidebar')!);
  return { visibility: cs.visibility, transform: cs.transform, transition: cs.transitionProperty };
});

async function freshPage(browser: Browser, width: number, scheme: 'light' | 'dark'): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height: 780 }, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(ORIGIN + PAGE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200); // let the typed command settle
  return page;
}

async function closedDrawer(browser: Browser, scheme: 'light' | 'dark') {
  const tag = `390-${scheme}-closed`;
  const page = await freshPage(browser, 390, scheme);
  const st = await sidebarStyle(page);
  check(st.visibility === 'hidden', tag, `closed sidebar visibility=${st.visibility} (want hidden)`);
  check(st.transform !== 'none', tag, `closed sidebar still off-canvas transform=${st.transform}`);
  check(st.transition.includes('visibility'), tag, `transition carries [${st.transition}]`);

  // Tab walk: 30 presses from page top — the drawer's links once took presses 6-28.
  let sawSidebar = false; let sawOffscreen = false; let stops = 0;
  for (let i = 1; i <= 30; i++) {
    await page.keyboard.press('Tab');
    const s = await tabStop(page);
    stops++;
    if (s.inSidebar) sawSidebar = true;
    if (s.x < 0 || s.x + s.w > 390) sawOffscreen = true;
    if (i <= 8) await page.screenshot({ path: `${OUT}/after-${tag}-tab-${String(i).padStart(2, '0')}-${s.who.replace(/[#.]/g, '')}.png` });
  }
  check(!sawSidebar, tag, `no Tab stop inside #sidebar across ${stops} presses`);
  check(!sawOffscreen, tag, `every stop's box inside the 390px viewport across ${stops} presses`);
  await page.context().close();
}

async function openDrawer(browser: Browser, scheme: 'light' | 'dark') {
  const tag = `390-${scheme}-open`;
  const page = await freshPage(browser, 390, scheme);
  const drawerLinks = await page.evaluate(() =>
    document.querySelectorAll('#sidebar a[href]').length);

  await page.click('#hamburger');
  const stOpen = await sidebarStyle(page);
  check(stOpen.visibility === 'visible', tag, `open sidebar visibility=${stOpen.visibility} (want visible at transition start)`);
  const expanded = await page.getAttribute('#hamburger', 'aria-expanded');
  check(expanded === 'true', tag, `hamburger aria-expanded=${expanded}`);

  // Tab walk from the hamburger: every following stop up to drawerLinks count must be inside the drawer.
  await page.focus('#hamburger');
  let inside = 0; let escaped = false;
  for (let i = 1; i <= drawerLinks; i++) {
    await page.keyboard.press('Tab');
    const s = await tabStop(page);
    if (s.inSidebar) inside++;
    else { escaped = true; break; }
  }
  check(inside === drawerLinks && !escaped, tag, `${inside}/${drawerLinks} drawer links are Tab stops after the hamburger`);
  await page.screenshot({ path: `${OUT}/after-${tag}-drawer.png` });

  // Close via the overlay: still visible mid-slide-out, hidden after the 140ms transition.
  await page.click('#overlay');
  await page.waitForTimeout(50);
  const stMid = await sidebarStyle(page);
  check(stMid.visibility === 'visible', tag, `mid-close (50ms of 140ms) visibility=${stMid.visibility} (want still visible)`);
  await page.waitForTimeout(300);
  const stClosed = await sidebarStyle(page);
  check(stClosed.visibility === 'hidden', tag, `after close visibility=${stClosed.visibility} (want hidden)`);
  await page.context().close();
}

async function desktop(browser: Browser, width: 1024 | 1440, scheme: 'light' | 'dark') {
  const tag = `${width}-${scheme}`;
  const page = await freshPage(browser, width, scheme);
  const st = await sidebarStyle(page);
  check(st.visibility === 'visible', tag, `sidebar visibility=${st.visibility} (want visible)`);
  check(st.transform === 'none', tag, `sidebar transform=${st.transform} (want none)`);

  // The sidebar links stay full Tab stops: walk until the first one appears.
  let hit = 0; let guard = 0;
  while (hit === 0 && guard < 12) {
    await page.keyboard.press('Tab');
    guard++;
    const s = await tabStop(page);
    if (s.inSidebar) hit = guard;
  }
  check(hit > 0, tag, `first sidebar link reached at Tab press ${hit}`);
  await page.screenshot({ path: `${OUT}/after-${tag}-sidebar.png` });
  await page.context().close();
}

const browser = await chromium.launch();
try {
  console.log(`serving ${ORIGIN} — page ${PAGE}`);
  for (const scheme of ['light', 'dark'] as const) {
    await closedDrawer(browser, scheme);
    await openDrawer(browser, scheme);
    await desktop(browser, 1024, scheme);
    await desktop(browser, 1440, scheme);
  }
} finally {
  await browser.close();
  server.stop();
}
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
