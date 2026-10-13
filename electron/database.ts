import { DatabaseSync } from 'node:sqlite';
import { validateNote, noteId } from './notes';
import type { Note, NoteDraft, Settings, Site, StudySession } from '../src/shared';
import { HOME } from './policy';
export const defaults: Settings = {
  activeProfileId: 1,
  theme: 'light',
  mode: 'strong',
  reflectionSeconds: 10,
  dailyGoal: 60,
  onboarded: false,
  lastUrl: HOME,
};
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const version = Number(
      (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    );
    if (version > 6) throw new Error('Banco criado por uma versão mais recente do StudyRoom.');
    if (version < 1)
      this.db
        .exec(`BEGIN; CREATE TABLE settings(id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);
   CREATE TABLE sites(id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1, subdomains INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE sessions(id INTEGER PRIMARY KEY, json TEXT NOT NULL);
   CREATE TABLE blocks(id INTEGER PRIMARY KEY, session_id INTEGER, at INTEGER NOT NULL, domain TEXT NOT NULL);
   PRAGMA user_version=1; COMMIT;`);
    if (version < 2)
      this.db.exec(
        "BEGIN; CREATE TABLE notes(id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, subject TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('note','later')), createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL); PRAGMA user_version=2; COMMIT;",
      );
    if (version < 3)
      this.db.exec(`BEGIN;
      CREATE TABLE subjects(id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE topics(id TEXT PRIMARY KEY, subjectId TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, name TEXT NOT NULL, priority INTEGER NOT NULL, minutes INTEGER NOT NULL, reviewOn TEXT NOT NULL, url TEXT NOT NULL, lastStudied INTEGER);
      ALTER TABLE notes ADD COLUMN subjectId TEXT REFERENCES subjects(id) ON DELETE SET NULL;
      PRAGMA user_version=3; COMMIT;`);
    if (version < 4)
      this.db.exec(`BEGIN;
      CREATE TABLE profiles(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, lastUrl TEXT NOT NULL DEFAULT '', lastTopicId TEXT);
      INSERT INTO profiles(id,name) VALUES(1,'Padrão');
      CREATE TABLE profile_sites(id INTEGER PRIMARY KEY AUTOINCREMENT, profileId INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name TEXT NOT NULL, url TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, subdomains INTEGER NOT NULL DEFAULT 0, UNIQUE(profileId,url));
      INSERT INTO profile_sites(id,profileId,name,url,enabled,subdomains) SELECT id,1,name,url,enabled,subdomains FROM sites;
      DROP TABLE sites;
      ALTER TABLE profile_sites RENAME TO sites;
      PRAGMA user_version=4; COMMIT;`);
    // Version 5 adds run intervals to session JSON. Older apps must not edit these records.
    if (version < 5) this.db.exec('BEGIN; PRAGMA user_version=5; COMMIT;');
    if (version < 6)
      this.db.exec(`BEGIN;
      ALTER TABLE profiles ADD COLUMN lastPdfId TEXT;
      CREATE TABLE pdfs(id TEXT PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, bytes INTEGER NOT NULL, importedAt INTEGER NOT NULL, page INTEGER NOT NULL DEFAULT 1, pageCount INTEGER NOT NULL DEFAULT 0);
      PRAGMA user_version=6; COMMIT;`);
    this.db.prepare('INSERT OR IGNORE INTO settings VALUES(1,?)').run(JSON.stringify(defaults));
    if (!this.db.prepare('SELECT 1 FROM sites LIMIT 1').get() && !this.settings().onboarded)
      this.db
        .prepare('INSERT INTO sites(profileId,name,url,subdomains) VALUES(1,?,?,1)')
        .run('QConcursos', 'https://qconcursos.com/');
  }
  settings(): Settings {
    return {
      ...defaults,
      ...JSON.parse(String(this.db.prepare('SELECT json FROM settings WHERE id=1').get()!.json)),
    };
  }
  saveSettings(s: Settings) {
    this.db.prepare('UPDATE settings SET json=? WHERE id=1').run(JSON.stringify(s));
  }
  sites(): Site[] {
    return this.db
      .prepare('SELECT * FROM sites WHERE profileId=? ORDER BY id')
      .all(this.settings().activeProfileId)
      .map((r) => ({
        id: Number(r.id),
        name: String(r.name),
        url: String(r.url),
        enabled: !!r.enabled,
        subdomains: !!r.subdomains,
      }));
  }
  addSite(name: string, url: string, subdomains: boolean) {
    this.db
      .prepare('INSERT INTO sites(profileId,name,url,subdomains) VALUES(?,?,?,?)')
      .run(this.settings().activeProfileId, name, url, Number(subdomains));
  }
  toggleSite(id: number) {
    this.db
      .prepare('UPDATE sites SET enabled=1-enabled WHERE id=? AND profileId=?')
      .run(id, this.settings().activeProfileId);
  }
  removeSite(id: number) {
    this.db
      .prepare('DELETE FROM sites WHERE id=? AND profileId=?')
      .run(id, this.settings().activeProfileId);
  }
  profiles() {
    return this.db
      .prepare('SELECT id,name FROM profiles ORDER BY id')
      .all()
      .map((r) => ({ id: Number(r.id), name: String(r.name) }));
  }
  profileName(value: unknown) {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.trim().length > 80 ||
      value.includes('\0')
    )
      throw new Error('Informe um nome de perfil com até 80 caracteres.');
    return value.trim();
  }
  createProfile(name: string) {
    if (this.profiles().length >= 20) throw new Error('Limite de 20 perfis.');
    this.db.prepare('INSERT INTO profiles(name) VALUES(?)').run(this.profileName(name));
  }
  renameProfile(id: number, name: string) {
    if (!this.profiles().some((p) => p.id === id)) throw new Error('Perfil não encontrado.');
    this.db.prepare('UPDATE profiles SET name=? WHERE id=?').run(this.profileName(name), id);
  }
  removeProfile(id: number) {
    if (id === this.settings().activeProfileId)
      throw new Error('Selecione outro perfil antes de excluir este.');
    if (!this.profiles().some((p) => p.id === id)) throw new Error('Perfil não encontrado.');
    this.db.prepare('DELETE FROM profiles WHERE id=?').run(id);
  }
  selectProfile(id: number) {
    const target = this.db.prepare('SELECT * FROM profiles WHERE id=?').get(id);
    if (!target) throw new Error('Perfil não encontrado.');
    const s = this.settings();
    if (s.activeProfileId === id) return;
    this.db.exec('BEGIN');
    try {
      this.db
        .prepare('UPDATE profiles SET lastUrl=?,lastTopicId=?,lastPdfId=? WHERE id=?')
        .run(s.lastUrl, s.lastTopicId ?? null, s.lastPdfId ?? null, s.activeProfileId);
      this.saveSettings({
        ...s,
        activeProfileId: id,
        lastUrl: String(target.lastUrl),
        lastTopicId: target.lastTopicId ? String(target.lastTopicId) : null,
        lastPdfId: target.lastPdfId ? String(target.lastPdfId) : null,
      });
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  saveSession(s: StudySession) {
    this.db
      .prepare(
        'INSERT INTO sessions(id,json) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json',
      )
      .run(s.id, JSON.stringify(s));
  }
  sessions(): StudySession[] {
    return this.db
      .prepare('SELECT json FROM sessions ORDER BY id DESC LIMIT 1000')
      .all()
      .map((r) => JSON.parse(String(r.json)) as StudySession);
  }
  statisticsSessions(since: number): StudySession[] {
    return this.db
      .prepare(
        "SELECT json FROM sessions WHERE json_extract(json,'$.start') >= ? OR COALESCE(json_extract(json,'$.end'),json_extract(json,'$.checkpoint')) >= ?",
      )
      .all(since, since)
      .map((r) => JSON.parse(String(r.json)) as StudySession);
  }
  recentBlocks(since: number) {
    return this.db
      .prepare('SELECT at FROM blocks WHERE at >= ?')
      .all(Math.max(since, Date.now() - 30 * 86400000))
      .map((r) => ({ at: Number(r.at) }));
  }
  block(domain: string, id?: number) {
    this.db
      .prepare('INSERT INTO blocks(session_id,at,domain) VALUES(?,?,?)')
      .run(id ?? null, Date.now(), domain);
    this.db.prepare('DELETE FROM blocks WHERE at < ?').run(Date.now() - 30 * 86400000);
  }
  notes(): Note[] {
    return this.db
      .prepare('SELECT * FROM notes ORDER BY updatedAt DESC, id')
      .all()
      .map((r) => ({
        id: String(r.id),
        title: String(r.title),
        body: String(r.body),
        subject: String(r.subject),
        subjectId: r.subjectId ? String(r.subjectId) : null,
        kind: r.kind as Note['kind'],
        createdAt: Number(r.createdAt),
        updatedAt: Number(r.updatedAt),
      }));
  }
  saveNote(input: NoteDraft) {
    const n = validateNote(input);
    const linked = n.subjectId
      ? this.db.prepare('SELECT name FROM subjects WHERE id=?').get(n.subjectId)
      : null;
    if (n.subjectId && !linked)
      throw new Error('Matéria não encontrada. Escolha outra ou use um rótulo livre.');
    const exists = this.db.prepare('SELECT 1 FROM notes WHERE id=?').get(n.id);
    if (!exists && Number(this.db.prepare('SELECT count(*) AS n FROM notes').get()!.n) >= 500)
      throw new Error('Limite de 500 anotações. Exporte e exclua as que não precisa mais.');
    const now = Date.now();
    this.db
      .prepare(
        'INSERT INTO notes(id,title,body,subject,kind,createdAt,updatedAt,subjectId) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body, subject=excluded.subject, kind=excluded.kind, updatedAt=excluded.updatedAt,subjectId=excluded.subjectId',
      )
      .run(
        n.id,
        n.title,
        n.body,
        linked ? String(linked.name) : n.subject,
        n.kind,
        now,
        now,
        n.subjectId ?? null,
      );
  }
  removeNote(id: string) {
    this.db.prepare('DELETE FROM notes WHERE id=?').run(noteId(id));
  }
  close() {
    this.db.close();
  }
}
