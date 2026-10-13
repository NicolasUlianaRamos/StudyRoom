const { _electron: electron } = require('@playwright/test');
const { resolve } = require('node:path');
const { readdirSync } = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: process.env.STUDYROOM_TEST_PLATFORM === 'wayland' ? ['--ozone-platform=wayland'] : [],
    executablePath: resolve(process.argv[2] || (process.platform === 'win32'
      ? 'release/win-unpacked/StudyRoom.exe'
      : 'release/linux-unpacked/studyroom')),
    env,
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole('heading', { name: 'Um passo de cada vez.' }).waitFor();
    const result = await app.evaluate(({ app }) => ({
      packaged: app.isPackaged,
      version: app.getVersion(),
      electron: process.versions.electron,
    }));
    const state = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
    assert.equal(result.packaged, true);
    assert.equal(result.version, require('../package.json').version);
    assert.equal(state.statistics.length, 8);
    assert.ok(Array.isArray(state.pdfs));
    const workerFile = readdirSync('dist/assets').find(name => name.startsWith('pdf.worker.'));
    if (!workerFile) throw new Error('Worker PDF não encontrado no build.');
    const pdfAssets = await page.evaluate(async workerFile => {
      const result = {};
      for (const path of ['pdfjs/standard_fonts/LiberationSans-Regular.ttf', 'assets/' + workerFile]) {
        const response = await fetch(new URL(path, window.location.href));
        if (!response.ok) throw new Error('Recurso PDF ausente: ' + path);
        result[path] = (await response.arrayBuffer()).byteLength;
      }
      return result;
    }, workerFile);
    await page.screenshot({ path: 'test-results/package.png' });
    console.log(
      JSON.stringify(
        {
          ...result,
          sites: state.sites.map((s) => s.name),
          onboarding: !state.settings.onboarded,
          statisticsWeeks: state.statistics.length,
          todayMs: state.todayMs,
          pdfs: state.pdfs.length,
          pdfAssets,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
