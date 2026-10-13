import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../electron/database';
import { Sessions, effective } from '../electron/sessions';
const stores: Store[] = [];
const dirs: string[] = [];
function create() {
  const dir = mkdtempSync(join(tmpdir(), 'studyroom-'));
  dirs.push(dir);
  const path = join(dir, 'test.sqlite');
  const store = new Store(path);
  stores.push(store);
  return { store, path };
}
afterEach(() => {
  for (const s of stores.splice(0)) {
    try {
      s.close();
    } catch {}
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
describe('persistência', () => {
  it('persiste sites e configurações após reinício', () => {
    const { store, path } = create();
    store.addSite('MDN', 'https://developer.mozilla.org/', false);
    store.saveSettings({ ...store.settings(), theme: 'dark', onboarded: true });
    store.close();
    const reopened = new Store(path);
    stores.push(reopened);
    expect(reopened.settings().theme).toBe('dark');
    expect(reopened.sites().some((s) => s.name === 'MDN')).toBe(true);
    const id = reopened.sites()[1].id;
    reopened.toggleSite(id);
    expect(reopened.sites()[1].enabled).toBe(false);
    reopened.removeSite(id);
    expect(reopened.sites()).toHaveLength(1);
  });
  it('aplica migration uma única vez', () => {
    const { store, path } = create();
    store.close();
    const reopened = new Store(path);
    stores.push(reopened);
    expect(reopened.sites()).toHaveLength(1);
    expect(reopened.db.prepare('PRAGMA user_version').get()!.user_version).toBe(6);
  });
});
describe('sessões', () => {
  it('inicia, pausa, retoma e encerra sem contar pausa', () => {
    const { store } = create();
    store.saveSettings({ ...store.settings(), mode: 'light' });
    let now = 1000;
    const s = new Sessions(store, () => now);
    s.start(25, 'qconcursos.com');
    now += 30000;
    s.pause();
    now += 120000;
    expect(effective(s.active!, now)).toBe(30000);
    s.resume();
    now += 10000;
    s.finish('');
    expect(store.sessions()[0].effectiveMs).toBe(40000);
    expect(s.active).toBe(null);
  });
  it('usa timestamps ao minimizar/suspender e limita ao alvo', () => {
    const { store } = create();
    let now = 1000;
    const s = new Sessions(store, () => now);
    s.start(5, 'qconcursos.com');
    now += 600000;
    s.tick();
    expect(s.active!.effectiveMs).toBe(300000);
    expect(s.active!.status).toBe('completed');
    s.extend(25);
    expect(s.active!.status).toBe('running');
    expect(s.active!.plannedMs).toBe(1800000);
  });
  it('protege allowlist e exige reflexão e motivo no modo forte', () => {
    const { store } = create();
    let now = 1000;
    const s = new Sessions(store, () => now);
    s.start(25, 'qconcursos.com');
    expect(() => s.assertEditable()).toThrow();
    expect(() => s.finish('preciso sair')).toThrow();
    s.requestExit();
    expect(() => s.finish('preciso sair')).toThrow();
    now += 11000;
    expect(() => s.finish('')).toThrow();
    s.finish('compromisso');
    expect(() => s.assertEditable()).not.toThrow();
  });
  it('pedido repetido não reinicia reflexão e cancelamento revoga saída', () => {
    const { store } = create();
    let now = 1000;
    const s = new Sessions(store, () => now);
    s.start(25, 'qconcursos.com');
    expect(s.requestExit()).toBe(11000);
    now += 5000;
    expect(s.requestExit()).toBe(11000);
    s.cancelExit();
    now += 10000;
    expect(() => s.finish('sair')).toThrow();
  });
  it('recupera encerramento inesperado em pausa até último checkpoint', () => {
    const { store, path } = create();
    let now = 1000;
    const s = new Sessions(store, () => now);
    s.start(25, 'qconcursos.com');
    now += 17000;
    s.tick();
    store.close();
    now += 3600000;
    const reopened = new Store(path);
    stores.push(reopened);
    const recovered = new Sessions(reopened, () => now);
    expect(recovered.recovered).toBe(true);
    expect(recovered.active!.status).toBe('paused');
    expect(effective(recovered.active!, now)).toBe(17000);
  });
  it('não permite duas sessões nem durações inválidas', () => {
    const { store } = create();
    const s = new Sessions(store);
    expect(() => s.start(0, 'test')).toThrow();
    s.start(5, 'test');
    expect(() => s.start(5, 'test')).toThrow();
  });
  it('ignora retrocesso do relógio no tempo efetivo', () => {
    const { store } = create();
    let now = 1000;
    const s = new Sessions(store, () => now);
    s.start(5, 'test');
    now = 500;
    expect(effective(s.active!, now)).toBe(0);
  });
});
