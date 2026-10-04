// Local dev on port 4310: one loop that owns the builds and the server.
//
//   styles, src/client   → build site.js and the stylesheets, then restart the server
//   src/server, server.ts → restart the server
//
// The server restarts only after its build succeeded, so a broken stylesheet or a
// TypeScript error in the client leaves the last good build serving. `bun run dev`
// runs scripts/content.ts first: the pages are rendered from content/team.
import { existsSync, watch } from 'node:fs';
import { resolve } from 'node:path';
import type { Subprocess } from 'bun';

const root = resolve(import.meta.dir, '..');
type Step = 'assets' | 'server';
const order: Step[] = ['assets', 'server'];
const pending = new Set<Step>();
let running = false;
let server: Subprocess | null = null;

const build = async (label: string, cmd: string[]) => {
  const started = performance.now();
  const code = await Bun.spawn(cmd, { cwd: root, stdout: 'inherit', stderr: 'inherit' }).exited;
  console.log(code === 0
    ? `${label} built in ${Math.round(performance.now() - started)} ms.`
    : `${label} build failed (exit ${code}); the server keeps the last good build.`);
  return code === 0;
};

const restart = async () => {
  if (server) {
    server.kill();
    await server.exited;
  }
  server = Bun.spawn(['bun', 'server.ts'], { cwd: root, stdout: 'inherit', stderr: 'inherit' });
  return true;
};

async function drain() {
  if (running) return;
  running = true;
  while (pending.size) {
    const step = order.find(candidate => pending.has(candidate))!;
    pending.delete(step);
    const ok = step === 'assets' ? await build('site', ['bun', 'scripts/build.ts']) : await restart();
    // Nothing downstream of a failed build should pick up its result.
    if (!ok) pending.clear();
  }
  running = false;
}

// A burst of changes collapses into one pass.
let timer: ReturnType<typeof setTimeout> | undefined;
const schedule = (from: Step) => {
  for (const step of order.slice(order.indexOf(from))) pending.add(step);
  clearTimeout(timer);
  timer = setTimeout(drain, 200);
};

for (const directory of ['styles', 'src/client']) watch(resolve(root, directory), { recursive: true }, () => schedule('assets'));
for (const path of ['server.ts', 'src/server', 'src/server/shells', 'public']) {
  const target = resolve(root, path);
  if (existsSync(target)) watch(target, { recursive: true }, () => schedule('server'));
}
console.log('Watching styles, src/client, src/server, server.ts and public.');

schedule('assets');

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server?.kill(); process.exit(0); });
