import { useState } from 'react';
import type { Command, Snapshot } from './shared';
import { Modal } from './components';

export function ProfileSelect({
  state,
  select,
}: {
  state: Snapshot;
  select: (id: number) => void;
}) {
  return (
    <div className="setting-row">
      <label htmlFor="active-profile">Perfil de estudo</label>
      <select
        id="active-profile"
        value={state.settings.activeProfileId}
        disabled={!!state.active}
        onChange={(e) => select(Number(e.target.value))}
      >
        {state.profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Profiles({ state }: { state: Snapshot }) {
  const [edit, setEdit] = useState<{ id?: number; name: string } | null>(null);
  const [remove, setRemove] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = !!state.active || busy;
  async function submit(command: Command) {
    setBusy(true);
    try {
      await window.studyroom.command(command);
      setError('');
      setEdit(null);
      setRemove(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card settings-card">
      <h2>Perfis de estudo</h2>
      <p>
        Cada perfil tem seus próprios sites e último assunto. Notas, planejador, histórico,
        preferências e logins são compartilhados.
      </p>
      {state.active && <p>Encerre a sessão para criar, trocar ou alterar perfis.</p>}
      {error && !edit && !remove && <p role="alert">{error}</p>}
      <ProfileSelect state={state} select={(id) => void submit({ type: 'profile:select', id })} />
      {state.profiles.map((p) => (
        <div className="site-row" key={p.id}>
          <strong>
            {p.name}
            {p.id === state.settings.activeProfileId ? ' · selecionado' : ''}
          </strong>
          <button
            className="secondary"
            disabled={locked}
            aria-label={'Renomear perfil ' + p.name}
            onClick={() => {
              setError('');
              setEdit(p);
            }}
          >
            Renomear
          </button>
          <button
            className="secondary"
            disabled={locked || p.id === state.settings.activeProfileId}
            aria-label={'Excluir perfil ' + p.name}
            onClick={() => {
              setError('');
              setRemove(p);
            }}
          >
            Excluir
          </button>
        </div>
      ))}
      <button
        className="secondary"
        disabled={locked || state.profiles.length >= 20}
        onClick={() => {
          setError('');
          setEdit({ name: '' });
        }}
      >
        Novo perfil
      </button>
      <p>
        Novos perfis começam sem sites. Para excluir o perfil selecionado, escolha outro primeiro.
      </p>
      {edit && (
        <Modal label={edit.id ? 'Renomear perfil' : 'Novo perfil'}>
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(
                edit.id
                  ? { type: 'profile:rename', id: edit.id, name: edit.name }
                  : { type: 'profile:create', name: edit.name },
              );
            }}
          >
            <h2>{edit.id ? 'Renomear perfil' : 'Novo perfil'}</h2>
            <label>
              Nome do perfil
              <input
                required
                maxLength={80}
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button className="primary" disabled={busy}>
              Salvar perfil
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setEdit(null)}
            >
              Cancelar
            </button>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal label="Excluir perfil">
          <section className="modal">
            <h2>Excluir {remove.name}?</h2>
            <p>
              Os sites desse perfil serão excluídos. Notas, matérias e sessões registradas serão
              preservadas.
            </p>
            {error && <p role="alert">{error}</p>}
            <button
              className="primary"
              disabled={busy}
              onClick={() => void submit({ type: 'profile:remove', id: remove.id })}
            >
              Confirmar exclusão
            </button>
            <button className="secondary" disabled={busy} onClick={() => setRemove(null)}>
              Cancelar
            </button>
          </section>
        </Modal>
      )}
    </section>
  );
}
