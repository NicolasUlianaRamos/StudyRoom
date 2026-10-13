import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, readFile, writeFile, unlink } from 'node:fs/promises';
import { pdfFixture } from '../pdf-fixture';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
let server: Server;
let origin: string;
let data: string;
let app: ElectronApplication;
let page: Page;
let appRunning = false;
async function exitTestApp() {
  if (!app || !appRunning) return;
  appRunning = false;
  const process = app.process();
  if (process.exitCode !== null || process.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => process.once('exit', () => resolve()));
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await exited;
}
async function launch() {
  const env: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
    STUDYROOM_TEST_DATA: data,
    STUDYROOM_TEST_ORIGIN: origin,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({
    executablePath: require('electron') as string,
    args: [
      '.',
      '--studyroom-test',
      ...(process.env.STUDYROOM_TEST_PLATFORM === 'wayland' ? ['--ozone-platform=wayland'] : []),
    ],
    env,
  });
  appRunning = true;
  page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'Um passo de cada vez.' })).toBeVisible();
}
async function remote(script: string) {
  return app.evaluate(
    ({ webContents }, { origin, script }) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL().startsWith(origin));
      if (!wc) throw new Error('Fixture não carregada');
      return wc.executeJavaScript(script, true);
    },
    { origin, script },
  );
}
async function remoteUrl() {
  return app.evaluate(
    ({ webContents }, origin) =>
      webContents
        .getAllWebContents()
        .find((w) => w.getURL().startsWith(origin))
        ?.getURL(),
    origin,
  );
}
async function remoteKey(key: string) {
  await app.evaluate(
    ({ webContents }, { origin, key }) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL().startsWith(origin));
      if (!wc) throw new Error('Fixture não carregada');
      wc.focus();
      wc.sendInputEvent({ type: 'keyDown', keyCode: key });
      wc.sendInputEvent({ type: 'keyUp', keyCode: key });
    },
    { origin, key },
  );
}
async function viewBounds() {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return {
      bounds: win.contentView.children[0].getBounds(),
      size: win.getContentSize(),
      fullscreen: win.isFullScreen(),
    };
  });
}
async function localKey(key: string) {
  await app.evaluate(({ BrowserWindow }, key) => {
    const wc = BrowserWindow.getAllWindows()[0].webContents;
    wc.focus();
    wc.sendInputEvent({ type: 'keyDown', keyCode: key });
    wc.sendInputEvent({ type: 'keyUp', keyCode: key });
  }, key);
}
test.beforeAll(async () => {
  data = await mkdtemp(join(tmpdir(), 'studyroom-e2e-'));
  server = createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: 'https://instagram.com/' });
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<!doctype html><title>Fixture de estudos</title><h1>Estudo local</h1><input id="answer"><a id="internal" href="/next">Questão seguinte</a><a id="blocked" href="https://instagram.com/">Distração</a><a id="redirect" href="/redirect">Redirect</a><a id="popup" target="_blank" href="https://reddit.com/">Popup bloqueado</a><a id="allowed-popup" target="_blank" href="/popup">Popup interno</a><a id="protocol" href="file:///secret">Arquivo</a><iframe src="https://youtube.com/embed/a"></iframe>',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
});
test.afterAll(async () => {
  await exitTestApp();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (!data.startsWith(join(tmpdir(), 'studyroom-e2e-'))) throw new Error('Diretório inesperado');
  await rm(data, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
});

test('aplicativo real: onboarding, persistência, navegador, redirecionamentos, popups e isolamento', async () => {
  await launch();
  await page.getByRole('button', { name: 'Preparar meu espaço' }).click();
  await page.getByRole('button', { name: 'Sites e preferências', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Documentação');
  await page.getByLabel('Página inicial', { exact: true }).fill('https://developer.mozilla.org/');
  await page.getByRole('button', { name: 'Adicionar site' }).click();
  await expect(page.getByText('Documentação', { exact: true })).toBeVisible();
  await page.getByLabel('Proteção da sessão').selectOption('light');
  await page.getByRole('button', { name: 'Meu espaço', exact: true }).click();
  await page.screenshot({ path: 'test-results/home.png' });
  await page.getByRole('button', { name: 'Só começar por 5 minutos' }).click();
  await expect(page.locator('.timer')).toContainText('04:');
  await page.evaluate((url) => window.studyroom.command({ type: 'navigate', url }), origin + '/');
  await expect.poll(remoteUrl).toContain(origin);

  await remote("document.querySelector('#answer').value='Minha resposta'");
  await remote("document.querySelector('#internal').click()");
  await expect.poll(remoteUrl).toBe(origin + '/next');
  expect(await remote('({node:typeof require,bridge:typeof window.studyroom})')).toEqual({
    node: 'undefined',
    bridge: 'undefined',
  });
  await remote("document.querySelector('#blocked').click()");
  await expect(page.getByText('Este site não faz parte do seu ambiente de estudos.')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar ao estudo', exact: true }).click();
  await remote("document.querySelector('#redirect').click()");
  await expect(page.getByText('Este site não faz parte do seu ambiente de estudos.')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar ao estudo', exact: true }).click();
  await remote("document.querySelector('#popup').click()");
  await expect(page.getByText('Este site não faz parte do seu ambiente de estudos.')).toBeVisible();
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  await page.getByRole('button', { name: 'Voltar ao estudo', exact: true }).click();
  await remote("document.querySelector('#allowed-popup').click()");
  await expect.poll(remoteUrl).toBe(origin + '/popup');
  // Respostas sintéticas: verifica o redirecionamento sem contas, senhas ou rede Google.
  await app.evaluate(({ session }) => {
    session.fromPartition('persist:studyroom-web').protocol.handle('https', (request) => {
      const url = new URL(request.url);
      if (url.hostname === 'accounts.google.com' && url.pathname === '/v3/signin/identifier')
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://accounts.google.com.br/accounts/SetSID' },
        });
      if (url.hostname === 'accounts.google.com.br' && url.pathname === '/accounts/SetSID')
        return new Response(
          '<!doctype html><title>Passagem regional simulada</title><h1>Login regional de teste</h1>',
          {
            headers: { 'Content-Type': 'text/html' },
          },
        );
      if (url.hostname === 'qconcursos.com')
        return new Response('<!doctype html><h1>Retorno ao estudo simulado</h1>', {
          headers: { 'Content-Type': 'text/html' },
        });
      return new Response('Destino de teste não cadastrado', { status: 404 });
    });
  });
  try {
    await page.evaluate(() =>
      window.studyroom.command({
        type: 'navigate',
        url: 'https://accounts.google.com.br/accounts/SetSID',
      }),
    );
    await expect(
      page.getByText('Este site não faz parte do seu ambiente de estudos.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao estudo', exact: true }).click();
    await page.getByRole('button', { name: 'Autorizar login Google', exact: true }).click();
    await page.evaluate(() =>
      window.studyroom.command({
        type: 'navigate',
        url: 'https://accounts.google.com/v3/signin/identifier',
      }),
    );
    await expect
      .poll(() =>
        app.evaluate(({ webContents }) =>
          webContents
            .getAllWebContents()
            .some((wc) => wc.getURL() === 'https://accounts.google.com.br/accounts/SetSID'),
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        app.evaluate(({ webContents }) => {
          const wc = webContents
            .getAllWebContents()
            .find((wc) => wc.getURL() === 'https://accounts.google.com.br/accounts/SetSID');
          return wc?.executeJavaScript('document.querySelector("h1")?.textContent');
        }),
      )
      .toBe('Login regional de teste');
    const regional = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
    expect(regional.browser.blocked).toBe('');
    expect(regional.browser.authUntil).toBeGreaterThan(regional.now);
    await page.evaluate(() =>
      window.studyroom.command({ type: 'navigate', url: 'https://qconcursos.com/' }),
    );
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }))).browser
            .authUntil,
      )
      .toBe(0);
    await page.evaluate(() =>
      window.studyroom.command({
        type: 'navigate',
        url: 'https://accounts.google.com.br/accounts/SetSID',
      }),
    );
    await expect(
      page.getByText('Este site não faz parte do seu ambiente de estudos.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao estudo', exact: true }).click();
  } finally {
    await page.evaluate(
      (url) => window.studyroom.command({ type: 'navigate', url }),
      origin + '/popup',
    );
    await expect.poll(remoteUrl).toBe(origin + '/popup');
    await app.evaluate(({ session }) =>
      session.fromPartition('persist:studyroom-web').protocol.unhandle('https'),
    );
  }
  await remote("document.querySelector('#answer').value='Resposta preservada no modo imersivo'");
  const beforeImmersive = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  await remoteKey('F11');
  await expect(
    page.getByRole('button', { name: 'Sair do modo imersivo (F11 ou Esc)', exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const { bounds, size, fullscreen } = await viewBounds();
      return (
        fullscreen &&
        bounds.y === 36 &&
        bounds.x === 0 &&
        bounds.width === size[0] &&
        bounds.height === size[1] - 36
      );
    })
    .toBe(true);
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.focus-header')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Recarregar', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Controles', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recarregar', exact: true })).toBeVisible();
  await expect.poll(async () => (await viewBounds()).bounds.y).toBeGreaterThan(36);
  await page.getByRole('button', { name: 'Ocultar controles', exact: true }).click();
  await expect.poll(async () => (await viewBounds()).bounds.y).toBe(36);
  await page.getByRole('button', { name: 'Anotações', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: 'Anotações durante o estudo' }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const { bounds, size } = await viewBounds();
      return bounds.width < size[0] - 250 && bounds.y === 36;
    })
    .toBe(true);
  await page.getByRole('button', { name: 'Fechar anotações', exact: true }).click();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByText('Uma pausa também faz parte.')).toBeVisible();
  expect((await viewBounds()).fullscreen).toBe(true);
  const pausedBeforeGame = await page.evaluate(() =>
    window.studyroom.command({ type: 'snapshot' }),
  );
  await page.getByRole('button', { name: '5 minutos', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveText('05:00');
  await page.getByRole('button', { name: '3 minutos', exact: true }).click();
  await page.getByRole('button', { name: 'Jogar cobrinha', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar jogo', exact: true }).click();
  await expect.poll(() => page.locator('.snake-head').getAttribute('x')).not.toBe('61');
  await page.locator('.snake-board').press('ArrowUp');
  await expect.poll(() => page.locator('.snake-head').getAttribute('y')).not.toBe('91');
  await page.getByRole('timer').click();
  const stopped = await page.locator('.snake-head').getAttribute('y');
  await page.waitForTimeout(350);
  expect(await page.locator('.snake-head').getAttribute('y')).toBe(stopped);
  await page.getByRole('button', { name: 'Continuar jogo', exact: true }).click();
  await page.screenshot({ path: 'test-results/study-break.png' });
  const breakTime = await page.getByRole('timer').textContent();
  await page.getByRole('button', { name: 'Jogar Pac-Man', exact: true }).click();
  await expect(page.locator('.maze-board')).toBeVisible();
  // Escolher outro jogo conserva o intervalo já iniciado.
  expect(await page.getByRole('timer').textContent()).not.toBe('03:00');
  expect(breakTime).not.toBe('03:00');
  await page.getByRole('button', { name: 'Continuar jogo', exact: true }).click();
  await expect
    .poll(() => page.locator('.maze-player').getAttribute('transform'))
    .not.toContain('translate(270 470)');
  await page.locator('.maze-board').press('d');
  await expect
    .poll(() => page.locator('.maze-player').getAttribute('transform'))
    .toContain('rotate(0)');
  await page.getByRole('timer').click();
  const mazeStopped = await page.locator('.maze-player').getAttribute('transform');
  await page.waitForTimeout(350);
  expect(await page.locator('.maze-player').getAttribute('transform')).toBe(mazeStopped);
  await page.getByRole('button', { name: 'Continuar jogo', exact: true }).click();
  await page.screenshot({ path: 'test-results/maze-break.png' });
  await page.clock.setSystemTime(new Date(Date.now() + 181_000));
  await expect(page.getByRole('status')).toHaveText('Pausa concluída. Vamos voltar ao estudo?');
  await expect(page.getByRole('timer')).toHaveText('00:00');
  await expect(page.getByRole('button', { name: 'Continuar jogo', exact: true })).toBeHidden();
  const pausedAfterGame = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(pausedAfterGame.active!.effectiveMs).toBe(pausedBeforeGame.active!.effectiveMs);
  expect(pausedAfterGame.active!.status).toBe('paused');
  await page.clock.setSystemTime(new Date());
  await page.getByRole('button', { name: 'Retomar', exact: true }).click();
  await expect(page.getByText('Uma pausa também faz parte.')).toBeHidden();
  const immersiveState = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(immersiveState.active!.id).toBe(beforeImmersive.active!.id);
  expect(immersiveState.active!.pauses).toBe(beforeImmersive.active!.pauses + 1);
  expect(await remote("document.querySelector('#answer').value")).toBe(
    'Resposta preservada no modo imersivo',
  );
  const immersiveImage = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].capturePage()).toPNG().toString('base64'),
  );
  await writeFile('test-results/immersive.png', Buffer.from(immersiveImage, 'base64'));
  await remoteKey('Escape');
  await expect.poll(async () => (await viewBounds()).fullscreen).toBe(false);
  await expect(page.locator('.topbar')).toBeVisible();
  await expect.poll(async () => (await viewBounds()).bounds.y).toBeGreaterThan(100);
  await localKey('F11');
  await expect(
    page.getByRole('button', { name: 'Sair do modo imersivo (F11 ou Esc)', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Sair do modo imersivo (F11 ou Esc)', exact: true })
    .click();
  await expect.poll(async () => (await viewBounds()).fullscreen).toBe(false);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByText('Uma pausa também faz parte.')).toBeVisible();
  const before = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(after.active!.effectiveMs).toBe(before.active!.effectiveMs);
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await app.close();
  await launch();
  await page.getByRole('button', { name: 'Sites e preferências', exact: true }).click();
  await expect(page.getByText('Documentação', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Proteção da sessão')).toHaveValue('light');
  await page.getByLabel('Proteção da sessão').selectOption('strong');
  await page.getByLabel('Intervalo de reflexão').selectOption('5');
  await page.getByRole('button', { name: 'Meu espaço', exact: true }).click();
  await page.getByRole('button', { name: 'Só começar por 5 minutos' }).click();
  const rejected = await page.evaluate(async () => {
    try {
      await window.studyroom.command({ type: 'site:remove', id: 1 });
      return false;
    } catch {
      return true;
    }
  });
  expect(rejected).toBe(true);
  await page.getByRole('button', { name: 'Modo imersivo (F11)', exact: true }).click();
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Encerrar sessão' })).toBeVisible();
  await localKey('Escape');
  await expect.poll(async () => (await viewBounds()).fullscreen).toBe(false);
  await expect(page.getByRole('dialog', { name: 'Encerrar sessão' })).toBeVisible();
  await page.getByLabel('O que motivou a saída?').fill('Teste de encerramento');
  await expect(page.getByRole('button', { name: /Aguarde/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Encerrar sessão', exact: true })).toBeEnabled({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Encerrar sessão', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Um passo de cada vez.' })).toBeVisible();
});

test('recupera sessão após saída abrupta e preserva isolamento e limites de layout', async () => {
  await page.getByRole('button', { name: 'Só começar por 5 minutos' }).click();
  await page.evaluate((url) => window.studyroom.command({ type: 'navigate', url }), origin + '/');
  await expect.poll(remoteUrl).toContain(origin);
  await remote("localStorage.setItem('studyroom-test','persisted')");
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1024, 720));
  await expect
    .poll(async () =>
      app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        const [width, height] = win.getContentSize();
        const b = win.contentView.children[0].getBounds();
        return (
          b.x >= 0 &&
          b.y > 100 &&
          b.x + b.width <= width &&
          b.y + b.height <= height &&
          b.height > 200
        );
      }),
    )
    .toBe(true);
  await expect
    .poll(async () => {
      const s = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
      return s.active!.checkpoint - s.active!.start;
    })
    .toBeGreaterThanOrEqual(1000);
  const before = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  await exitTestApp();
  await launch();
  const recovered = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(recovered.recovered).toBe(true);
  expect(recovered.active?.status).toBe('paused');
  expect(recovered.active!.effectiveMs).toBeGreaterThanOrEqual(1000);
  expect(recovered.active!.effectiveMs).toBeLessThanOrEqual(
    before.now - before.active!.start + 1500,
  );
  await page.getByRole('button', { name: 'Continuar estudando' }).click();
  await expect(page.getByText('Uma pausa também faz parte.')).toBeVisible();
  await page.evaluate((url) => window.studyroom.command({ type: 'navigate', url }), origin + '/');
  await expect.poll(remoteUrl).toContain(origin);
  expect(await remote("localStorage.getItem('studyroom-test')")).toBe('persisted');
  await page.getByRole('button', { name: 'Alternar tema' }).click();
  await page.screenshot({ path: 'test-results/recovered-dark.png' });
  await exitTestApp();
});

test('anotações e Ver depois: autosave, painel nativo, pesquisa, exportação e reinício', async () => {
  await launch();
  await page.getByRole('button', { name: 'Continuar estudando' }).click();
  await page.evaluate((url) => window.studyroom.command({ type: 'navigate', url }), origin + '/');
  await page.getByRole('button', { name: 'Retomar', exact: true }).click();
  await expect.poll(remoteUrl).toContain(origin);
  const fullWidth = await app.evaluate(
    ({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].contentView.children[0].getBounds().width,
  );
  await page.getByRole('button', { name: 'Anotações', exact: true }).click();
  await expect
    .poll(() =>
      app.evaluate(
        ({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].contentView.children[0].getBounds().width,
      ),
    )
    .toBeLessThan(fullWidth);
  await page.getByRole('button', { name: 'Ver depois', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Pesquisar depois');
  await page.getByLabel('Matéria (opcional)').fill('Engenharia');
  await page.getByLabel('Texto', { exact: true }).pressSequentially('Revisar Scrum e papéis.');
  await expect(page.getByRole('status')).toHaveText('Salvo neste computador');
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }))).notes[0]?.body,
    )
    .toBe('Revisar Scrum e papéis.');
  expect(await remote('typeof window.studyroom')).toBe('undefined');
  expect(await remoteUrl()).toBe(origin + '/');
  const bounds = await page.locator('.focus-notes').boundingBox();
  const nativeRight = await app.evaluate(({ BrowserWindow }) => {
    const b = BrowserWindow.getAllWindows()[0].contentView.children[0].getBounds();
    return b.x + b.width;
  });
  expect(nativeRight).toBeLessThanOrEqual(bounds!.x + 1);
  await page.screenshot({ path: 'test-results/notes-focus.png' });
  await page.getByRole('button', { name: 'Fechar anotações' }).click();
  await expect
    .poll(() =>
      app.evaluate(
        ({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].contentView.children[0].getBounds().width,
      ),
    )
    .toBe(fullWidth);
  await exitTestApp();
  await launch();
  await page.getByRole('button', { name: 'Anotações', exact: true }).click();
  await page.getByLabel('Pesquisar anotações').fill('ENGENHARIA');
  await page.getByRole('button', { name: /Pesquisar depois/ }).click();
  await expect(page.getByLabel('Texto', { exact: true })).toHaveValue('Revisar Scrum e papéis.');
  await expect(page.getByLabel('Tipo', { exact: true })).toHaveValue('later');
  const exportPath = join(data, 'nota-exportada.md');
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
  }, exportPath);
  await page.getByRole('button', { name: 'Exportar Markdown' }).click();
  await expect
    .poll(async () => {
      try {
        return await readFile(exportPath, 'utf8');
      } catch {
        return '';
      }
    })
    .toContain('Matéria: Engenharia\n\nRevisar Scrum e papéis.');
  // A canceled native dialog must never write a second file.
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' });
  });
  await page.getByRole('button', { name: 'Exportar Markdown' }).click();
  await page.getByRole('button', { name: 'Todas as anotações' }).click();
  await page.getByLabel('Pesquisar anotações').fill('inexistente');
  await expect(page.getByText('Nenhuma anotação encontrada.')).toBeVisible();
  await page.getByLabel('Pesquisar anotações').fill('');
  await page.getByRole('button', { name: /Pesquisar depois/ }).click();
  await page.getByRole('button', { name: 'Excluir anotação', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByLabel('Texto', { exact: true })).toHaveValue('Revisar Scrum e papéis.');
  await page.getByRole('button', { name: 'Excluir anotação', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.getByText('Suas ideias ficam salvas aqui, neste computador.')).toBeVisible();
  await exitTestApp();
});

test('planejador: persistência, links autorizados, sessões, retomada e notas vinculadas', async () => {
  await launch();
  // Finish the session recovered by the preceding scenario.
  await page.evaluate(() => window.studyroom.command({ type: 'exit:request' }));
  await page.getByLabel('O que motivou a saída?').fill('Organizar planejamento');
  await expect(page.getByRole('button', { name: 'Encerrar sessão', exact: true })).toBeEnabled({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Encerrar sessão', exact: true }).click();
  await page.evaluate(async () => {
    await window.studyroom.command({ type: 'settings', settings: { mode: 'light' } });
    await window.studyroom.command({
      type: 'site:add',
      name: 'Fixture HTTPS',
      url: 'https://studyroom.example/',
      subdomains: false,
    });
  });
  await page.getByRole('button', { name: 'Planejador', exact: true }).click();
  await page.getByRole('button', { name: 'Nova matéria' }).click();
  await page.getByLabel('Nome da matéria').fill('Engenharia');
  await page.getByRole('button', { name: 'Salvar matéria' }).click();
  await page.getByRole('button', { name: 'Adicionar assunto' }).click();
  await page.getByLabel('Nome do assunto').fill('Scrum');
  await page.getByLabel('Link autorizado').fill('https://instagram.com/');
  await page.getByRole('button', { name: 'Salvar assunto' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Autorize este site');
  await page.getByLabel('Link autorizado').fill('https://studyroom.example/questoes?filtro=scrum');
  await page.getByLabel('Tempo previsto (minutos)').fill('17');
  await page.getByLabel('Prioridade', { exact: true }).selectOption('3');
  await page.getByLabel('Próxima revisão').fill('2026-11-20');
  await page.getByRole('button', { name: 'Salvar assunto' }).click();
  await expect(page.getByRole('heading', { name: 'Scrum', exact: true })).toBeVisible();
  await exitTestApp();
  await launch();
  await page.getByRole('button', { name: 'Planejador', exact: true }).click();
  await expect(page.getByText('Prioridade alta · 17 min')).toBeVisible();
  // Deterministic HTTPS fixture; no external website or credentials needed.
  await app.evaluate(({ session }) => {
    session
      .fromPartition('persist:studyroom-web')
      .protocol.handle(
        'https',
        () => new Response('<!doctype html><title>Assunto local</title><h1>Scrum</h1>'),
      );
  });
  await page.getByRole('button', { name: 'Estudar agora' }).click();
  await expect(page.getByText('Engenharia · Scrum', { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      app.evaluate(({ webContents }) =>
        webContents
          .getAllWebContents()
          .find((w) => w.getURL().startsWith('https://studyroom.example/'))
          ?.getURL(),
      ),
    )
    .toBe('https://studyroom.example/questoes?filtro=scrum');
  const first = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(first.active).toMatchObject({
    topicName: 'Scrum',
    subjectName: 'Engenharia',
    plannedMs: 17 * 60000,
  });
  expect(first.topics[0].lastStudied).not.toBeNull();
  await page.getByRole('button', { name: 'Anotações', exact: true }).click();
  await page.getByRole('button', { name: 'Nova anotação' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Nota vinculada');
  await page.getByLabel('Texto', { exact: true }).fill('Papéis de Scrum');
  await expect(page.getByRole('status')).toHaveText('Salvo neste computador');
  await expect(page.getByLabel('Matéria do planejador')).toHaveValue(first.active!.subjectId!);
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Só começar por 5 minutos' }).click();
  const next = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(next.active).toMatchObject({ topicId: first.active!.topicId, plannedMs: 300000 });
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir planejador' }).click();
  await expect(page.getByRole('button', { name: 'Estudar agora' })).toBeDisabled();
  await page.getByRole('button', { name: 'Continuar estudando' }).click();
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Planejador', exact: true }).click();
  await page.screenshot({ path: 'test-results/planner.png' });
  // Revoking a site permission must prevent starting a saved topic.
  await page.evaluate(async () => {
    const s = await window.studyroom.command({ type: 'snapshot' });
    await window.studyroom.command({
      type: 'site:toggle',
      id: s.sites.find((s) => s.name === 'Fixture HTTPS')!.id,
    });
  });
  await page.getByRole('button', { name: 'Estudar agora' }).click();
  await expect(page.getByRole('alert')).toContainText('não está mais autorizado');
  expect(
    (await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }))).active,
  ).toBeNull();
  await page.getByRole('button', { name: 'Excluir matéria' }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  const removed = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(removed.topics).toHaveLength(0);
  expect(removed.notes[0]).toMatchObject({
    subjectId: null,
    subject: 'Engenharia',
    body: 'Papéis de Scrum',
  });
  expect(removed.history.some((s) => s.topicName === 'Scrum')).toBe(true);
  await exitTestApp();
});

test('perfis persistem e isolam permissões com troca protegida', async () => {
  await launch();
  await page.evaluate(() =>
    window.studyroom.command({ type: 'settings', settings: { onboarded: true, mode: 'light' } }),
  );
  await page.getByRole('button', { name: 'Sites e preferências', exact: true }).click();
  await page.getByRole('button', { name: 'Novo perfil', exact: true }).click();
  await page.getByLabel('Nome do perfil').fill('Programação');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const original = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  const id = original.profiles.find((p) => p.name === 'Programação')!.id;
  await page.getByLabel('Perfil de estudo', { exact: true }).selectOption(String(id));
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }))).settings
          .activeProfileId,
    )
    .toBe(id);
  expect((await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }))).sites).toEqual(
    [],
  );
  await page.getByLabel('Nome', { exact: true }).fill('Documentação');
  await page.getByLabel('Página inicial').fill('https://docs.example/');
  await page.getByRole('button', { name: 'Adicionar site', exact: true }).click();
  await expect(page.getByLabel('Ativar Documentação')).toBeChecked();
  await exitTestApp();
  await launch();
  await expect(page.getByLabel('Perfil de estudo', { exact: true })).toHaveValue(String(id));
  await app.evaluate(({ session }) => {
    session
      .fromPartition('persist:studyroom-web')
      .protocol.handle(
        'https',
        () => new Response('<!doctype html><title>Docs</title><h1>Documentação</h1>'),
      );
  });
  await page.getByRole('button', { name: 'Só começar por 5 minutos' }).click();
  const started = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(started.active).toMatchObject({ profileId: id, profileName: 'Programação' });
  await expect
    .poll(async () =>
      app.evaluate(({ webContents }) =>
        webContents.getAllWebContents().some((w) => w.getURL() === 'https://docs.example/'),
      ),
    )
    .toBe(true);
  for (const type of [
    'profile:select',
    'profile:remove',
    'profile:rename',
    'profile:create',
  ] as const) {
    const error = await page.evaluate(async (type) => {
      try {
        await window.studyroom.command({ type, id: 1, name: 'Mudança' });
        return '';
      } catch (e) {
        return String(e);
      }
    }, type);
    expect(error).toContain('Encerre a sessão');
  }
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir planejador' }).click();
  await page.getByRole('button', { name: 'Sites e preferências', exact: true }).click();
  await expect(page.getByLabel('Perfil de estudo', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Novo perfil', exact: true })).toBeDisabled();
  await expect(
    page.evaluate(() => window.studyroom.command({ type: 'profile:select', id: 1 })),
  ).rejects.toThrow('Encerre a sessão');
  await page.getByRole('button', { name: 'Continuar estudando' }).click();
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await page.getByLabel('Perfil de estudo', { exact: true }).selectOption('1');
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }))).settings
          .activeProfileId,
    )
    .toBe(1);
  const switched = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(switched.sites).toEqual(original.sites);
  expect(switched.browser.canBack).toBe(false);
  expect(
    await app.evaluate(({ webContents }) =>
      webContents.getAllWebContents().some((w) => w.getURL() === 'https://docs.example/'),
    ),
  ).toBe(false);
  await page.evaluate(() =>
    window.studyroom.command({ type: 'navigate', url: 'https://docs.example/' }),
  );
  expect(
    (await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }))).browser.blocked,
  ).toBe('docs.example');
  await page.getByRole('button', { name: 'Sites e preferências', exact: true }).click();
  await page.getByRole('button', { name: 'Renomear perfil Programação' }).click();
  await page.getByLabel('Nome do perfil').fill('Código');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await page.screenshot({ path: 'test-results/profiles.png' });
  await page.getByRole('button', { name: 'Excluir perfil Código' }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir perfil Código' }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const removed = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(removed.profiles).toHaveLength(1);
  expect(removed.history.some((s) => s.profileId === id && s.profileName === 'Programação')).toBe(
    true,
  );
  // Restore onboarding expected by the next scenario in this shared-data suite.
  await page.evaluate(() =>
    window.studyroom.command({ type: 'settings', settings: { onboarded: false } }),
  );
  await exitTestApp();
});

test('estatísticas mostram totais diários, semanas anteriores e dados após reinício', async () => {
  const now = Date.now();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const previous = new Date(today);
  previous.setDate(previous.getDate() - ((previous.getDay() + 6) % 7) - 6);
  previous.setHours(12);
  const start = today.getTime();
  const length = Math.min(120000, now - start);
  const db = new DatabaseSync(join(data, 'studyroom.sqlite'));
  try {
    db.exec('DELETE FROM sessions; DELETE FROM blocks;');
    for (const [at, ms, site, status] of [
      [start, length, 'qconcursos.com', 'interrupted'],
      [previous.getTime(), 25 * 60000, 'docs.example', 'completed'],
    ] as const) {
      const record = {
        id: at,
        start: at,
        end: at + ms,
        checkpoint: at + ms,
        plannedMs: 25 * 60000,
        effectiveMs: ms,
        runningSince: null,
        status,
        site,
        pauses: 1,
        reason: '',
        intervals: [{ start: at, end: at + ms }],
      };
      db.prepare('INSERT INTO sessions(id,json) VALUES(?,?)').run(at, JSON.stringify(record));
    }
    db.prepare('INSERT INTO blocks(at,domain) VALUES(?,?)').run(now, 'instagram.com');
  } finally {
    db.close();
  }
  await launch();
  await page.evaluate(() =>
    window.studyroom.command({ type: 'settings', settings: { onboarded: true } }),
  );
  await page.getByRole('button', { name: 'Estatísticas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seu ritmo de estudo' })).toBeVisible();
  await expect(page.getByTestId('weekly-effective')).toHaveText(
    `${Math.floor(length / 60000)} min`,
  );
  const state = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(state.todayMs).toBe(length);
  expect(state.statistics[0]).toMatchObject({ started: 1, interrupted: 1, blocks: 1 });
  expect(state.statistics[1]).toMatchObject({ effectiveMs: 25 * 60000, started: 1, completed: 1 });
  await expect(page.getByRole('button', { name: 'Semana mais recente' })).toBeDisabled();
  await page.getByRole('button', { name: 'Semana mais antiga' }).click();
  await expect(page.getByTestId('weekly-effective')).toHaveText('25 min');
  await expect(page.getByText('docs.example', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/statistics.png' });
  for (let i = 0; i < 6; i++)
    await page.getByRole('button', { name: 'Semana mais antiga' }).click();
  await expect(page.getByRole('button', { name: 'Semana mais antiga' })).toBeDisabled();
  await expect(
    page.getByText('Nenhum estudo registrado nesta semana.', { exact: false }),
  ).toBeVisible();
  await exitTestApp();
  await launch();
  await page.getByRole('button', { name: 'Estatísticas', exact: true }).click();
  await expect(page.getByTestId('weekly-effective')).toHaveText(
    `${Math.floor(length / 60000)} min`,
  );
  await page.evaluate(() =>
    window.studyroom.command({ type: 'settings', settings: { theme: 'light' } }),
  );
  await page.setViewportSize({ width: 850, height: 640 });
  await page.screenshot({ path: 'test-results/statistics-light.png' });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await exitTestApp();
});

test('PDF local: importação, renderização, retomada, foco, notas e remoção segura', async () => {
  const source = join(data, 'Estudos.pdf');
  await writeFile(source, pdfFixture());
  await launch();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await app.evaluate(({ dialog }, source) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
  }, source);
  await page.getByRole('button', { name: 'Importar PDF', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir PDF', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Importar PDF', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir PDF', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Abrir PDF', exact: true }).click();
  await expect(page.getByText('Página carregada', { exact: true })).toBeAttached();
  await expect(page.getByLabel('Página do PDF', { exact: true })).toHaveValue('1');
  const colored = await page.locator('canvas').evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext('2d')!;
    const bytes = context.getImageData(
      0,
      0,
      (canvas as HTMLCanvasElement).width,
      (canvas as HTMLCanvasElement).height,
    ).data;
    for (let i = 0; i < bytes.length; i += 40)
      if (bytes[i + 1] > bytes[i] + 30 && bytes[i + 3] > 0) return true;
    return false;
  });
  expect(colored).toBe(true);
  expect(await page.evaluate(() => (globalThis as any).pdfScriptRan)).toBeUndefined();
  await page.getByRole('button', { name: 'Próxima página', exact: true }).click();
  await expect(page.getByLabel('Página do PDF', { exact: true })).toHaveValue('2');
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }))).pdfs[0]?.page,
    )
    .toBe(2);
  await page.getByText('Texto da página', { exact: true }).click();
  await expect(page.getByText('PDF pagina 2 - Revisao', { exact: true })).toBeVisible();
  await page.getByLabel('Zoom do PDF').selectOption('1.25');
  await expect(page.getByText('Página carregada', { exact: true })).toBeAttached();
  await page.screenshot({ path: 'test-results/pdf-reader.png', animations: 'disabled' });
  await exitTestApp();
  await unlink(source);
  await launch();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir PDF', exact: true }).click();
  await expect(page.getByText('Página carregada', { exact: true })).toBeAttached();
  await expect(page.getByLabel('Página do PDF', { exact: true })).toHaveValue('2');
  await page.getByLabel('Tempo de estudo', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Estudar este PDF', exact: true }).click();
  const started = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(started.active).toMatchObject({
    pdfName: 'Estudos.pdf',
    site: 'PDF local',
    plannedMs: 180000,
  });
  const id = started.pdfs[0].id;
  await expect(page.getByText('Página carregada', { exact: true })).toBeAttached();
  await localKey('F11');
  await expect(
    page.getByRole('button', { name: 'Sair do modo imersivo (F11 ou Esc)', exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await viewBounds()).fullscreen).toBe(true);
  await expect(page.getByLabel('Página do PDF', { exact: true })).toHaveValue('2');
  await page.screenshot({ path: 'test-results/pdf-immersive.png' });
  await localKey('Escape');
  await expect.poll(async () => (await viewBounds()).fullscreen).toBe(false);
  await expect(
    page.evaluate((id) => window.studyroom.command({ type: 'pdf:remove', id }), id),
  ).rejects.toThrow('Encerre a sessão');
  await page.getByRole('button', { name: 'Anotações', exact: true }).click();
  await page.getByRole('button', { name: 'Nova anotação' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Nota do PDF');
  await page.getByLabel('Texto', { exact: true }).fill('Revisar material local');
  await expect(page.getByText('Salvo neste computador', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Uma pausa também faz parte.' })).toBeVisible();
  await exitTestApp();
  await launch();
  const recovered = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(recovered.active).toMatchObject({ pdfId: id, status: 'paused' });
  await page.getByRole('button', { name: 'Continuar estudando' }).click();
  await page.getByRole('button', { name: 'Retomar meu estudo' }).click();
  await expect(page.getByText('Página carregada', { exact: true })).toBeAttached();
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Só começar por 5 minutos' }).click();
  expect(
    (await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }))).active,
  ).toMatchObject({ pdfId: id, plannedMs: 300000 });
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Remover Estudos.pdf' }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Remover Estudos.pdf' }).click();
  await page.getByRole('button', { name: 'Confirmar remoção' }).click();
  await expect(page.getByRole('button', { name: 'Abrir PDF', exact: true })).toHaveCount(0);
  const removed = await page.evaluate(() => window.studyroom.command({ type: 'snapshot' }));
  expect(removed.history.some((s) => s.pdfId === id && s.pdfName === 'Estudos.pdf')).toBe(true);
  expect(removed.notes.some((n) => n.title === 'Nota do PDF')).toBe(true);
  await expect(page.evaluate(() => window.studyroom.pdfData('../secret'))).rejects.toThrow();
  await exitTestApp();
});
