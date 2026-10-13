import { useState } from 'react';
import type { Command, Snapshot, Subject, TopicDraft } from './shared';
import { Modal } from './components';

export function Planner({
  state,
  started,
}: {
  state: Snapshot;
  started: (next: Snapshot) => void;
}) {
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topic, setTopic] = useState<TopicDraft | null>(null);
  const [removing, setRemoving] = useState<{
    type: 'subject:remove' | 'topic:remove';
    id: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(command: Command, done: () => void = () => {}) {
    setBusy(true);
    try {
      const next = await window.studyroom.command(command);
      setError('');
      done();
      if (command.type === 'topic:start') started(next);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const today = new Date(state.now);
  const day = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return (
    <section className="planner">
      <div className="eyebrow">UM PASSO PLANEJADO DE CADA VEZ</div>
      <h1>Seu plano de estudos</h1>
      <p className="lead">Organize assuntos, separe um tempo e escolha quando revisar.</p>
      <button className="primary" onClick={() => setSubject({ id: crypto.randomUUID(), name: '' })}>
        Nova matéria
      </button>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {state.active && (
        <p className="notice">
          Você pode planejar durante a pausa. Encerre a sessão atual antes de iniciar outro assunto.
        </p>
      )}
      {!state.subjects.length && (
        <p className="notice">Crie sua primeira matéria e adicione os assuntos que quer estudar.</p>
      )}
      {state.subjects.map((s) => {
        const topics = state.topics.filter((t) => t.subjectId === s.id);
        return (
          <section className="card plan-subject" key={s.id} aria-label={s.name}>
            <div className="section-heading">
              <div>
                <h2>{s.name}</h2>
                <small>
                  {topics.length} assuntos · {topics.reduce((total, t) => total + t.minutes, 0)} min
                  previstos
                </small>
              </div>
              <div className="actions">
                <button className="secondary" onClick={() => setSubject(s)}>
                  Editar matéria
                </button>
                <button
                  className="text-button"
                  onClick={() => setRemoving({ type: 'subject:remove', id: s.id, name: s.name })}
                >
                  Excluir matéria
                </button>
              </div>
            </div>
            {topics.map((t) => (
              <article className="plan-topic" key={t.id}>
                <div>
                  <h3>{t.name}</h3>
                  <p>
                    {['', 'Prioridade baixa', 'Prioridade média', 'Prioridade alta'][t.priority]} ·{' '}
                    {t.minutes} min
                  </p>
                  <small>
                    {t.reviewOn
                      ? (t.reviewOn <= day ? 'Revisão prevista: ' : 'Próxima revisão: ') +
                        new Date(t.reviewOn + 'T12:00:00').toLocaleDateString('pt-BR')
                      : 'Sem revisão agendada'}
                  </small>
                  <small>
                    {t.lastStudied
                      ? 'Último estudo iniciado: ' + new Date(t.lastStudied).toLocaleString('pt-BR')
                      : 'Ainda não estudado'}
                  </small>
                  <small>{new URL(t.url).hostname}</small>
                </div>
                <div className="actions">
                  <button
                    className="primary"
                    disabled={busy || !!state.active}
                    onClick={() => void send({ type: 'topic:start', id: t.id })}
                  >
                    Estudar agora
                  </button>
                  <button className="secondary" onClick={() => setTopic(t)}>
                    Editar assunto
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setRemoving({ type: 'topic:remove', id: t.id, name: t.name })}
                  >
                    Excluir assunto
                  </button>
                </div>
              </article>
            ))}
            <button
              className="secondary"
              onClick={() =>
                setTopic({
                  id: crypto.randomUUID(),
                  subjectId: s.id,
                  name: '',
                  priority: 2,
                  minutes: 25,
                  reviewOn: '',
                  url: state.sites.find((s) => s.enabled)?.url || '',
                })
              }
            >
              Adicionar assunto
            </button>
          </section>
        );
      })}
      {subject && (
        <Modal label="Editar matéria">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              void send({ type: 'subject:save', subject }, () => setSubject(null));
            }}
          >
            <h2>Matéria</h2>
            <label>
              Nome da matéria
              <input
                autoFocus
                required
                maxLength={100}
                value={subject.name}
                onChange={(e) => setSubject({ ...subject, name: e.target.value })}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="actions">
              <button className="primary" disabled={busy}>
                Salvar matéria
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setSubject(null);
                  setError('');
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
      {topic && (
        <Modal label="Editar assunto">
          <form
            className="modal plan-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send({ type: 'topic:save', topic }, () => setTopic(null));
            }}
          >
            <h2>Assunto</h2>
            <label>
              Nome do assunto
              <input
                autoFocus
                required
                maxLength={100}
                value={topic.name}
                onChange={(e) => setTopic({ ...topic, name: e.target.value })}
              />
            </label>
            <label>
              Link autorizado
              <input
                type="url"
                required
                maxLength={2048}
                value={topic.url}
                onChange={(e) => setTopic({ ...topic, url: e.target.value })}
              />
            </label>
            <small>
              O endereço completo será salvo para retomar seus filtros. Use um link de estudo, sem
              tokens de acesso.
            </small>
            <div className="note-fields">
              <label>
                Tempo previsto (minutos)
                <input
                  type="number"
                  required
                  min={1}
                  max={480}
                  value={topic.minutes}
                  onChange={(e) => setTopic({ ...topic, minutes: Number(e.target.value) })}
                />
              </label>
              <div className="note-body">
                <label htmlFor="topic-priority">Prioridade</label>
                <select
                  id="topic-priority"
                  value={topic.priority}
                  onChange={(e) => setTopic({ ...topic, priority: Number(e.target.value) })}
                >
                  <option value={1}>Baixa</option>
                  <option value={2}>Média</option>
                  <option value={3}>Alta</option>
                </select>
              </div>
            </div>
            <label>
              Próxima revisão
              <input
                type="date"
                value={topic.reviewOn}
                onChange={(e) => setTopic({ ...topic, reviewOn: e.target.value })}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="actions">
              <button className="primary" disabled={busy}>
                Salvar assunto
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setTopic(null);
                  setError('');
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
      {removing && (
        <Modal label="Confirmar exclusão">
          <div className="modal">
            <h2>Excluir {removing.name}?</h2>
            <p>
              {removing.type === 'subject:remove'
                ? 'Os assuntos desta matéria serão removidos. Anotações e histórico serão preservados.'
                : 'O histórico de sessões será preservado.'}
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="actions">
              <button className="secondary" disabled={busy} onClick={() => setRemoving(null)}>
                Cancelar
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void send({ type: removing.type, id: removing.id }, () => setRemoving(null))
                }
              >
                Confirmar exclusão
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
