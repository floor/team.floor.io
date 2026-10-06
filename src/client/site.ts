// The site's one script, loaded by every page as a module.
//
// Nothing here is needed to read the site: the pages are complete HTML, the
// navigation is links, and the terminal blocks are text. This adds the
// conveniences — the theme switch, the drawer at narrow widths, copying a
// block, and the home page's install tabs — and starts the search dialog
// (src/client/search.ts).
import { initSearch } from './search.ts';

const STORAGE_KEY = 'team-site-mode';

/** Light or dark, and the browser remembers the choice. */
function initTheme(): void {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.dataset.themeMode === 'dark' ? 'light' : 'dark';
    root.dataset.themeMode = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private window: the choice lasts the page */ }
  });
}

/** The word after the fixed `team` mark: terminal-paced, and silent to screen readers. */
function initHeaderCommand(): void {
  const command = document.querySelector<HTMLElement>('[data-header-command]');
  const typed = command?.querySelector<HTMLElement>('.header__typed');
  if (!command || !typed) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pageCommand = command.dataset.headerCommand ?? '';
  const commands = (command.dataset.headerCommands ?? '').split(',').filter(Boolean);
  const home = command.dataset.headerHome === 'true';
  const longest = Math.max(0, ...commands.map(name => name.length));
  command.style.setProperty('--header-command-length', String(longest));
  if (reduced) { typed.textContent = pageCommand; return; }
  if (!home && !pageCommand) return;
  typed.textContent = '';

  let timer = 0;
  let index = 0;
  let value = '';
  let deleting = false;
  const target = () => home ? commands[index] ?? '' : pageCommand;
  const tick = () => {
    const word = target();
    if (deleting) value = value.slice(0, -1);
    else value = word.slice(0, value.length + 1);
    typed.textContent = value;
    if (!home && value === word) return;
    if (!deleting && value === word) { deleting = true; timer = window.setTimeout(tick, 1450); }
    else if (deleting && !value) { deleting = false; index = (index + 1) % commands.length; timer = window.setTimeout(tick, 260); }
    else timer = window.setTimeout(tick, deleting ? 55 : 115);
  };
  const pause = () => window.clearTimeout(timer);
  const resume = () => { window.clearTimeout(timer); timer = window.setTimeout(tick, 300); };
  const header = command.closest('.header');
  header?.addEventListener('mouseenter', pause);
  header?.addEventListener('mouseleave', resume);
  header?.addEventListener('focusin', pause);
  header?.addEventListener('focusout', event => { if (!header.contains((event as FocusEvent).relatedTarget as Node | null)) resume(); });
  timer = window.setTimeout(tick, 260);
}

/** The sidebar as a drawer under 900px, with the overlay behind it. */
function initNavigation(): void {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  const overlay = document.getElementById('overlay');
  if (!sidebar || !hamburger || !overlay) return;

  const setOpen = (open: boolean) => {
    sidebar.classList.toggle('sidebar--open', open);
    overlay.hidden = !open;
    document.body.classList.toggle('nav-open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };

  hamburger.addEventListener('click', () => setOpen(!sidebar.classList.contains('sidebar--open')));
  overlay.addEventListener('click', () => setOpen(false));
  sidebar.addEventListener('click', event => { if ((event.target as Element).closest('a')) setOpen(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
  // A window grown past the drawer's breakpoint keeps no drawer state behind it.
  matchMedia('(min-width: 901px)').addEventListener('change', event => { if (event.matches) setOpen(false); });
}

/** The text a block holds: a terminal one line per line, anything else as written. */
function blockText(pre: Element): string {
  const lines = pre.querySelectorAll('.term__line');
  if (lines.length) return [...lines].map(line => line.textContent ?? '').join('\n');
  return pre.textContent ?? '';
}

/** Every block gets a Copy button; the button says so for a moment. */
function initCopy(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    button.addEventListener('click', async () => {
      const figure = button.closest('figure');
      const code = figure?.querySelector('.example__code, .term');
      const text = button.dataset.copyText ?? (code ? blockText(code) : '');
      if (!text) return;
      const done = button.textContent?.trim() ?? 'Copy';
      try {
        await navigator.clipboard.writeText(text);
        button.dataset.copied = 'true';
        button.textContent = 'Copied';
        window.setTimeout(() => { delete button.dataset.copied; button.textContent = done; }, 1600);
      } catch { /* the clipboard is not available: the block is still selectable */ }
    });
  }
}

/** The home page's install tabs: arrow keys move the choice, and the choice is remembered. */
function initInstall(): void {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.doc-install__option')];
  const list = document.querySelector<HTMLElement>('.doc-install__switch');
  if (!tabs.length || !list) return;

  const select = (id: string, remember: boolean) => {
    document.documentElement.dataset.packageManager = id;
    for (const tab of tabs) {
      const on = tab.dataset.packageManager === id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    if (remember) {
      try { localStorage.setItem('team-package-manager', id); } catch { /* private window: the choice lasts the page */ }
    }
  };

  select(document.documentElement.dataset.packageManager || tabs[0]!.dataset.packageManager || 'bun', false);

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      select(tab.dataset.packageManager!, true);
      tab.focus();
    });
  }

  list.addEventListener('keydown', event => {
    const current = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true');
    if (current < 0 || !tabs.includes(event.target as HTMLButtonElement)) return;
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const tab = tabs[next]!;
    select(tab.dataset.packageManager!, true);
    tab.focus();
  });

  const copy = document.querySelector<HTMLButtonElement>('.doc-install__copy');
  copy?.addEventListener('click', async () => {
    const id = document.documentElement.dataset.packageManager;
    const panel = document.querySelector<HTMLElement>(`.doc-install__panel[data-package-manager="${id}"]`);
    const text = panel?.dataset.command ?? '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copy.dataset.copied = 'true';
      copy.textContent = 'Copied';
      window.setTimeout(() => { delete copy.dataset.copied; copy.textContent = 'Copy'; }, 1600);
    } catch { /* the clipboard is not available: the command is still selectable */ }
  });
}

initTheme();
initHeaderCommand();
initNavigation();
initCopy();
initInstall();
initSearch();
