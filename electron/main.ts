import { app, BrowserWindow, ipcMain, protocol, net, session, dialog } from 'electron';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { noteId, markdown } from './notes';
import { Store } from './database';
import { Planner } from './planner';
import { Pdfs } from './pdfs';
import { Sessions } from './sessions';
import { statistics, statisticsStart, dateKey } from './statistics';
import { StudyBrowser } from './browser';
import { allowed, domainOnly, HOME, parseSafeUrl } from './policy';
import type { Command, Settings, Snapshot } from '../src/shared';
protocol.registerSchemesAsPrivileged([
  { scheme: 'studyroom', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
app.enableSandbox();
const testMode = !app.isPackaged && process.argv.includes('--studyroom-test');
if (testMode && process.env.STUDYROOM_TEST_DATA)
  app.setPath('userData', process.env.STUDYROOM_TEST_DATA);
const development = !app.isPackaged && process.env.STUDYROOM_DEV_URL === 'http://127.0.0.1:5173';
const uiUrl = development ? 'http://127.0.0.1:5173/' : 'studyroom://app/index.html';
let store: Store;
let planner: Planner;
let pdfs: Pdfs;
let importingPdf = false;
let pdfOperation = false;
let sessions: Sessions;
let browser: StudyBrowser;
let window: BrowserWindow;
let timer: NodeJS.Timeout;
let closing = false;
let switchingProfile = false;
let focusOnScreen = false;
let immersive = false;
function setImmersive(enabled: boolean) {
  immersive = enabled && focusOnScreen && !!sessions.active;
  window.setFullScreen(immersive);
  publish();
}
function focusShortcut(input: Electron.Input): boolean {
  if (input.control || input.alt || input.meta || input.shift) return false;
  if (
    (input.key === 'F11' && focusOnScreen && sessions.active) ||
    (input.key === 'Escape' && immersive)
  ) {
    if (input.type === 'keyDown' && !input.isAutoRepeat)
      setImmersive(input.key === 'F11' ? !immersive : false);
    return true;
  }
  return false;
}
function snapshot(): Snapshot {
  const now = Date.now();
  const history = store.sessions();
  const since = statisticsStart(now);
  const stats = statistics(
    store.statisticsSessions(since),
    store.recentBlocks(since),
    now,
    sessions.active,
  );
  const todayMs = stats[0].days.find((d) => d.date === dateKey(now))!.effectiveMs;
  return {
    immersive,
    pdfs: pdfs.list(),
    statistics: stats,
    profiles: store.profiles(),
    subjects: planner.subjects(),
    topics: planner.topics(),
    notes: store.notes(),
    settings: store.settings(),
    sites: store.sites(),
    active: sessions.active,
    history: history.slice(0, 30),
    todayMs,
    browser: browser.state,
    recovered: sessions.recovered,
    now,
    exitReadyAt: sessions.exitReadyAt,
  };
}
function publish() {
  if (window && !window.isDestroyed() && browser)
    window.webContents.send('studyroom:state', snapshot());
}
function text(value: unknown, max = 2048): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Texto inválido.');
  return value;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    throw new Error('Número inválido.');
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Opção inválida.');
  return value;
}
function settingsUpdate(input: Partial<Settings>) {
  if (!input || typeof input !== 'object') throw new Error('Configuração inválida.');
  const s = store.settings();
  for (const [key, value] of Object.entries(input)) {
    if (key === 'theme') {
      if (value !== 'light' && value !== 'dark') throw new Error('Tema inválido.');
      s.theme = value;
    } else {
      sessions.assertEditable();
      if (key === 'mode') {
        if (value !== 'light' && value !== 'strong') throw new Error('Modo inválido.');
        s.mode = value;
      } else if (key === 'reflectionSeconds') s.reflectionSeconds = integer(value, 5, 60);
      else if (key === 'dailyGoal') s.dailyGoal = integer(value, 5, 480);
      else if (key === 'onboarded') s.onboarded = boolean(value);
      else throw new Error('Configuração não autorizada.');
    }
  }
  store.saveSettings(s);
}
async function command(c: Command) {
  if (!c || typeof c !== 'object' || typeof c.type !== 'string')
    throw new Error('Operação inválida.');
  if (switchingProfile && c.type !== 'snapshot' && c.type !== 'view')
    throw new Error('Aguarde a troca de perfil.');
  if (pdfOperation && !['snapshot', 'view', 'pdf:progress'].includes(c.type))
    throw new Error('Aguarde a operação com o PDF.');
  switch (c.type) {
    case 'pdf:import': {
      if (importingPdf) throw new Error('Aguarde a importação atual.');
      importingPdf = true;
      try {
        const choice = await dialog.showOpenDialog(window, {
          title: 'Importar PDF local',
          properties: ['openFile'],
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
        if (!choice.canceled && choice.filePaths[0]) await pdfs.import(choice.filePaths[0]);
      } finally {
        importingPdf = false;
      }
      break;
    }
    case 'pdf:remove': {
      if (sessions.active?.pdfId === c.id)
        throw new Error('Encerre a sessão deste PDF antes de removê-lo.');
      pdfOperation = true;
      try {
        await pdfs.remove(c.id);
        store.db.prepare('UPDATE profiles SET lastPdfId=NULL WHERE lastPdfId=?').run(c.id);
        if (store.settings().lastPdfId === c.id)
          store.saveSettings({ ...store.settings(), lastPdfId: null });
      } finally {
        pdfOperation = false;
      }
      break;
    }
    case 'pdf:progress':
      pdfs.progress(c.id, c.page, c.pageCount);
      break;
    case 'pdf:start': {
      pdfOperation = true;
      try {
        const pdf = pdfs.get(c.id);
        await pdfs.data(c.id);
        sessions.start(integer(c.minutes, 1, 480), 'PDF local', {
          pdfId: pdf.id,
          pdfName: pdf.name,
        });
        store.saveSettings({ ...store.settings(), lastPdfId: pdf.id, lastTopicId: null });
      } finally {
        pdfOperation = false;
      }
      break;
    }
    case 'profile:create':
    case 'profile:rename':
    case 'profile:remove':
    case 'profile:select': {
      if (sessions.active) throw new Error('Encerre a sessão atual antes de alterar os perfis.');
      if (c.type === 'profile:create') store.createProfile(text(c.name, 80));
      else {
        const id = integer(c.id, 1, Number.MAX_SAFE_INTEGER);
        if (c.type === 'profile:rename') store.renameProfile(id, text(c.name, 80));
        else if (c.type === 'profile:remove') store.removeProfile(id);
        else {
          // Destroy the previous page before activating a different policy. Cookies remain shared.
          if (!store.profiles().some((p) => p.id === id)) throw new Error('Perfil não encontrado.');
          switchingProfile = true;
          try {
            await browser.resetProfile();
            store.selectProfile(id);
          } finally {
            switchingProfile = false;
          }
        }
      }
      break;
    }
    case 'subject:save':
      planner.saveSubject(c.subject);
      break;
    case 'subject:remove':
      planner.removeSubject(c.id);
      break;
    case 'topic:save':
      planner.saveTopic(c.topic);
      break;
    case 'topic:remove':
      planner.removeTopic(c.id);
      break;
    case 'topic:start':
      browser.navigate(planner.start(c.id, sessions));
      store.saveSettings({ ...store.settings(), lastPdfId: null });
      break;
    case 'snapshot':
      break;
    case 'note:save':
      store.saveNote(c.note);
      break;
    case 'note:remove':
      store.removeNote(c.id);
      break;
    case 'note:export': {
      const id = noteId(c.id);
      const note = store.notes().find((n) => n.id === id);
      if (!note) throw new Error('Anotação não encontrada.');
      const result = await dialog.showSaveDialog(window, {
        title: 'Exportar anotação',
        defaultPath: 'anotacao-studyroom.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!result.canceled && result.filePath)
        await writeFile(result.filePath, markdown(note), 'utf8');
      break;
    }
    case 'settings':
      settingsUpdate(c.settings);
      break;
    case 'site:add': {
      sessions.assertEditable();
      const u = parseSafeUrl(text(c.url));
      if (!u)
        throw new Error('Use um endereço HTTPS válido, sem credenciais e sem porta alternativa.');
      const name = text(c.name, 80).trim();
      if (!name) throw new Error('Informe um nome.');
      store.addSite(name, u.href, boolean(c.subdomains));
      break;
    }
    case 'site:toggle':
      sessions.assertEditable();
      store.toggleSite(integer(c.id, 1, Number.MAX_SAFE_INTEGER));
      break;
    case 'site:remove':
      sessions.assertEditable();
      store.removeSite(integer(c.id, 1, Number.MAX_SAFE_INTEGER));
      break;
    case 'start': {
      const minutes = integer(c.minutes, 1, 480);
      const lastPdf = store.settings().lastPdfId;
      if (!c.url && lastPdf && pdfs.list().some((p) => p.id === lastPdf)) {
        await command({ type: 'pdf:start', id: lastPdf, minutes });
        break;
      }
      const lastTopic = store.settings().lastTopicId;
      if (!c.url && lastTopic && planner.topics().some((t) => t.id === lastTopic)) {
        browser.navigate(planner.start(lastTopic, sessions, minutes));
        break;
      }
      const url = c.url ? text(c.url) : store.settings().lastUrl;
      const destination = allowed(url, store.sites())
        ? url
        : store.sites().find((s) => s.enabled)?.url;
      if (!destination) throw new Error('Cadastre ou ative um site antes de começar.');
      sessions.start(minutes, domainOnly(destination));
      store.saveSettings({ ...store.settings(), lastTopicId: null, lastPdfId: null });
      browser.navigate(destination);
      break;
    }
    case 'pause':
      sessions.pause();
      break;
    case 'resume':
      sessions.resume();
      break;
    case 'extend':
      sessions.extend(integer(c.minutes, 1, 480));
      break;
    case 'exit:request':
      sessions.requestExit();
      break;
    case 'exit:cancel':
      sessions.cancelExit();
      break;
    case 'exit:confirm':
      sessions.finish(text(c.reason, 300));
      if (immersive) setImmersive(false);
      break;
    case 'focus:presence':
      focusOnScreen = boolean(c.visible);
      if (!focusOnScreen && immersive) setImmersive(false);
      break;
    case 'immersive:toggle':
      if (!focusOnScreen || !sessions.active)
        throw new Error('Abra uma sessão de estudo primeiro.');
      setImmersive(!immersive);
      break;
    case 'navigate':
      browser.navigate(text(c.url));
      break;
    case 'browser':
      if (!['back', 'forward', 'reload', 'home', 'return', 'zoomIn', 'zoomOut'].includes(c.action))
        throw new Error('Ação inválida.');
      browser.action(c.action);
      break;
    case 'view': {
      const b = c.bounds;
      if (!b || typeof b !== 'object') throw new Error('Área inválida.');
      browser.setView(boolean(c.visible), {
        x: integer(b.x, 0, 20000),
        y: integer(b.y, 0, 20000),
        width: integer(b.width, 0, 20000),
        height: integer(b.height, 0, 20000),
      });
      break;
    }
    default:
      throw new Error('Operação não autorizada.');
  }
  publish();
  return snapshot();
}
async function init() {
  const data = app.getPath('userData');
  mkdirSync(data, { recursive: true });
  store = new Store(join(data, 'studyroom.sqlite'));
  planner = new Planner(store);
  pdfs = new Pdfs(store, join(data, 'pdfs'));
  sessions = new Sessions(store);
  const root = resolve(__dirname, '../dist');
  protocol.handle('studyroom', (request) => {
    const u = new URL(request.url);
    if (u.hostname !== 'app') return new Response('', { status: 403 });
    const file = resolve(root, '.' + decodeURIComponent(u.pathname));
    if (!file.startsWith(root + sep)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  window = new BrowserWindow({
    title: 'StudyRoom',
    width: 1280,
    height: 850,
    minWidth: 850,
    minHeight: 640,
    backgroundColor: '#f6f7f4',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });
  window.removeMenu();
  window.webContents.on('before-input-event', (event, input) => {
    if (focusShortcut(input)) event.preventDefault();
  });
  window.on('leave-full-screen', () => {
    immersive = false;
    publish();
  });
  window.on('enter-full-screen', () => {
    if (!immersive || !focusOnScreen || !sessions.active) window.setFullScreen(false);
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== uiUrl) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  let fixture: string | undefined;
  if (testMode && process.env.STUDYROOM_TEST_ORIGIN) {
    const u = new URL(process.env.STUDYROOM_TEST_ORIGIN);
    if (u.protocol === 'http:' && u.hostname === '127.0.0.1') fixture = u.origin;
  }
  browser = new StudyBrowser(
    window,
    session.fromPartition('persist:studyroom-web'),
    () => store.sites(),
    publish,
    (domain) => store.block(domain, sessions.active?.id),
    (url) => {
      // Avoid storing query strings or fragments, which may contain credentials.
      const u = new URL(url);
      if (/login|signin|oauth|callback|auth|password|token/i.test(u.pathname)) return;
      u.search = '';
      u.hash = '';
      store.saveSettings({ ...store.settings(), lastUrl: u.href });
    },
    focusShortcut,
    fixture,
  );
  ipcMain.handle('studyroom:pdf-data', async (event, id: string) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== uiUrl
    )
      throw new Error('Origem não autorizada.');
    return new Uint8Array(await pdfs.data(id));
  });
  ipcMain.handle('studyroom:command', async (event, c: Command) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== uiUrl
    )
      throw new Error('Origem não autorizada.');
    try {
      return await command(c);
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Não foi possível concluir a operação.',
      );
    }
  });
  window.on('close', (event) => {
    if (!closing && sessions.locked() && store.settings().mode === 'strong') {
      event.preventDefault();
      sessions.requestExit();
      browser.wanted = false;
      browser.layout();
      publish();
      return;
    }
    closing = true;
    if (sessions.active) {
      sessions.tick();
      sessions.pause();
    }
  });
  window.on('closed', () => {
    clearInterval(timer);
    browser.destroy();
    store.close();
  });
  await window.loadURL(uiUrl);
  timer = setInterval(() => {
    sessions.tick();
    browser.tick();
    publish();
  }, 1000);
}
if (!app.requestSingleInstanceLock() && !testMode) app.quit();
else {
  app.on('second-instance', () => {
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(init)
    .catch((error) => {
      dialog.showErrorBox(
        'StudyRoom não pôde iniciar',
        error instanceof Error ? error.message : 'Erro desconhecido.',
      );
      app.quit();
    });
  app.on('window-all-closed', () => app.quit());
}
