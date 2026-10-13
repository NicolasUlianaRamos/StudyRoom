import { it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../electron/database';
import { validateNote, markdown } from '../electron/notes';
const id = '00000000-0000-4000-8000-000000000001';
const note = {
  id,
  title: 'Scrum',
  body: 'Revisar **papéis**',
  subject: 'Engenharia',
  kind: 'note' as const,
};
it.each([1, 2, 3, 4, 5])(
  'migra banco v%i sem apagar configurações ou notas existentes',
  (version) => {
    const dir = mkdtempSync(join(tmpdir(), 'studyroom-notes-'));
    let store: Store | undefined;
    try {
      const path = join(dir, 'notes.sqlite');
      const old = new DatabaseSync(path);
      old.exec(`CREATE TABLE settings(id INTEGER PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE sites(id INTEGER PRIMARY KEY, name TEXT, url TEXT, enabled INTEGER, subdomains INTEGER);
      CREATE TABLE sessions(id INTEGER PRIMARY KEY, json TEXT);
      CREATE TABLE blocks(id INTEGER PRIMARY KEY, session_id INTEGER, at INTEGER, domain TEXT);
      INSERT INTO settings VALUES(1,'{"theme":"dark","onboarded":true}');
      PRAGMA user_version=1;`);
      old.exec("INSERT INTO sites VALUES(7,'Material','https://material.example/',0,1)");
      if (version >= 2) {
        old.exec(
          'CREATE TABLE notes(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,subject TEXT NOT NULL,kind TEXT NOT NULL,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL); PRAGMA user_version=2;',
        );
        old
          .prepare('INSERT INTO notes VALUES(?,?,?,?,?,?,?)')
          .run(id, note.title, note.body, note.subject, note.kind, 1, 2);
      }
      if (version >= 3)
        old.exec(`CREATE TABLE subjects(id TEXT PRIMARY KEY,name TEXT NOT NULL);
      CREATE TABLE topics(id TEXT PRIMARY KEY,subjectId TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,name TEXT NOT NULL,priority INTEGER NOT NULL,minutes INTEGER NOT NULL,reviewOn TEXT NOT NULL,url TEXT NOT NULL,lastStudied INTEGER);
      ALTER TABLE notes ADD COLUMN subjectId TEXT REFERENCES subjects(id) ON DELETE SET NULL;
      PRAGMA user_version=3;`);
      if (version >= 4)
        old.exec(`BEGIN;
      CREATE TABLE profiles(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, lastUrl TEXT NOT NULL DEFAULT '', lastTopicId TEXT);
      INSERT INTO profiles(id,name) VALUES(1,'Padrão');
      CREATE TABLE profile_sites(id INTEGER PRIMARY KEY AUTOINCREMENT, profileId INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name TEXT NOT NULL, url TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, subdomains INTEGER NOT NULL DEFAULT 0, UNIQUE(profileId,url));
      INSERT INTO profile_sites(id,profileId,name,url,enabled,subdomains) SELECT id,1,name,url,enabled,subdomains FROM sites;
      DROP TABLE sites; ALTER TABLE profile_sites RENAME TO sites; PRAGMA user_version=4; COMMIT;`);
      if (version === 5) old.exec('PRAGMA user_version=5;');
      old.close();
      store = new Store(path);
      expect(store.settings().theme).toBe('dark');
      expect(store.profiles()).toEqual([{ id: 1, name: 'Padrão' }]);
      expect(store.sites()).toEqual([
        {
          id: 7,
          name: 'Material',
          url: 'https://material.example/',
          enabled: false,
          subdomains: true,
        },
      ]);
      if (version === 1) expect(store.notes()).toEqual([]);
      else expect(store.notes()[0]).toMatchObject({ ...note, subjectId: null });
      store.saveNote(note);
      const created = store.notes()[0].createdAt;
      store.saveNote({ ...note, body: 'Conteúdo atualizado', kind: 'later' });
      store.close();
      store = new Store(path);
      expect(store.notes()).toHaveLength(1);
      expect(store.notes()[0]).toMatchObject({
        body: 'Conteúdo atualizado',
        kind: 'later',
        createdAt: created,
      });
      expect(store.db.prepare('PRAGMA user_version').get()!.user_version).toBe(6);
      store.removeNote(id);
      expect(store.notes()).toEqual([]);
    } finally {
      store?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
it('valida todo o conteúdo no processo principal e limita tamanho', () => {
  expect(validateNote(note)).toEqual(note);
  for (const invalid of [
    { ...note, id: '../arquivo' },
    { ...note, title: 1 },
    { ...note, body: 'x'.repeat(100001) },
    { ...note, subject: 'x'.repeat(101) },
    { ...note, kind: 'html' },
    { ...note, body: 'a\0b' },
    null,
  ])
    expect(() => validateNote(invalid as never)).toThrow();
});
it('exporta Markdown e preserva texto, acentos e quebras de linha', () => {
  expect(markdown({ ...note, createdAt: 1, updatedAt: 2 })).toBe(
    '# Scrum\n\nMatéria: Engenharia\n\nRevisar **papéis**\n',
  );
  expect(
    markdown({ ...note, title: '', subject: '', kind: 'later', createdAt: 1, updatedAt: 2 }),
  ).toContain('# Ver depois\n\n');
});
