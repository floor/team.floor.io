// Markdown of the `team` reference pages, rendered as the site's pages.
//
// One parser reads a page: `fences()` finds every fenced block, the prose between
// them goes through Marked, and each fence is rendered by the one mapping below.
// The site therefore shows exactly what the ref says — docs:check compares the
// blocks it renders with the ref's own fences.
//
// A fence's language says what it is. On the site:
//
//   console      a terminal transcript: `$ ` lines are what was run, the rest is output
//   yaml         a file the example reads, labelled with its path (`yaml file=<path>`)
//   file         the same, for a file that isn't YAML
//   commit       a commit message of the fixture's history
//   git, sh      shell lines
//   fixture      the world the page's examples run in: left out, it is the test's, not the reader's
import { Marked, type Tokens } from 'marked';
import hljs from 'highlight.js';

export interface Fence { lang: string; info: string; text: string; line: number; start: number; end: number }
const FENCE = /^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm;

/** Every fenced block of a page, in order, with its own text and where it sits. */
export function fences(markdown: string): Fence[] {
  return [...markdown.matchAll(FENCE)].map(match => {
    const { lang, info } = header(match[1] ?? '');
    const start = match.index;
    return { lang, info, text: match[2] ?? '', line: markdown.slice(0, start).split('\n').length, start, end: start + match[0].length };
  });
}
/** A fence's header (`yaml file=x`) split into its language and its attributes. */
export function header(line: string): { lang: string; info: string } {
  const [lang = '', ...attributes] = line.trim().split(/\s+/);
  return { lang: lang.toLowerCase(), info: attributes.join(' ') };
}
/** A fence attribute by name, e.g. `file=.agents/team.yaml`. */
export function attribute(fence: Fence, name: string): string {
  return new RegExp(`\\b${name}=("[^"]*"|\\S+)`).exec(fence.info)?.[1]?.replace(/^"|"$/g, '') ?? '';
}
/** The console transcripts of a page, in order. */
export const consoleFences = (markdown: string): Fence[] => fences(markdown).filter(fence => fence.lang === 'console');
/** The whole `team.yaml` files a page's examples read. */
export const yamlFences = (markdown: string): Fence[] => fences(markdown).filter(fence => fence.lang === 'yaml');

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const escapeHtml = (text: string): string => text.replace(/[&<>"]/g, character => ESCAPES[character]!);

/**
 * HTML back to the text it came from: the entities Marked, highlight.js and the site's
 * own escaping leave behind, named ones and numeric ones both. Who reads a page's text
 * rather than its markup — the search index, docs:check — goes through here.
 */
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(html: string): string {
  return html.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (/^#x/i.test(code)) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/** highlight.js names: a fence's language under the ref's spelling. */
const LANGUAGES: Record<string, string> = { sh: 'bash', shell: 'bash', bash: 'bash', zsh: 'bash', yaml: 'yaml', yml: 'yaml', json: 'json', js: 'javascript', ts: 'typescript', md: 'markdown', markdown: 'markdown' };
const extensionLanguage: Record<string, string> = { '.yaml': 'yaml', '.yml': 'yaml', '.json': 'json', '.md': 'markdown', '.sh': 'bash' };

function highlight(code: string, language: string): string {
  const name = LANGUAGES[language.toLowerCase()] ?? language.toLowerCase();
  return name && hljs.getLanguage(name) ? hljs.highlight(code, { language: name }).value : escapeHtml(code);
}

const COPY = '<button type="button" class="example__copy mtrl-button mtrl-button--text mtrl-button--xs" data-copy>Copy</button>';
/** A block of code: a bar with its label and a copy button, then the code itself. */
function codeBlock(text: string, language: string, label: string): string {
  const body = text.replace(/\n$/, '');
  return `<figure class="example"><figcaption class="example__bar"><span class="example__label">${escapeHtml(label)}</span>${COPY}</figcaption>` +
    `<pre class="example__code" tabindex="0"><code class="hljs${language ? ` language-${language}` : ''}">${highlight(body, language)}</code></pre></figure>\n`;
}

/**
 * A transcript: `$ ` opens what was run, the lines under it are its output, exactly
 * as the reference page records them — `; echo "exit $?"` included, since that is
 * how the page makes the exit code part of the run.
 *
 * A line is one span and the newlines between the spans are the transcript's own
 * line breaks, so the spans stay inline: a block-level line would add a break of
 * its own and every line would be followed by an empty one.
 */
function terminal(fence: Fence): string {
  const lines = fence.text.replace(/\n$/, '').split('\n').map(line => {
    const command = /^\$ (.*)$/.exec(line);
    if (command) return `<span class="term__line term__line--command"><span class="term__prompt" aria-hidden="true">$</span> <span class="term__command">${escapeHtml(command[1]!)}</span></span>`;
    return line === '' ? '<span class="term__line"></span>' : `<span class="term__line">${escapeHtml(line)}</span>`;
  });
  return `<figure class="example example--term"><figcaption class="example__bar"><span class="example__label">Terminal</span>${COPY}</figcaption>` +
    `<pre class="term" tabindex="0" aria-label="Terminal transcript, read only"><code>${lines.join('\n')}</code></pre></figure>\n`;
}

/** The site's reading of one fence. `fixture` is the only one left out. */
export function fenceHtml(fence: Fence): string {
  const label = attribute(fence, 'file');
  switch (fence.lang) {
    case 'console': return terminal(fence);
    case 'yaml': return codeBlock(fence.text, 'yaml', label || 'team.yaml');
    case 'file': return codeBlock(fence.text, extensionLanguage[label.slice(label.lastIndexOf('.'))] ?? '', label);
    case 'commit': return codeBlock(fence.text, 'text', 'the commit message');
    case 'git': return codeBlock(fence.text, 'bash', 'Shell');
    case 'sh': case 'shell': case 'bash': case 'zsh': return codeBlock(fence.text, 'bash', label);
    case 'fixture': return '';
    default: return codeBlock(fence.text, fence.lang, fence.lang);
  }
}

/**
 * An indented block: the reference's own preformatted text — a synopsis, a listing, a
 * message it quotes. It is prose, not a block of the site's, so it gets no bar, no
 * label and no copy button.
 */
function indentBlock(text: string): string {
  return `<pre class="md-pre" tabindex="0"><code>${escapeHtml(text.replace(/\n$/, ''))}</code></pre>\n`;
}

export interface Rendered { html: string; toc: { title: string; id: string }[] }

/** A heading's id, from its text: the anchor the table of contents links to. */
export function slug(text: string): string {
  return text.replace(/[`*_]/g, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') || 'section';
}

/**
 * One page's markdown as HTML, with the heading ids its table of contents links to.
 * The prose is Marked's; the fenced blocks are the site's own rendering, so what a
 * page shows of the reference is the fence itself, not a copy of it.
 */
export function renderMarkdown(markdown: string, options: { skip?: (fence: Fence) => boolean } = {}): Rendered {
  const toc: Rendered['toc'] = [];
  const ids = new Map<string, number>();
  const heading = (text: string): { title: string; id: string } => {
    const title = text.replace(/[`*_]/g, '');
    const base = slug(title);
    const count = ids.get(base) ?? 0;
    ids.set(base, count + 1);
    return { title, id: count ? `${base}-${count}` : base };
  };
  const parser = new Marked({ gfm: true });
  parser.use({
    renderer: {
      heading(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token: Tokens.Heading) {
        const { title, id } = heading(token.text);
        if (token.depth === 2) toc.push({ title, id });
        return `<h${token.depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
      },
      code: (token: Tokens.Code) => token.codeBlockStyle === 'indented'
        ? indentBlock(token.text)
        : fenceHtml({ ...header(token.lang ?? ''), text: token.text, line: 0, start: 0, end: 0 }),
      /**
       * A table of the reference's prose. It gets the wrapper the site's own tables get,
       * so a wide one scrolls inside the page instead of widening it, and its first row
       * is a row of column headings for a reader who cannot see it. The frame itself
       * carries tabindex 0, so a reader without a pointer can scroll it with the keyboard.
       */
      table(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token: Tokens.Table) {
        const cell = (item: Tokens.TableCell, name: 'th' | 'td') =>
          `<${name}${name === 'th' ? ' scope="col"' : ''}${item.align ? ` style="text-align: ${item.align}"` : ''}>${this.parser.parseInline(item.tokens as Tokens.Generic[])}</${name}>`;
        const head = token.header.map(item => cell(item, 'th')).join('');
        const body = token.rows.map(row => `<tr>${row.map(item => cell(item, 'td')).join('')}</tr>`).join('');
        return `<div class="table-wrap" tabindex="0"><table><thead><tr>${head}</tr></thead>${body ? `<tbody>${body}</tbody>` : ''}</table></div>\n`;
      },
      link(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token: Tokens.Link) {
        const label = this.parser.parseInline(token.tokens);
        const href = localHref(token.href);
        if (!href) return label;
        const external = /^https?:/i.test(href);
        return `<a href="${escapeHtml(href)}"${token.title ? ` title="${escapeHtml(token.title)}"` : ''}${external ? ' rel="noopener noreferrer"' : ''}>${label}</a>`;
      },
    },
  });

  const blocks = fences(markdown);
  const html: string[] = [];
  let cursor = 0;
  // The prose between the fences is Marked's, one chunk at a time, so a fence is never
  // parsed as prose.
  for (const fence of blocks) {
    html.push(parser.parse(markdown.slice(cursor, fence.start)) as string);
    if (!options.skip?.(fence)) html.push(fenceHtml(fence));
    cursor = fence.end;
  }
  html.push(parser.parse(markdown.slice(cursor)) as string);
  return { html: html.join(''), toc };
}

/**
 * A link of a reference page as the site serves it: a sibling command page is
 * `/docs/commands/<name>/`, the docs' index is `/docs/commands/`, and anything else
 * is left as it is. A link that runs code is dropped.
 */
export function localHref(href: string): string {
  if (/^(?:javascript|data|vbscript):/i.test(href)) return '';
  const command = /^(?:\.\/)?([a-z-]+)\.md(#[\w-]+)?$/.exec(href);
  if (command) return `/docs/commands/${command[1]}/${command[2] ?? ''}`;
  if (href === 'docs/commands/' || href === 'docs/commands' || /^https:\/\/github\.com\/floor\/team\/tree\/main\/docs\/commands\/?$/.test(href)) return '/docs/commands/';
  if (href === '../README.md') return '/docs/';
  return href;
}
