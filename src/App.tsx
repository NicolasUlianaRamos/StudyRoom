import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  NotebookPen,
  ShieldCheck,
  History as HistoryIcon,
  Sun,
  Moon,
  ArrowRight,
  Leaf,
  ChartNoAxesColumn,
  BookOpen,
} from 'lucide-react';
import type { Command, Snapshot } from './shared';
import { Brand, Home, IconButton, Modal } from './components';
import { Settings, History } from './Settings';
import { Focus } from './Focus';
import { Notes } from './Notes';
import { Planner } from './Planner';
import { Statistics } from './Statistics';
import { Library } from './Library';
export function App() {
  const [state, setState] = useState<Snapshot | null>(null);
  const [page, setPage] = useState<
    'home' | 'settings' | 'history' | 'focus' | 'notes' | 'planner' | 'statistics' | 'library'
  >('home');
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const run = useCallback(async (c: Command) => {
    try {
      setState(await window.studyroom.command(c));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
    }
  }, []);
  useEffect(() => {
    void run({ type: 'snapshot' });
    return window.studyroom.subscribe(setState);
  }, [run]);
  useEffect(() => {
    if (state) document.documentElement.dataset.theme = state.settings.theme;
  }, [state?.settings.theme]);
  useEffect(() => {
    if (state?.active && state.exitReadyAt !== null) setPage('focus');
  }, [state?.exitReadyAt]);
  if (!state)
    return (
      <div className="boot">
        <Leaf size={30} />
        <p>Preparando seu espaço…</p>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  const begin = async (minutes: number, url?: string) => {
    try {
      const next = await window.studyroom.command({ type: 'start', minutes, url });
      setState(next);
      setPage('focus');
      setError('');
    } catch (e) {
      setError(String(e));
    }
  };
  const exit = async () => {
    if (state.settings.mode === 'light' || state.active?.status === 'completed') {
      await run({ type: 'exit:confirm', reason: '' });
      setPage('home');
    } else {
      setReason('');
      await run({ type: 'exit:request' });
    }
  };
  const modal = state.exitReadyAt !== null && !!state.active;
  const remaining = state.exitReadyAt
    ? Math.max(0, Math.ceil((state.exitReadyAt - state.now) / 1000))
    : 0;
  return (
    <div
      className={
        'app ' + (page === 'focus' ? 'is-focus' : '') + (state.immersive ? ' is-immersive' : '')
      }
    >
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Navegação principal">
          {(
            [
              { id: 'home', label: 'Meu espaço', icon: LayoutDashboard },
              { id: 'settings', label: 'Sites e preferências', icon: ShieldCheck },
              { id: 'notes', label: 'Anotações', icon: NotebookPen },
              { id: 'planner', label: 'Planejador', icon: LayoutDashboard },
              { id: 'history', label: 'Histórico', icon: HistoryIcon },
              { id: 'statistics', label: 'Estatísticas', icon: ChartNoAxesColumn },
              { id: 'library', label: 'Biblioteca', icon: BookOpen },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={page === item.id ? 'selected' : ''}
              onClick={() => {
                if (state.active?.status === 'running') void run({ type: 'pause' });
                setPage(item.id);
              }}
            >
              <item.icon size={19} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" />
          Feito para o seu foco.<small>Um momento de cada vez.</small>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>{page === 'focus' ? 'AMBIENTE DE ESTUDO' : 'MENOS DISTRAÇÃO. MAIS PRESENÇA.'}</span>
          <div className="top-actions">
            {state.active && page !== 'focus' && (
              <button className="secondary" onClick={() => setPage('focus')}>
                Continuar estudando <ArrowRight size={16} />
              </button>
            )}
            <IconButton
              label="Alternar tema"
              onClick={() =>
                void run({
                  type: 'settings',
                  settings: { theme: state.settings.theme === 'light' ? 'dark' : 'light' },
                })
              }
            >
              {state.settings.theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </IconButton>
          </div>
        </header>
        {page === 'focus' && state.active ? (
          <Focus state={state} run={run} exit={() => void exit()} plan={() => setPage('planner')} />
        ) : (
          <main className="content">
            {page === 'library' ? (
              <Library
                state={state}
                started={(next) => {
                  setState(next);
                  setPage('focus');
                }}
              />
            ) : page === 'statistics' ? (
              <Statistics state={state} />
            ) : page === 'planner' ? (
              <Planner
                state={state}
                started={(next) => {
                  setState(next);
                  setPage('focus');
                }}
              />
            ) : page === 'notes' ? (
              <Notes state={state} />
            ) : page === 'settings' ? (
              <Settings state={state} run={run} />
            ) : page === 'history' ? (
              <History state={state} />
            ) : (
              <Home
                state={state}
                run={run}
                begin={(m, u) => {
                  if (state.active) {
                    setPage('focus');
                    return;
                  }
                  void begin(m, u);
                }}
              />
            )}
          </main>
        )}
      </div>
      {error && (
        <div className="toast" role="alert">
          {error.replace(/^Error:.*?: /, '')}
          <button aria-label="Fechar mensagem" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      {modal && (
        <Modal label="Encerrar sessão">
          <form
            className="modal"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setState(await window.studyroom.command({ type: 'exit:confirm', reason }));
                setPage('home');
                setError('');
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            <div className="eyebrow">UMA ESCOLHA CONSCIENTE</div>
            <h2>Precisa encerrar por agora?</h2>
            <p>Tudo bem ajustar seus planos. Reserve um instante para decidir.</p>
            <label>
              O que motivou a saída?
              <textarea
                autoFocus
                required
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Registre seu motivo, sem julgamentos."
              />
            </label>
            <div className="actions">
              <button
                className="primary"
                type="button"
                onClick={() => void run({ type: 'exit:cancel' })}
              >
                Voltar ao estudo
              </button>
              <button className="secondary" disabled={remaining > 0 || !reason.trim()}>
                {remaining > 0 ? 'Aguarde ' + remaining + ' s' : 'Encerrar sessão'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
