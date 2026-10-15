import { _electron as electron } from '@playwright/test';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
if (process.env.CI !== 'true')
  throw new Error('Execute este teste somente no runner descartável do CI.');

const candidates =
  process.platform === 'darwin'
    ? [
        'release/mac-arm64/StudyRoom.app/Contents/MacOS/StudyRoom',
        'release/mac/StudyRoom.app/Contents/MacOS/StudyRoom',
      ]
    : process.platform === 'win32'
      ? ['release/win-unpacked/StudyRoom.exe']
      : ['release/linux-unpacked/studyroom'];
let executablePath;
for (const candidate of candidates) {
  try {
    await access(candidate);
    executablePath = resolve(candidate);
    break;
  } catch {}
}
if (!executablePath) throw new Error('Aplicativo empacotado não encontrado');

let app;
try {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ executablePath, args: [], env });
  const page = await app.firstWindow();
  await page.getByRole('heading', { name: 'Um passo de cada vez.' }).waitFor();
  const version = await app.evaluate(({ app }) => {
    if (!app.isPackaged) throw new Error('Não é o aplicativo empacotado');
    return app.getVersion();
  });
  await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  console.log('Aplicativo empacotado abriu com banco local: ' + version);
} finally {
  if (app) await app.close();
}
