import { it, expect } from 'vitest';
import { Store } from '../electron/database';
import { Sessions } from '../electron/sessions';
import { allowed } from '../electron/policy';

it('isola permissões, IDs e retomada entre perfis e preserva o histórico ao excluir', () => {
  const store = new Store(':memory:');
  try {
    const original = store.sites()[0];
    store.saveSettings({
      ...store.settings(),
      onboarded: true,
      mode: 'light',
      lastUrl: 'https://qconcursos.com/questoes',
      lastTopicId: 'topic-original',
      lastPdfId: 'pdf-original',
    });
    store.createProfile('Programação');
    const id = store.profiles()[1].id;
    store.selectProfile(id);
    expect(store.sites()).toEqual([]);
    expect(store.settings().lastTopicId).toBeNull();
    expect(allowed(original.url, store.sites())).toBe(false);
    store.addSite('Docs', 'https://docs.example/', false);
    store.addSite('Q', original.url, false); // same URL can belong to different profiles
    store.toggleSite(original.id);
    store.removeSite(original.id); // foreign profile's IDs cannot be modified
    const sessions = new Sessions(store, () => 123456);
    sessions.start(5, 'docs.example');
    sessions.finish('');
    store.saveSettings({
      ...store.settings(),
      lastUrl: 'https://docs.example/guide',
      lastTopicId: 'topic-docs',
      lastPdfId: 'pdf-docs',
    });
    store.selectProfile(1);
    expect(store.sites()).toEqual([original]);
    expect(store.settings()).toMatchObject({
      lastUrl: 'https://qconcursos.com/questoes',
      lastTopicId: 'topic-original',
      lastPdfId: 'pdf-original',
    });
    store.selectProfile(id);
    expect(store.settings()).toMatchObject({
      lastUrl: 'https://docs.example/guide',
      lastTopicId: 'topic-docs',
      lastPdfId: 'pdf-docs',
    });
    expect(() => store.removeProfile(id)).toThrow('Selecione outro');
    store.renameProfile(id, 'Código');
    store.selectProfile(1);
    store.removeProfile(id);
    expect(store.db.prepare('SELECT count(*) AS n FROM sites WHERE profileId=?').get(id)!.n).toBe(
      0,
    );
    expect(store.sessions()[0]).toMatchObject({ profileId: id, profileName: 'Programação' });
    expect(() => store.selectProfile(id)).toThrow('não encontrado');
    expect(() => store.createProfile('  ')).toThrow();
    expect(() => store.renameProfile(1, 'x'.repeat(81))).toThrow();
    expect(() => store.createProfile('nome\0')).toThrow();
  } finally {
    store.close();
  }
});
