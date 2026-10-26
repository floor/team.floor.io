// /docs/clis/: every launch profile the build ships, with the facts the page reads by name
// from `src/profiles/<cli>.yaml` — the binary, the unattended flags, the words the profile
// reads on the pane, the sign-in check — and the site's own notes, which no profile carries.
// The page's guards stop the build on a profile it does not describe; these assertions pin
// what the finished page shows, the way the command-page tests pin their pages. Jules is read
// apart: its TUI carries no auto-approve flag and no composer/working matchers.
import { describe, expect, test } from 'bun:test';
import { decodeEntities } from '../src/server/markdown';
import { clis } from '../src/server/pages';
import { profileNames } from '../src/server/reference';
import { read } from '../src/server/team';

const page = clis().html;
/** One YAML block of a profile, under `key:` at `indent`, up to the next key at that depth. */
function block(cli: string, key: string, indent: number): string {
  const lines = read(`src/profiles/${cli}.yaml`).split('\n');
  const start = lines.findIndex(line => new RegExp(`^ {${indent}}${key}:`).test(line));
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(line => new RegExp(`^ {0,${indent}}(?!#)\\S`).test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}
const list = (text: string): string[] => text.split('\n').map(line => /^[ \t]*-[ \t]+(\S.*?)[ \t]*$/.exec(line)?.[1]).filter((item): item is string => item !== undefined);
/** The five cells of a profile's table row, as the page wrote them. */
const cell = (cli: string): string[] => new RegExp(`<tr><td><code>${cli}</code></td>[\\s\\S]*?</tr>`).exec(page)?.[0].match(/<td>([\s\S]*?)<\/td>/g)?.map(part => part.slice('<td>'.length, -'</td>'.length)) ?? [];

describe('/docs/clis/, the whole set of launch profiles', () => {
  test('the table has one row per profile the build ships, and no other', () => {
    expect(profileNames()).toEqual(['antigravity', 'claude-code', 'codex', 'cursor', 'gemini', 'grok', 'jules', 'muse']);
    const rows = [...page.matchAll(/<tr><td><code>([a-z-]+)<\/code><\/td>/g)].map(match => match[1]!);
    expect(rows.sort()).toEqual([...profileNames()].sort());
  });

  test('every screen row shows the binary, the unattended flags and the sign-in check of its profile', () => {
    // Jules is read apart (no auto-approve flag, no composer/working matchers); its own test below.
    for (const cli of profileNames().filter(name => name !== 'jules')) {
      const yaml = read(`src/profiles/${cli}.yaml`);
      const binary = /^binary:[ \t]+(\S+)[ \t]*$/m.exec(yaml)![1]!;
      const [shownCli, shownBinary, shownFlags, , shownCheck] = cell(cli);
      expect(shownCli, cli).toBe(`<code>${cli}</code>`);
      expect(shownBinary, cli).toBe(`<code>${binary}</code>`);
      expect(shownFlags, cli).toBe(list(block(cli, 'unattended', 0)).map(flag => `<code>${flag}</code>`).join(' '));
      const login = block(cli, 'login', 0);
      const check = list(block(cli, 'check', 2));
      expect(shownCheck, cli).toBe(check.length ? `<code>${binary} ${check.join(' ')}</code>` : `none — the hint is <code>${/^[ \t]+hint:[ \t]*(.+?)[ \t]*$/m.exec(login)![1]!}</code>`);
    }
  });

  test('the two profiles with no non-interactive check say so, and show the hint instead', () => {
    // gemini.yaml and muse.yaml carry a login.hint and no login.check, and the doctor prints
    // its note for them; the page says both, so a seat there is not misread as checked.
    expect(page).toContain('none — the hint is <code>gemini</code>');
    expect(page).toContain('<code>team doctor --login</code> notes <code>gemini: the login is not checked in this version</code>');
    expect(page).toContain('none — the hint is <code>muse login</code>');
    expect(page).toContain('<code>team doctor --login</code> notes <code>muse: the login is not checked in this version</code>');
    expect(read('src/commands/doctor.ts')).toContain('the login is not checked in this version');
  });

  test('the ready and working words shown per screen profile are the ones its matchers paint', () => {
    // The page's spelling of each profile's composer prompt and working frame, against the
    // profile's own patterns: the arrows and words a reader watches for on a pane.
    const shown: [string, string, string, string][] = [
      ['claude-code', 'ready at its <code>❯</code> prompt box; working on <code>esc to interrupt</code>', '❯', 'esc to interrupt'],
      ['codex', 'ready at its <code>›</code> prompt; working on <code>esc to interrupt</code>', '›', 'esc to interrupt'],
      ['cursor', 'ready at its <code>→</code> prompt; working on <code>ctrl+c to stop</code>', '→', 'ctrl\\+c to stop'],
      ['antigravity', 'ready at its <code>&gt;</code> prompt; working on <code>Generating...</code>', '>', 'Generating'],
      ['grok', 'ready at its boxed <code>❯</code>; working on <code>[stop]</code>', '❯', '\\[stop\\]'],
      ['gemini', 'ready at its <code>*</code> or <code>&gt;</code> prompt in the box; working on <code>esc to cancel</code>', '[>*]', 'esc to cancel'],
      ['muse', 'ready at its <code>❯</code> prompt; working on <code>esc to interrupt</code>', '❯', 'esc to interrupt'],
    ];
    for (const [cli, words, prompt, working] of shown) {
      expect(cell(cli)[3], cli).toBe(words);
      // The words are the profile's own: its composer carries the prompt, its working frame
      // the words the page shows, so a rewritten matcher fails here as it fails the page.
      expect(/^\s*prompt: '([^']*)'/m.exec(read(`src/profiles/${cli}.yaml`))?.[1], `${cli} composer prompt`).toContain(prompt);
      expect(block(cli, 'working', 2), `${cli} working frame`).toContain(working);
    }
  });

  test('the Jules row and note are read from its profile by name', () => {
    const jules = read('src/profiles/jules.yaml');
    const [shownCli, shownBinary, shownFlags, shownScreen, shownCheck] = cell('jules');
    expect(shownCli).toBe('<code>jules</code>');
    expect(shownBinary).toBe('<code>jules</code>');
    // unattended: [] — the TUI has no auto-approve flag, so the cell is "none".
    expect(list(block('jules', 'unattended', 0))).toEqual([]);
    expect(shownFlags).toBe('none');
    expect(shownScreen).toContain('herdr');
    expect(shownCheck).toBe('none — the hint is <code>jules login</code>');
    // Its quirks, each read from the profile: the tested point, rules: prepend, the standing
    // rule, the unreliable herdr status, and the binary with no --version.
    expect(page).toContain('The Jules profile is tested with CLI 0.1.42');
    expect(jules).toMatch(/^[ \t]+from:[ \t]*'0\.1\.42'/m);
    expect(jules).toMatch(/^[ \t]+to:[ \t]*'0\.1\.42'/m);
    expect(page).toContain('its rules ride each brief as <code>rules: prepend</code>');
    expect(jules).toMatch(/^rules:[ \t]*prepend[ \t]*$/m);
    expect(page).toContain('Never delete a Jules session');
    expect(list(block('jules', 'standing_rules', 0))).toContain('Never delete a Jules session.');
    expect(page).toContain('herdr reports a Jules pane unreliably');
    expect(jules).toMatch(/^herdr_status:[ \t]*unreliable[ \t]*$/m);
    expect(page).toContain('answers no <code>--version</code>');
    expect(jules).toContain('answers no `--version`');
  });

  test('the page’s prose sections are the profiles, then the two lists around them', () => {
    expect(clis().toc.map(entry => entry.title)).toEqual([
      'Codex', 'Antigravity', 'Cursor', 'Grok', 'Gemini', 'Muse', 'Jules', 'Other labs through Claude Code', 'Not seat kinds yet',
    ]);
  });
});

describe('/docs/clis/, the notes the profiles carry', () => {
  test('grok’s tested range, flags, model reading and Cursor alternative are its profile’s own', () => {
    const grok = read('src/profiles/grok.yaml');
    expect(page).toContain('The Grok profile is tested with CLI 1.0.50 to 1.0.52');
    expect(page).toContain('<code>--always-approve</code>');
    expect(page).toContain('rides its rules on the launch line as <code>--rules</code>');
    expect(page).toContain('sets its model with <code>--model</code>');
    // The model itself is read off the composer's footer, with the launch line as the fallback.
    expect(grok).toMatch(/^status_model:/m);
    expect(page).toContain('reads the running model off the composer’s footer line');
    expect(grok).toMatch(/^unread_model:[ \t]*launch[ \t]*$/m);
    // And Cursor's own model list carries a Grok model, which its status row reads back.
    const cursor = read('src/profiles/cursor.yaml');
    expect(page).toContain('<code>grok-4.7-high</code> is <code>Grok 4.7</code>');
    expect(cursor).toContain('flag: grok-4.7-high');
    expect(page).toContain('Cursor reads the running model off its own status row');
  });

  test('the antigravity note shows only the model flag its profile carries', () => {
    expect(page).toContain('The Antigravity profile sets its model with <code>--model</code>');
    expect(read('src/profiles/antigravity.yaml')).toMatch(/^models:\n[\s\S]*?option:\n[ \t]+- --model$/m);
    // The reference carries no prose about which models it serves, so the page claims none.
    expect(page).not.toContain('also serves Claude and GPT models');
    expect(page).not.toContain('Google plan');
  });

  test('the Claude Code note names the four families the profile reads off its own screen', () => {
    expect(page).toContain('reads only Opus, Sonnet, Haiku and Fable off its own screen');
    expect(read('src/profiles/claude-code.yaml')).toContain('yields: [Claude Opus, Claude Sonnet, Claude Haiku, Claude Fable]');
  });

  test('the Gemini and Muse notes state only facts their profiles carry', () => {
    const muse = read('src/profiles/muse.yaml');
    // Muse: the Meta account and the /status reading are its profile's own; the "experimental"
    // and "fully adopted" wording is in no reference file, so the page does not carry it.
    expect(muse).toContain('account: meta');
    expect(muse).toContain('/status');
    expect(page).toContain('its Meta account shows only inside the CLI’s own <code>/status</code>');
    expect(page).not.toMatch(/experimental/i);
    expect(page).not.toContain('fully adopted');
    // Gemini: no profile carries an account rule, so the page claims none.
    expect(page).not.toContain('Google Workspace');
    expect(page).not.toContain('a personal Google account');
    // The no-check note is tied to the absent check: field (both profiles carry login.hint only).
    for (const cli of ['gemini', 'muse']) {
      expect(block(cli, 'login', 0)).not.toMatch(/^\s*check:/m);
      expect(page).toContain(`<code>team doctor --login</code> notes <code>${cli}: the login is not checked in this version</code>`);
    }
  });

  test('a bridging note reconciles the five available profiles with the eight in the table', () => {
    // The file's-format bullet names five available; the table shows eight. The note names the
    // three the table adds as the "others" doctor reports, tied to the bullet so it cannot drift.
    const bullet = read('docs/team-file.md');
    for (const cli of ['claude-code', 'codex', 'cursor', 'antigravity', 'grok']) expect(bullet).toContain(`\`${cli}\``);
    expect(page).toContain('<code>gemini</code>, <code>muse</code> and <code>jules</code> — are the others <code>team doctor</code> reports on');
    expect(page).toContain('The native Kimi CLI is not a seat kind in this build');
  });

  test('the "Other labs" section gives one launcher example and no account, path or key name', () => {
    expect(page).toContain('Any Anthropic-compatible endpoint runs as a Claude Code seat');
    expect(page).toContain('reads that account’s API key from the OS keychain');
    expect(page).toContain('beside <code>cli: claude-code</code>: <code>launch: my-lab-claude</code>');
    expect(page).toContain('<code>model_from: launcher</code>');
    // The team file reference carries the shape the note points at: a launcher on the PATH picks the model.
    const readme = read('docs/team-file.md');
    expect(readme).toContain('a launcher on the PATH');
    expect(readme).toContain('model_from: launcher');
    // One starter, and it is the generic one: the page names no lab's script, path or key.
    expect([...page.matchAll(/launch: [a-z-]+/g)].map(match => match[0])).toEqual(['launch: my-lab-claude']);
  });

  test('the page reads a screen with the reference’s own two sentences about it', () => {
    // The prose's straight quotes are entities in the HTML, so the reading is checked as text.
    const text = decodeEntities(page);
    expect(text).toContain("A screen that reproduces a CLI's complete idle frame");
    expect(text).toContain('the live-agent check is the second layer');
  });
});
