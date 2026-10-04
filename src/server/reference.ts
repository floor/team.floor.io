// The site's pages are assembled from the reference at TEAM_REF, by name: a section,
// a paragraph, a bullet, a table row. Nothing is retyped, so a page cannot claim what
// the reference does not say.
//
// Every extraction is read once, when the server starts, and a name the reference no
// longer has stops the server with the name it lost. docs:check runs the same
// extraction, so a ref that moved is a failed check before it is a broken page.
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { read, contentDir } from './team';
import { fences, type Fence } from './markdown';

export const README = read('README.md');

/** What a page asked the reference for and did not find. */
export class ReferenceError extends Error {}

function need<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null || value === '') throw new ReferenceError(`the team reference at TEAM_REF no longer has ${what}`);
  return value;
}

/** The markdown under a `## <title>` heading, up to the next heading of that depth or above. */
export function section(markdown: string, title: string, depth = 2): string {
  const hashes = '#'.repeat(depth);
  const lines = markdown.split('\n');
  const start = lines.findIndex(line => line.startsWith(`${hashes} `) && line.slice(hashes.length + 1).trim() === title);
  need(start < 0 ? undefined : start, `a "${title}" section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(line => new RegExp(`^#{1,${depth}} `).test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n').trim();
}

/** One paragraph: the block that starts with this text, whole. */
export function paragraph(markdown: string, startsWith: string): string {
  const block = markdown.split(/\r?\n\s*\r?\n/).map(part => part.trim()).find(part => part.startsWith(startsWith));
  return need(block, `a paragraph starting "${startsWith}"`);
}

/** One list item, with the lines that continue it. */
export function bullet(markdown: string, startsWith: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex(line => line.startsWith('- ') && line.slice(2).startsWith(startsWith));
  need(start < 0 ? undefined : start, `a bullet starting "${startsWith}"`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(line => /^(?:- |\S)/.test(line));
  return lines.slice(start, end < 0 ? undefined : start + 1 + end).join('\n').trim();
}

/**
 * One sentence: from the text this starts with, to the end of that sentence. A period
 * inside a version number or a path is not the end of one, and neither is one whose
 * next word starts lowercase.
 */
export function sentence(markdown: string, startsWith: string): string {
  const at = markdown.indexOf(startsWith);
  need(at < 0 ? undefined : at, `a sentence starting "${startsWith}"`);
  const rest = markdown.slice(at);
  const end = /[.!?](?=\s+(?![a-z])|\s*$)/.exec(rest);
  return (end ? rest.slice(0, end.index + 1) : rest).replace(/\s+/g, ' ').trim();
}

export interface CommandRow { name: string; summary: string; who: string }
/**
 * The commands table of the README: the tool's own list, in its own order. A row may
 * name more than one command (`team up` / `team down`, `team worktree new` / `remove`);
 * each gets its own entry, with the row's summary and who.
 */
export function commandTable(): CommandRow[] {
  const rows = section(README, 'Commands').split('\n').filter(line => line.startsWith('|')).slice(2);
  const commands: CommandRow[] = [];
  for (const line of rows) {
    const [command = '', summary = '', who = ''] = line.split('|').slice(1, -1).map(cell => cell.trim());
    for (const [, name] of command.matchAll(/`team ([a-z]+)/g)) {
      if (name && !commands.some(row => row.name === name)) commands.push({ name, summary, who });
    }
  }
  return need(commands.length ? commands : undefined, 'its commands table');
}

/** The command pages the reference holds, in the table's order. */
export function commandNames(): string[] {
  const files = readdirSync(resolve(contentDir, 'docs/commands')).filter(name => name.endsWith('.md')).map(name => name.slice(0, -3));
  const names = commandTable().map(row => row.name).filter(name => files.includes(name));
  const rest = files.filter(name => name !== 'README' && !names.includes(name)).sort();
  return need([...names, ...rest].length ? [...names, ...rest] : undefined, 'its command pages');
}

/** A page of the command reference, by command name. */
export function commandPage(name: string): string {
  return need(commandNames().includes(name) ? read(`docs/commands/${name}.md`) : undefined, `a page for the "${name}" command`);
}

/** The first fence of a page whose text holds this, by language. */
export function fenceWith(page: string, lang: string, contains: string): Fence {
  return need(fences(page).find(fence => fence.lang === lang && fence.text.includes(contains)), `a ${lang} block holding "${contains}"`);
}
