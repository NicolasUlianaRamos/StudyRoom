const { _electron: electron } = require('@playwright/test');
const { mkdtemp, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
(async () => {
  const data = await mkdtemp(join(tmpdir(), 'studyroom-public-smoke-'));
  const env = { ...process.env, STUDYROOM_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['.', '--studyroom-test'],
    env,
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Preparar meu espaço' }).click();
    await page.getByRole('button', { name: 'Só começar por 5 minutos' }).click();
    // A página pública carrega conteúdo de forma assíncrona após o cabeçalho.
    await page.waitForTimeout(45000);
    const result = await app.evaluate(async ({ webContents }) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL().startsWith('https://'));
      if (!wc) return { loaded: false };
      return {
        loaded: true,
        domain: new URL(wc.getURL()).hostname,
        title: wc.getTitle(),
        image: (await wc.capturePage()).toPNG().toString('base64'),
      };
    });
    if (result.image) {
      await writeFile('test-results/qconcursos-public.png', Buffer.from(result.image, 'base64'));
      delete result.image;
    }
    const state = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
    console.log(
      JSON.stringify(
        { ...result, loading: state.browser.loading, error: state.browser.error, blocked: state.browser.blocked },
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
