import { createServer } from 'vite';
import { _electron as electron } from '@playwright/test';
import electronPath from 'electron';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
await import('./build.mjs');
const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } });
await server.listen();
const env = {
  ...process.env,
  STUDYROOM_DEV_URL: 'http://127.0.0.1:5173',
  STUDYROOM_TEST_DATA: await mkdtemp(join(tmpdir(), 'studyroom-dev-')),
};
delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
  app = await electron.launch({
    executablePath: electronPath,
    args: ['.', '--studyroom-test'],
    env,
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('heading', { name: 'Um passo de cada vez.' }).waitFor();
  await page.getByRole('button', { name: 'Preparar meu espaço' }).click();
  if (errors.length) throw new Error(errors.join('; '));
  console.log('DEV_OK: interface React e IPC carregados via Vite, sem erro de JavaScript.');
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await server.close();
}
