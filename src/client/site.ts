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
initNavigation();
initCopy();
initInstall();
initSearch();
