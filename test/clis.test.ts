// The grok facts /docs/clis reads by name from the launch profile. The README names grok in
// the CLI list and the sign-in paragraph but carries no grok prose section, so the page reads
// grok's tested version and its lack of a status_model from `grok.yaml`; these assertions pin
// what the page shows against the profile the build extracts it from.
import { describe, expect, test } from 'bun:test';
import { read } from '../src/server/team';

describe('the grok profile, read by name for /docs/clis', () => {
  const grok = read('src/profiles/grok.yaml');

  test('its tested CLI version is the one the page shows', () => {
    expect(/\n\s*tested:\s*\n\s*from:\s*'([^']+)'/.exec(grok)?.[1]).toBe('1.0.50');
  });

  test('it declares no status_model, so a grok seat reads its model from the file', () => {
    expect(/^status_model:/m.test(grok)).toBe(false);
  });

  test('its sign-in check and hint are grok models / grok login', () => {
    expect(grok).toMatch(/\n\s*login:\s*\n\s*check:\s*\n\s*-\s*models\b/);
    expect(/\n\s*hint:\s*(grok login)\b/.exec(grok)?.[1]).toBe('grok login');
  });
});
