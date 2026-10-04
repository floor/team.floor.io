// The search dialog: what the reader types, what /api/search answers, and what the
// keys do. The index lives on the server (src/server/search.ts); this file only asks
// it and draws the answer. Every page a result can open is a link, so the dialog is
// an accelerator over the documentation, never the only way to reach it.
export interface Result {
  path: string;
  title: string;
  description: string;
  kind: string;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, character => ESCAPES[character]!);

/** The query's own words, marked in what a result shows. */
function marked(text: string, query: string): string {
  const terms = query.split(/\s+/).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(term => term.length > 1);
  let html = escapeHtml(text);
  for (const term of terms) html = html.replace(new RegExp(`(${term})`, 'gi'), '<mark>$1</mark>');
  return html;
}

/** A result as one row of the dialog's list. */
function row(result: Result, index: number, query: string): string {
  return `<a class="search-result" role="option" id="search-option-${index}" aria-selected="false" href="${escapeHtml(result.path)}">` +
    `<span class="search-result__head"><span class="search-result__title">${marked(result.title, query)}</span>` +
    `<span class="search-result__kind">${escapeHtml(result.kind)}</span></span>` +
    `<span class="search-result__description">${marked(result.description, query)}</span></a>`;
}

export function initSearch(): void {
  const dialog = document.getElementById('search-dialog') as HTMLDialogElement | null;
  const input = document.getElementById('search-input') as HTMLInputElement | null;
  const results = document.getElementById('search-results');
  const trigger = document.getElementById('search-trigger');
  const close = document.getElementById('search-esc');
  if (!dialog || !input || !results || !trigger) return;

  let controller: AbortController | undefined;
  let timer: number | undefined;
  let rows: HTMLAnchorElement[] = [];
  let active = -1;

  const setActive = (index: number) => {
    if (!rows.length) return;
    active = (index + rows.length) % rows.length;
    rows.forEach((element, at) => {
      const on = at === active;
      element.classList.toggle('search-result--active', on);
      element.setAttribute('aria-selected', String(on));
    });
    rows[active]?.scrollIntoView({ block: 'nearest' });
  };

  const draw = (html: string, count: number) => {
    results.innerHTML = html;
    rows = [...results.querySelectorAll<HTMLAnchorElement>('a.search-result')];
    active = -1;
    input.setAttribute('aria-expanded', String(count > 0));
    if (count) { active = 0; setActive(0); }
  };

  const ask = async (query: string) => {
    controller?.abort();
    controller = new AbortController();
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=12`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json() as { results: Result[] };
      if (!body.results.length) return draw(`<p class="search-message">Nothing matches “${escapeHtml(query)}”.</p>`, 0);
      draw(body.results.map((result, index) => row(result, index, query)).join(''), body.results.length);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      draw('<p class="search-message">Search is not answering right now. The sidebar still has every page.</p>', 0);
    }
  };

  const open = () => {
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    if (!input.value) void ask('');
  };

  trigger.addEventListener('click', open);
  close?.addEventListener('click', () => dialog.close());

  // A click outside the panel closes the dialog; the dialog's own box does not.
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { controller?.abort(); results.innerHTML = ''; rows = []; input.value = ''; input.setAttribute('aria-expanded', 'false'); });

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    const query = input.value.trim();
    if (!query) { void ask(''); return; }
    timer = window.setTimeout(() => void ask(query), 120);
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(active + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(active - 1); }
    else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); rows[active]?.click(); }
  });

  document.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey) {
      event.preventDefault();
      if (dialog.open) dialog.close(); else open();
    }
  });
}
