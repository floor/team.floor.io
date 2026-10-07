// The reference layer: a page asks for a piece by name, and a name the ref no longer has
// is a failure that says which name it lost — never a page that quietly says less.
import { describe, expect, test } from 'bun:test';
import { bullet, commandNames, commandPage, commandTable, fenceWith, paragraph, ReferenceError, section, sentence } from '../src/server/reference';

const PAGE = [
  '# A page',
  '',
  'First paragraph of the page, with a `code` span.',
  '',
  '## The section',
  '',
  'A paragraph under the section, and',
  'its second line.',
  '',
  '- the first bullet',
  '  continued here',
  '- the second bullet',
  '',
  '### Deeper',
  '',
  'Past the subsection.',
  '',
  '## Commands',
  '',
  '| Command | Summary | Who |',
  '| --- | --- | --- |',
  '| `team up` / `team down` | Starts and stops the team. | the owner |',
  '| `team status` | Reads the team back. | anyone |',
  '',
  '```console',
  '$ team status',
  '```',
  '',
  '```yaml file=x.yaml',
  'project: x',
  '```',
  '',
].join('\n');

describe('named pieces of a reference page', () => {
  test('a section runs to the next heading of that depth or above, subsections and all', () => {
    const body = section(PAGE, 'The section');
    expect(body).toContain('A paragraph under the section');
    expect(body).toContain('- the second bullet');
    // A `###` stays inside it; the next `##` is where it ends.
    expect(body).toContain('Past the subsection');
    expect(body).not.toContain('| `team status`');
  });

  test('a paragraph is the whole block that starts with the text', () => {
    expect(paragraph(PAGE, 'A paragraph under')).toBe('A paragraph under the section, and\nits second line.');
  });

  test('a bullet takes the lines that continue it', () => {
    expect(bullet(PAGE, 'the first')).toBe('- the first bullet\n  continued here');
  });

  test('a sentence ends at the period, and starts where it is asked to', () => {
    expect(sentence(PAGE, 'A paragraph under')).toBe('A paragraph under the section, and its second line.');
    expect(sentence(PAGE, 'First paragraph')).toBe('First paragraph of the page, with a `code` span.');
  });

  test('a fence is found by its language and what it holds', () => {
    expect(fenceWith(PAGE, 'console', 'team status').text).toBe('$ team status\n');
    expect(fenceWith(PAGE, 'yaml', 'project: x').info).toBe('file=x.yaml');
  });
});

describe('the commands table', () => {
  test('a row that spells who per command gives each command its own rule', () => {
    const up = commandTable().find(row => row.name === 'up');
    const down = commandTable().find(row => row.name === 'down');
    expect(up?.summary).toContain('starts');
    expect(down?.summary).toBe(up?.summary);
    // The README's cell is "`up`: the owner; `down`: the owner, the coordinator or the
    // operator seat": each row shows its own half, never the pair.
    expect(up?.who).toBe('the owner');
    expect(down?.who).toBe('the owner, the coordinator or the operator seat');
  });

  test('a cell that is one rule for the row is shown whole, on every row it names', () => {
    // "anyone; read only" is a sentence, not a label per command: it stays whole.
    expect(commandTable().find(row => row.name === 'commits')?.who).toBe('anyone; read only');
    // `team worktree new` / `remove` are two commands in one row with one rule.
    expect(commandTable().find(row => row.name === 'worktree')?.who).toBe('the owner, the coordinator or the operator');
  });

  test('the reference\'s own pages are the command pages, and each one is read', () => {
    const names = commandNames();
    expect(names).toContain('up');
    expect(names).toContain('down');
    expect(names).toContain('worktree');
    expect(commandPage('up')).toContain('team up');
  });
});

describe('a piece the reference no longer has', () => {
  test('fails with the name that is gone, and the failure is the site\'s own kind', () => {
    expect(() => section(PAGE, 'Not a heading')).toThrow(ReferenceError);
    expect(() => section(PAGE, 'Not a heading')).toThrow(/no longer has a "Not a heading" section/);
    expect(() => paragraph(PAGE, 'Never written')).toThrow(ReferenceError);
    expect(() => bullet(PAGE, '- never listed')).toThrow(ReferenceError);
    expect(() => sentence(PAGE, 'never said')).toThrow(ReferenceError);
    expect(() => fenceWith(PAGE, 'json', 'anything')).toThrow(ReferenceError);
    expect(() => commandPage('nonesuch')).toThrow(ReferenceError);
  });
});
