import type { Store } from './database';
import type { Sessions } from './sessions';
import type { Subject, Topic, TopicDraft } from '../src/shared';
import { noteId } from './notes';
import { allowed, domainOnly, parseSafeUrl } from './policy';

function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 100 || value.includes('\0'))
    throw new Error('Informe um nome de até 100 caracteres.');
  return value.trim();
}
export function validateTopic(t: TopicDraft): TopicDraft {
  if (!t || typeof t !== 'object') throw new Error('Assunto inválido.');
  if (!Number.isInteger(t.minutes) || t.minutes < 1 || t.minutes > 480)
    throw new Error('Escolha entre 1 e 480 minutos.');
  if (![1, 2, 3].includes(t.priority)) throw new Error('Prioridade inválida.');
  if (
    typeof t.reviewOn !== 'string' ||
    (t.reviewOn !== '' &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(t.reviewOn) ||
        !Number.isFinite(Date.parse(t.reviewOn)) ||
        new Date(t.reviewOn).toISOString().slice(0, 10) !== t.reviewOn))
  )
    throw new Error('Data de revisão inválida.');
  const url = typeof t.url === 'string' && t.url.length <= 2048 ? parseSafeUrl(t.url) : null;
  if (!url) throw new Error('Informe um link HTTPS válido.');
  return {
    id: noteId(t.id),
    subjectId: noteId(t.subjectId),
    name: name(t.name),
    minutes: t.minutes,
    priority: t.priority,
    reviewOn: t.reviewOn,
    url: url.href,
  };
}
export class Planner {
  constructor(private store: Store) {}
  subjects(): Subject[] {
    return this.store.db
      .prepare('SELECT id,name FROM subjects ORDER BY name COLLATE NOCASE')
      .all() as unknown as Subject[];
  }
  topics(): Topic[] {
    return this.store.db
      .prepare(
        "SELECT * FROM topics ORDER BY priority DESC, CASE WHEN reviewOn='' THEN 1 ELSE 0 END, reviewOn, name",
      )
      .all() as unknown as Topic[];
  }
  saveSubject(s: Subject) {
    if (!s || typeof s !== 'object') throw new Error('Matéria inválida.');
    const id = noteId(s.id),
      label = name(s.name);
    this.store.db
      .prepare(
        'INSERT INTO subjects(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',
      )
      .run(id, label);
    this.store.db.prepare('UPDATE notes SET subject=? WHERE subjectId=?').run(label, id);
  }
  removeSubject(id: string) {
    this.store.db.prepare('DELETE FROM subjects WHERE id=?').run(noteId(id));
  }
  saveTopic(input: TopicDraft) {
    const t = validateTopic(input);
    if (!this.subjects().some((s) => s.id === t.subjectId))
      throw new Error('Matéria não encontrada.');
    if (!allowed(t.url, this.store.sites()))
      throw new Error('Autorize este site em Sites e preferências antes de salvar o assunto.');
    this.store.db
      .prepare(
        'INSERT INTO topics(id,subjectId,name,priority,minutes,reviewOn,url) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subjectId=excluded.subjectId,name=excluded.name,priority=excluded.priority,minutes=excluded.minutes,reviewOn=excluded.reviewOn,url=excluded.url',
      )
      .run(t.id, t.subjectId, t.name, t.priority, t.minutes, t.reviewOn, t.url);
  }
  removeTopic(id: string) {
    this.store.db.prepare('DELETE FROM topics WHERE id=?').run(noteId(id));
  }
  start(id: string, sessions: Sessions, minutes?: number): string {
    const validId = noteId(id);
    const t = this.topics().find((t) => t.id === validId);
    if (!t) throw new Error('Este assunto não existe mais. Escolha outro no planejador.');
    if (!allowed(t.url, this.store.sites()))
      throw new Error(
        'O site deste assunto não está mais autorizado. Revise os sites antes de estudar.',
      );
    const subject = this.subjects().find((s) => s.id === t.subjectId)!;
    sessions.start(minutes ?? t.minutes, domainOnly(t.url), {
      topicId: t.id,
      topicName: t.name,
      subjectId: subject.id,
      subjectName: subject.name,
    });
    this.store.db
      .prepare('UPDATE topics SET lastStudied=? WHERE id=?')
      .run(sessions.active!.start, t.id);
    this.store.saveSettings({ ...this.store.settings(), lastTopicId: t.id });
    return t.url;
  }
}
