import { useId, useRef, useState } from 'react';
import { Plus, Download, ArrowLeft, Trash2 } from 'lucide-react';
import type { Note, NoteDraft, Snapshot, Subject } from './shared';

export function Notes({ state, compact = false }: { state: Snapshot; compact?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'note' | 'later'>('all');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const filterId = useId();
  const current = state.notes.find((n) => n.id === selected);
  async function create(kind: 'note' | 'later') {
    setCreating(true);
    try {
      const id = crypto.randomUUID();
      await window.studyroom.command({
        type: 'note:save',
        note: {
          id,
          title: '',
          body: '',
          subject: state.active?.subjectName ?? '',
          subjectId: state.subjects.some((s) => s.id === state.active?.subjectId)
            ? state.active!.subjectId
            : null,
          kind,
        },
      });
      setSelected(id);
      setError('');
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }
  const needle = query.toLocaleLowerCase('pt-BR');
  const notes = state.notes.filter(
    (n) =>
      (filter === 'all' || n.kind === filter) &&
      [n.title, n.body, n.subject].some((v) => v.toLocaleLowerCase('pt-BR').includes(needle)),
  );
  return (
    <section
      className={'notes ' + (compact ? 'notes-compact' : '')}
      aria-label="Caderno de anotações"
    >
      {!compact && (
        <>
          <div className="eyebrow">ESPAÇO PARA SUAS IDEIAS</div>
          <h1>Anotações</h1>
          <p className="lead">Registre o que aprendeu ou guarde um pensamento para depois.</p>
        </>
      )}
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {current ? (
        <NoteEditor
          key={current.id}
          note={current}
          subjects={state.subjects}
          back={() => setSelected(null)}
        />
      ) : (
        <>
          <div className="actions">
            <button className="primary" disabled={creating} onClick={() => void create('note')}>
              <Plus size={16} />
              Nova anotação
            </button>
            <button className="secondary" disabled={creating} onClick={() => void create('later')}>
              Ver depois
            </button>
          </div>
          <div className="note-search">
            <label>
              Pesquisar anotações
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Texto, título ou matéria"
              />
            </label>
            <div className="note-body">
              <label htmlFor={filterId}>Categoria</label>
              <select
                id={filterId}
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
              >
                <option value="all">Todas</option>
                <option value="note">Anotações</option>
                <option value="later">Ver depois</option>
              </select>
            </div>
          </div>
          <div className="note-list">
            {notes.map((n) => (
              <button className="note-summary" key={n.id} onClick={() => setSelected(n.id)}>
                <small>{n.kind === 'later' ? 'VER DEPOIS' : n.subject || 'ANOTAÇÃO'}</small>
                <strong>{n.title || 'Sem título'}</strong>
                <p>{n.body.slice(0, 140) || 'Abra para escrever.'}</p>
                <small>{new Date(n.updatedAt).toLocaleDateString('pt-BR')}</small>
              </button>
            ))}
            {!notes.length && (
              <p className="notice">
                {state.notes.length
                  ? 'Nenhuma anotação encontrada.'
                  : 'Suas ideias ficam salvas aqui, neste computador.'}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
function NoteEditor({
  note,
  back,
  subjects,
}: {
  note: Note;
  back: () => void;
  subjects: Subject[];
}) {
  const [draft, setDraft] = useState<NoteDraft>(note);
  const [status, setStatus] = useState('Salvo neste computador');
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const latest = useRef<NoteDraft>(note);
  const bodyId = useId();
  const kindId = useId();
  function save(next: NoteDraft) {
    latest.current = next;
    setDraft(next);
    setPending(true);
    setFailed(false);
    setStatus('Salvando…');
    const version = ++revision.current;
    queue.current = queue.current.then(async () => {
      try {
        await window.studyroom.command({ type: 'note:save', note: next });
        if (version === revision.current) {
          setStatus('Salvo neste computador');
          setPending(false);
          setFailed(false);
        }
      } catch (e) {
        if (version === revision.current) {
          setStatus('Não foi possível salvar. ' + String(e));
          setPending(false);
          setFailed(true);
        }
      }
    });
  }
  async function exportNote() {
    await queue.current;
    if (failed) return;
    try {
      await window.studyroom.command({ type: 'note:export', id: note.id });
    } catch (e) {
      setStatus('Falha ao exportar: ' + String(e));
    }
  }
  async function remove() {
    await queue.current;
    try {
      await window.studyroom.command({ type: 'note:remove', id: note.id });
      back();
    } catch (e) {
      setStatus(String(e));
      setConfirmDelete(false);
    }
  }
  return (
    <div className="note-editor">
      <div className="actions">
        <button className="text-button" disabled={pending || failed} onClick={back}>
          <ArrowLeft size={16} />
          Todas as anotações
        </button>
        <button
          className="secondary"
          disabled={pending || failed}
          onClick={() => void exportNote()}
        >
          <Download size={16} />
          Exportar Markdown
        </button>
      </div>
      <label>
        Título
        <input
          autoFocus
          maxLength={120}
          value={draft.title}
          onChange={(e) => save({ ...latest.current, title: e.target.value })}
          placeholder="Dê um nome à sua ideia"
        />
      </label>
      <div className="note-fields">
        <div className="note-body">
          <label htmlFor={bodyId + '-subject'}>Matéria do planejador</label>
          <select
            id={bodyId + '-subject'}
            value={draft.subjectId ?? ''}
            onChange={(e) =>
              save({
                ...latest.current,
                subjectId: e.target.value || null,
                subject:
                  subjects.find((s) => s.id === e.target.value)?.name ?? latest.current.subject,
              })
            }
          >
            <option value="">Rótulo livre</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <label>
          Matéria (opcional)
          <input
            disabled={!!draft.subjectId}
            maxLength={100}
            value={draft.subject}
            onChange={(e) => save({ ...latest.current, subject: e.target.value })}
            placeholder="Ex.: Engenharia de Software"
          />
        </label>
        <div className="note-body">
          <label htmlFor={kindId}>Tipo</label>
          <select
            id={kindId}
            value={draft.kind}
            onChange={(e) => save({ ...latest.current, kind: e.target.value as NoteDraft['kind'] })}
          >
            <option value="note">Anotação de estudo</option>
            <option value="later">Ver depois</option>
          </select>
        </div>
      </div>
      <div className="note-body">
        <label htmlFor={bodyId}>Texto</label>
        <textarea
          id={bodyId}
          maxLength={100000}
          value={draft.body}
          onChange={(e) => save({ ...latest.current, body: e.target.value })}
          placeholder={
            draft.kind === 'later'
              ? 'Guarde o pensamento aqui e volte ao estudo.'
              : 'O que você quer lembrar? Markdown também é bem-vindo.'
          }
        />
      </div>
      <small role="status">{status}</small>
      {failed && (
        <button className="primary" onClick={() => save(latest.current)}>
          Tentar salvar novamente
        </button>
      )}
      {confirmDelete ? (
        <div className="notice">
          <span>Excluir esta anotação permanentemente?</span>
          <button className="secondary" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </button>
          <button className="secondary" disabled={pending} onClick={() => void remove()}>
            Confirmar exclusão
          </button>
        </div>
      ) : (
        <button className="text-button" disabled={pending} onClick={() => setConfirmDelete(true)}>
          <Trash2 size={15} />
          Excluir anotação
        </button>
      )}
    </div>
  );
}
