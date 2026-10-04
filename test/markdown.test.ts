// The markdown layer: a page's fences are read as the site's blocks, its prose as Marked's,
// and a reference link is turned into the page the site serves.
import { describe, expect, test } from 'bun:test';
import { attribute, decodeEntities, escapeHtml, fenceHtml, fences, header, localHref, renderMarkdown, slug } from '../src/server/markdown';

const PAGE = [
  '# team up',
  '',
  'Starts the session.',
  '',
  '```console',
  '$ team up --dry-run',
  'skip claude-keeper: already ready',
  '',
  'dry run: nothing was run',
  '```',
  '',
  '## The plan',
  '',
  '```yaml file=examples/team.yaml',
  'project: beacon',
  '```',
  '',
  '```fixture',
  'never: shown',
  '```',
  '',
  '```git',
  'git commit -m "add the beacon"',
  '```',
  '',
].join('\n');

describe('fences', () => {
  test('every fenced block, in order, with its language, attributes and line', () => {
    const found = fences(PAGE);
    expect(found.map(fence => fence.lang)).toEqual(['console', 'yaml', 'fixture', 'git']);
    expect(found.map(fence => fence.line)).toEqual([5, 14, 18, 22]);
    expect(found[1]!.text).toBe('project: beacon\n');
    expect(attribute(found[1]!, 'file')).toBe('examples/team.yaml');
    expect(attribute(found[1]!, 'nope')).toBe('');
  });

  test('an indented block is not a fence', () => {
    expect(fences('    team init\n').length).toBe(0);
  });

  test('a header is a language and its attributes', () => {
    expect(header('  YAML  file=x "a b" ')).toEqual({ lang: 'yaml', info: 'file=x "a b"' });
    expect(header('')).toEqual({ lang: '', info: '' });
  });
});

describe('a fence as the site shows it', () => {
  test('a console fence is a transcript: the commands marked, the output kept', () => {
    const html = fenceHtml(fences(PAGE)[0]!);
    expect(html).toContain('class="example example--term"');
    expect(html).toContain('<span class="term__prompt" aria-hidden="true">$</span> <span class="term__command">team up --dry-run</span>');
    expect(html).toContain('<span class="term__line">skip claude-keeper: already ready</span>');
    expect(html).toContain('dry run: nothing was run');
    // The `$ ` of the transcript is markup, not text.
    expect(html).not.toContain('$ team up');
  });

  test('a yaml fence is a labelled block, with a copy button', () => {
    const html = fenceHtml(fences(PAGE)[1]!);
    expect(html).toContain('<span class="example__label">examples/team.yaml</span>');
    expect(html).toContain('class="hljs language-yaml"');
    expect(html).toContain('data-copy');
  });

  test('the fixture is the test\'s world, not the reader\'s: it is left out', () => {
    expect(fenceHtml(fences(PAGE)[2]!)).toBe('');
  });

  test('a file fence takes its language from its name', () => {
    const [fence] = fences('```file file=.agents/team.yaml\nproject: beacon\n```\n');
    expect(fenceHtml(fence!)).toContain('language-yaml');
  });
});

describe('a page of the reference as the site renders it', () => {
  test('prose is Marked\'s, the blocks are the site\'s own', () => {
    const { html } = renderMarkdown(PAGE);
    expect(html).toContain('<h1 id="team-up">team up</h1>');
    expect(html).toContain('<p>Starts the session.</p>');
    expect(html).toContain('class="example example--term"');
    expect(html).not.toContain('never: shown');
  });

  test('a second heading of the same name gets its own id', () => {
    const { html, toc } = renderMarkdown('## The plan\n\ntext\n\n## The plan\n\nmore\n');
    expect(html).toContain('<h2 id="the-plan">');
    expect(html).toContain('<h2 id="the-plan-1">');
    expect(toc).toEqual([{ title: 'The plan', id: 'the-plan' }, { title: 'The plan', id: 'the-plan-1' }]);
  });

  test('only depth-2 headings join the table of contents', () => {
    expect(renderMarkdown('# a\n\n## b\n\n### c\n').toc).toEqual([{ title: 'b', id: 'b' }]);
  });

  test('an indented block is prose: quiet, with no bar and no copy button', () => {
    const { html } = renderMarkdown('The synopsis:\n\n    team up [--dry-run]\n');
    expect(html).toContain('<pre class="md-pre" tabindex="0"><code>team up [--dry-run]</code></pre>');
    expect(html).not.toContain('data-copy');
  });

  test('a skip leaves a fence out entirely', () => {
    const { html } = renderMarkdown(PAGE, { skip: fence => fence.lang === 'console' });
    expect(html).not.toContain('team up --dry-run');
    expect(html).toContain('language-yaml');
    expect(html).toContain('beacon');
  });

  test('a link of the reference is a page of the site, and it opens nowhere new', () => {
    const { html } = renderMarkdown('See [team up](./up.md) and [the file](../README.md).\n');
    expect(html).toContain('<a href="/docs/commands/up/">team up</a>');
    expect(html).toContain('<a href="/docs/">the file</a>');
  });
});

describe('localHref', () => {
  test('a sibling command page', () => {
    expect(localHref('./up.md')).toBe('/docs/commands/up/');
    expect(localHref('down.md')).toBe('/docs/commands/down/');
    expect(localHref('watch.md#the-line')).toBe('/docs/commands/watch/#the-line');
  });

  test('the docs\' own addresses, and anything else as it is', () => {
    expect(localHref('docs/commands/')).toBe('/docs/commands/');
    expect(localHref('../README.md')).toBe('/docs/');
    expect(localHref('https://example.com/x')).toBe('https://example.com/x');
    expect(localHref('#safety')).toBe('#safety');
  });

  test('a link that runs code is not a link', () => {
    expect(localHref('javascript:alert(1)')).toBe('');
    expect(localHref('DATA:text/html,<script>')).toBe('');
  });
});

describe('text helpers', () => {
  test('escapeHtml holds the four characters that would end an attribute', () => {
    expect(escapeHtml('a & b < c > "d"')).toBe('a &amp; b &lt; c &gt; &quot;d&quot;');
  });

  test('decodeEntities reads back what Marked and highlight.js write', () => {
    expect(decodeEntities('&lt;span&gt; &amp; &#x27;q&#x27; &#38;&nbsp;')).toBe("<span> & 'q' & ");
    expect(decodeEntities('&#x2013;')).toBe('–');
    expect(decodeEntities('&unknown;')).toBe('&unknown;');
  });

  test('a heading\'s id is its text, readable in a URL', () => {
    expect(slug('`team up` — the plan')).toBe('team-up-the-plan');
    expect(slug('!!!')).toBe('section');
  });
});
