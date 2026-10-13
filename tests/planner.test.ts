import { it, expect } from 'vitest';
import { Store } from '../electron/database';
import { Planner, validateTopic } from '../electron/planner';
import { Sessions } from '../electron/sessions';
const subject = { id: '00000000-0000-4000-8000-000000000001', name: 'Engenharia' };
const topic = {
  id: '00000000-0000-4000-8000-000000000002',
  subjectId: subject.id,
  name: 'Scrum',
  priority: 3,
  minutes: 25,
  reviewOn: '2026-10-11',
  url: 'https://www.qconcursos.com/questoes?disciplina=1',
};
it('valida datas reais, protocolos, prioridades e durações', () => {
  expect(validateTopic(topic)).toEqual(topic);
  for (const changes of [
    { reviewOn: '2026-02-30' },
    { reviewOn: 'amanhã' },
    { minutes: 1.5 },
    { minutes: 0 },
    { minutes: 481 },
    { priority: 4 },
    { url: 'javascript:alert(1)' },
    { name: ' ' },
    { subjectId: 'a' },
  ]) {
    expect(() => validateTopic({ ...topic, ...changes })).toThrow();
  }
});
it('revalida autorização antes de salvar e iniciar sem criar sessão inválida', () => {
  const store = new Store(':memory:');
  try {
    const p = new Planner(store),
      sessions = new Sessions(store);
    p.saveSubject(subject);
    expect(() => p.saveTopic({ ...topic, url: 'https://instagram.com/' })).toThrow();
    p.saveTopic(topic);
    store.toggleSite(store.sites()[0].id);
    expect(() => p.start(topic.id, sessions)).toThrow(/autorizado/);
    expect(sessions.active).toBeNull();
    expect(p.topics()[0].lastStudied).toBeNull();
  } finally {
    store.close();
  }
});
it('preserva filtros, retoma com 5 minutos e mantém histórico e notas ao excluir matéria', () => {
  const store = new Store(':memory:');
  try {
    store.saveSettings({ ...store.settings(), mode: 'light' });
    const p = new Planner(store),
      sessions = new Sessions(store, () => 1000);
    p.saveSubject(subject);
    p.saveTopic(topic);
    store.saveNote({
      id: '00000000-0000-4000-8000-000000000003',
      title: 'Revisão',
      body: 'Papéis',
      subject: 'Rótulo antigo',
      subjectId: subject.id,
      kind: 'note',
    });
    expect(p.start(topic.id, sessions, 5)).toBe(topic.url);
    expect(sessions.active).toMatchObject({
      plannedMs: 300000,
      topicName: 'Scrum',
      subjectName: 'Engenharia',
    });
    expect(p.topics()[0].lastStudied).toBe(1000);
    expect(store.settings().lastTopicId).toBe(topic.id);
    expect(() => p.start(topic.id, sessions)).toThrow(/sessão atual/);
    sessions.finish('');
    p.saveSubject({ ...subject, name: 'Engenharia de Software' });
    expect(store.notes()[0].subject).toBe('Engenharia de Software');
    p.removeSubject(subject.id);
    expect(p.topics()).toHaveLength(0);
    expect(store.notes()[0]).toMatchObject({
      subjectId: null,
      subject: 'Engenharia de Software',
      body: 'Papéis',
    });
    expect(store.sessions()[0]).toMatchObject({ topicName: 'Scrum', subjectName: 'Engenharia' });
  } finally {
    store.close();
  }
});
