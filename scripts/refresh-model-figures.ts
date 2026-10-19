// refresh:models — re-read the sources behind the model family pages' figures.
//
// The figures live in src/data/model-figures.json, every one naming the page it was read on
// and the date it was read; the loader in src/server/models.ts validates that file at build,
// so importing it here is the same validation the build runs. This script adds the network to
// that: it fetches every source's page, reports each one's status, and — only when asked, with
// --stamp — writes today's date into refreshedAt, after the values themselves have been re-read
// and corrected by hand against those pages. It never writes a figure: a value no source
// publishes is a dash, and a dash is left alone.
import { FIGURES, FIGURE_SOURCES } from '../src/server/models';

const stamp = process.argv.includes('--stamp');
const today = new Date().toISOString().slice(0, 10);

let failed = 0;
for (const [id, source] of Object.entries(FIGURE_SOURCES)) {
  process.stdout.write(`${id.padEnd(24)} ${source.href}  (read ${source.read})  `);
  try {
    const response = await fetch(source.href, { method: 'GET', redirect: 'follow' });
    const note = response.redirected ? ` → ${response.url}` : '';
    process.stdout.write(`${response.status}${note}\n`);
    if (!response.ok) failed += 1;
  } catch (error) {
    process.stdout.write(`unreachable: ${(error as Error).message}\n`);
    failed += 1;
  }
}

console.log(`\n${Object.keys(FIGURE_SOURCES).length} sources, ${failed} failed. Figures refreshed ${FIGURES.refreshedAt}.`);
if (failed) {
  console.log('A source that did not answer is a figure to re-read by hand, not a pass.');
  process.exit(1);
}
if (stamp) {
  if (FIGURES.refreshedAt === today) {
    console.log('refreshedAt already holds today; nothing written.');
  } else {
    const path = new URL('../src/data/model-figures.json', import.meta.url);
    const text = await Bun.file(path).text();
    await Bun.write(path, text.replace(`"refreshedAt": "${FIGURES.refreshedAt}"`, `"refreshedAt": "${today}"`));
    console.log(`refreshedAt written: ${FIGURES.refreshedAt} → ${today}.`);
  }
} else {
  console.log('Run again with --stamp, after re-reading and correcting the values, to move refreshedAt.');
}
