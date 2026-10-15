import { WebContentsView, type BrowserWindow, type Session } from 'electron';
import type { BrowserState, Site } from '../src/shared';
import { allowed, domainOnly, frameAllowed, HOME, trustedAuth, authEntry } from './policy';
export class StudyBrowser {
  view: WebContentsView;
  wanted = false;
  private resetting = false;
  state: BrowserState = {
    domain: '',
    loading: false,
    error: '',
    blocked: '',
    canBack: false,
    canForward: false,
    zoom: 1,
    authUntil: 0,
  };
  private bounds = { x: 0, y: 130, width: 900, height: 500 };
  constructor(
    private window: BrowserWindow,
    partition: Session,
    private sites: () => Site[],
    private changed: () => void,
    private onBlocked: (domain: string) => void,
    private remember: (url: string) => void,
    private shortcut: (input: Electron.Input) => boolean,
    private fixtureOrigin?: string,
  ) {
    this.view = new WebContentsView({
      webPreferences: {
        session: partition,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        webviewTag: false,
        devTools: !window.isDestroyed() && !!fixtureOrigin,
      },
    });
    window.contentView.addChildView(this.view);
    this.view.setVisible(false);
    partition.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    partition.setPermissionCheckHandler(() => false);
    partition.setDevicePermissionHandler(() => false);
    partition.setDisplayMediaRequestHandler((_request, callback) => callback({}));
    partition.on('will-download', (event) => {
      event.preventDefault();
      this.state.error =
        'Downloads estão desativados nesta versão. Salve o material fora da sessão de estudo.';
      this.refresh();
    });
    partition.webRequest.onBeforeRequest((details, callback) => {
      if (details.resourceType === 'mainFrame') {
        const ok = (this.resetting && details.url === 'about:blank') || this.permitted(details.url);
        callback({ cancel: !ok });
        if (!ok) this.block(details.url);
      } else if (details.resourceType === 'subFrame') {
        callback({ cancel: !this.framePermitted(details.url) });
      } else callback({});
    });
    const wc = this.view.webContents;
    wc.on('will-navigate', (event, url) => {
      if (!this.navigationPermitted(url)) {
        event.preventDefault();
        this.block(url);
      }
    });
    wc.on('will-frame-navigate', (event) => {
      if (
        !(event.isMainFrame ? this.navigationPermitted(event.url) : this.framePermitted(event.url))
      ) {
        event.preventDefault();
        if (event.isMainFrame) this.block(event.url);
      }
    });
    wc.on('will-redirect', (event, url, _inPlace, isMainFrame) => {
      if (!(isMainFrame ? this.navigationPermitted(url) : this.framePermitted(url))) {
        event.preventDefault();
        if (isMainFrame) this.block(url);
      }
    });
    wc.setWindowOpenHandler(({ url }) => {
      if (this.navigationPermitted(url)) setImmediate(() => this.navigate(url));
      else this.block(url);
      return { action: 'deny' };
    });
    wc.on('will-attach-webview', (event) => event.preventDefault());
    wc.on('did-start-loading', () => {
      this.state.loading = true;
      this.refresh();
    });
    wc.on('did-stop-loading', () => {
      this.state.loading = false;
      this.refresh();
    });
    const navigated = () => {
      const url = wc.getURL();
      this.state.domain = domainOnly(url);
      if (this.studyPage(url)) {
        this.state.authUntil = 0;
        this.remember(url);
      }
      this.refresh();
    };
    wc.on('did-navigate', navigated);
    wc.on('did-navigate-in-page', navigated);
    wc.on('did-fail-load', (_event, code, _desc, _url, main) => {
      if (main && code !== -3 && !this.state.blocked) {
        this.state.error =
          'Não foi possível carregar a página. Verifique a conexão e tente novamente. Se o login for recusado pelo provedor, use as opções oferecidas pelo próprio site.';
        this.refresh();
      }
    });
    wc.on('render-process-gone', () => {
      this.state.error = 'A página precisou ser interrompida. Recarregue para continuar.';
      this.refresh();
    });
    wc.on('before-input-event', (event, input) => {
      if (this.shortcut(input)) {
        event.preventDefault();
        return;
      }
      if (
        input.key === 'F11' ||
        input.key === 'F12' ||
        (input.control && input.shift && ['I', 'J', 'C'].includes(input.key.toUpperCase()))
      )
        event.preventDefault();
    });
    window.on('resize', () => this.layout());
  }
  private navigationPermitted(url: string) {
    const source = this.view.webContents.getURL();
    // Autoriza apenas navegação principal iniciada pelo site de estudos atual.
    // Não renova o prazo quando o usuário já está no provedor de login.
    if (this.studyPage(source) && authEntry(url)) {
      if (this.state.authUntil <= Date.now()) this.state.authUntil = Date.now() + 5 * 60000;
    }
    return this.permitted(url);
  }
  private studyPage(url: string) {
    if (this.fixtureOrigin) {
      try {
        if (new URL(url).origin === this.fixtureOrigin) return true;
      } catch {
        /* deny */
      }
    }
    return allowed(url, this.sites());
  }
  permitted(url: string) {
    return this.studyPage(url) || trustedAuth(url, this.state.authUntil);
  }
  private framePermitted(url: string) {
    return this.permitted(url) || frameAllowed(url, this.sites(), this.state.authUntil);
  }
  block(url: string) {
    const domain = domainOnly(url);
    if (this.state.blocked !== domain) this.onBlocked(domain);
    this.state.blocked = domain;
    this.refresh();
  }
  private refresh() {
    const wc = this.view.webContents;
    if (wc.isDestroyed()) return;
    this.state.canBack = wc.navigationHistory.canGoBack();
    this.state.canForward = wc.navigationHistory.canGoForward();
    this.layout();
    this.changed();
  }
  layout() {
    if (this.window.isDestroyed()) return;
    const [w, h] = this.window.getContentSize();
    const b = this.bounds;
    const x = Math.min(Math.max(0, b.x), w);
    const y = Math.min(Math.max(0, b.y), h);
    this.view.setBounds({
      x,
      y,
      width: Math.max(0, Math.min(b.width, w - x)),
      height: Math.max(0, Math.min(b.height, h - y)),
    });
    this.view.setVisible(this.wanted && !this.state.blocked && !this.state.error);
  }
  setView(visible: boolean, bounds: typeof this.bounds) {
    this.wanted = visible;
    this.bounds = bounds;
    this.layout();
  }
  navigate(url: string) {
    if (!this.permitted(url)) {
      this.block(url);
      return;
    }
    this.state.blocked = '';
    this.state.error = '';
    void this.view.webContents.loadURL(url).catch(() => {});
    this.refresh();
  }
  async resetProfile() {
    const wc = this.view.webContents;
    this.wanted = false;
    this.view.setVisible(false);
    wc.stop();
    this.state.authUntil = 0;
    this.resetting = true;
    try {
      await wc.loadURL('about:blank');
      wc.navigationHistory.clear();
      this.state.domain = '';
      this.state.blocked = '';
      this.state.error = '';
    } finally {
      this.resetting = false;
      this.refresh();
    }
  }
  private home() {
    return this.sites().find((s) => s.enabled)?.url ?? HOME;
  }
  action(action: string) {
    const wc = this.view.webContents;
    this.state.error = '';
    if (action === 'return') {
      this.state.blocked = '';
      if (!this.permitted(wc.getURL())) this.navigate(this.home());
    } else if (action === 'home') this.navigate(this.home());
    else if (action === 'reload') {
      this.state.blocked = '';
      if (this.permitted(wc.getURL())) wc.reload();
      else this.navigate(this.home());
    } else if (action === 'back' && wc.navigationHistory.canGoBack()) {
      this.state.blocked = '';
      wc.navigationHistory.goBack();
    } else if (action === 'forward' && wc.navigationHistory.canGoForward()) {
      this.state.blocked = '';
      wc.navigationHistory.goForward();
    } else if (action === 'zoomIn' || action === 'zoomOut') {
      this.state.zoom = Math.min(
        2,
        Math.max(0.5, this.state.zoom + (action === 'zoomIn' ? 0.1 : -0.1)),
      );
      wc.setZoomFactor(this.state.zoom);
    }
    this.refresh();
  }
  tick() {
    if (this.state.authUntil && Date.now() >= this.state.authUntil) {
      this.state.authUntil = 0;
      if (!this.permitted(this.view.webContents.getURL())) {
        this.view.webContents.stop();
        this.navigate(this.home());
      }
    }
  }
  destroy() {
    if (!this.view.webContents.isDestroyed()) this.view.webContents.close();
  }
}
