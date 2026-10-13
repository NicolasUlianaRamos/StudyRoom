import type { Note, NoteDraft } from '../src/shared';
export function noteId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/i.test(value))
    throw new Error('Anotação inválida.');
  return value;
}
export function validateNote(value: NoteDraft): NoteDraft {
  if (!value || typeof value !== 'object') throw new Error('Anotação inválida.');
  const field = (v: unknown, max: number) => {
    if (typeof v !== 'string' || v.length > max || v.includes('\0'))
      throw new Error('Texto da anotação inválido.');
    return v;
  };
  if (value.kind !== 'note' && value.kind !== 'later') throw new Error('Categoria inválida.');
  return {
    ...(value.subjectId != null ? { subjectId: noteId(value.subjectId) } : {}),
    id: noteId(value.id),
    title: field(value.title, 120),
    body: field(value.body, 100000),
    subject: field(value.subject, 100),
    kind: value.kind,
  };
}
export function markdown(note: Note): string {
  const title = (
    note.title.trim() || (note.kind === 'later' ? 'Ver depois' : 'Sem título')
  ).replace(/[\r\n]/g, ' ');
  return (
    '# ' +
    title +
    '\n\n' +
    (note.subject.trim() ? 'Matéria: ' + note.subject.replace(/[\r\n]/g, ' ') + '\n\n' : '') +
    note.body +
    '\n'
  );
}
