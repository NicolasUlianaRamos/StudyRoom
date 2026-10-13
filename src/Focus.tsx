import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Minus,
  Plus,
  ShieldCheck,
  Pause,
  Play,
  LogOut,
  Globe,
  Maximize,
  Minimize,
  NotebookPen,
  SlidersHorizontal,
} from 'lucide-react';
import { Notes } from './Notes';
import { PdfReader } from './PdfReader';
import type { Snapshot } from './shared';
import { duration, IconButton, type Run } from './components';
export function Focus({
  state,
  run,
  exit,
  plan,
}: {
  state: Snapshot;
  run: Run;
  exit: () => void;
  plan: () => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const active = state.active;
  const remote = state.browser;
  const effective = active
    ? active.effectiveMs +
      (active.runningSince === null ? 0 : Math.max(0, state.now - active.runningSince))
    : 0;
  const visible = active?.status === 'running' && state.exitReadyAt === null && !active?.pdfId;
  useEffect(() => {
    void window.studyroom.command({ type: 'focus:presence', visible: true });
    return () => {
      void window.studyroom.command({ type: 'focus:presence', visible: false });
    };
  }, []);
  useEffect(() => {
    setControlsOpen(false);
  }, [state.immersive]);
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const update = () => {
      const r = element.getBoundingClientRect();
      void window.studyroom.command({
        type: 'view',
        visible: !!visible,
        bounds: {
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
          height: Math.round(r.height),
        },
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => {
      observer.disconnect();
      void window.studyroom.command({
        type: 'view',
        visible: false,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
      });
    };
  }, [visible]);
  return (
    <div className="focus">
      {state.immersive && (
        <div className="immersive-bar" aria-label="Controles do modo imersivo">
          <span className="immersive-domain" title={active?.pdfName || remote.domain}>
            <ShieldCheck size={14} />
            <span>{active?.pdfName || remote.domain || 'Seu estudo'}</span>
          </span>
          <div className="timer" aria-label="Tempo restante">
            <span className="status-dot" />
            {duration((active?.plannedMs ?? 0) - effective)}
          </div>
          <IconButton
            label={active?.status === 'paused' ? 'Retomar' : 'Pausar'}
            disabled={active?.status === 'completed'}
            onClick={() => void run({ type: active?.status === 'paused' ? 'resume' : 'pause' })}
          >
            {active?.status === 'paused' ? <Play size={15} /> : <Pause size={15} />}
          </IconButton>
          <button
            className="icon-button"
            aria-label={notesOpen ? 'Fechar anotações' : 'Anotações'}
            title="Anotações"
            aria-expanded={notesOpen}
            onClick={() => setNotesOpen(!notesOpen)}
          >
            <NotebookPen size={15} />
          </button>
          <button
            className="immersive-tools"
            aria-expanded={controlsOpen}
            aria-controls="focus-browser-bar"
            onClick={() => setControlsOpen(!controlsOpen)}
          >
            <SlidersHorizontal size={15} />
            {controlsOpen ? 'Ocultar controles' : 'Controles'}
          </button>
          <IconButton label="Encerrar" onClick={exit}>
            <LogOut size={15} />
          </IconButton>
          <IconButton
            label="Sair do modo imersivo (F11 ou Esc)"
            onClick={() => void run({ type: 'immersive:toggle' })}
          >
            <Minimize size={16} />
          </IconButton>
        </div>
      )}
      <header className="focus-header">
        <div>
          <span className="eyebrow">AGORA, SÓ O ESSENCIAL</span>
          <strong>
            {active?.pdfName ||
              (active?.topicName
                ? active.subjectName + ' · ' + active.topicName
                : 'Seu momento de foco')}
          </strong>
        </div>
        <div className="timer">
          <span className="status-dot" />
          {duration((active?.plannedMs ?? 0) - effective)}
        </div>
        <button
          className="secondary"
          onClick={() => void run({ type: active?.status === 'paused' ? 'resume' : 'pause' })}
          disabled={active?.status === 'completed'}
        >
          {active?.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}{' '}
          {active?.status === 'paused' ? 'Retomar' : 'Pausar'}
        </button>
        <button className="text-button" onClick={exit}>
          <LogOut size={17} />
          Encerrar
        </button>
        <IconButton
          label="Modo imersivo (F11)"
          onClick={() => void run({ type: 'immersive:toggle' })}
        >
          <Maximize size={18} />
        </IconButton>
      </header>
      <div id="focus-browser-bar" className="browser-bar" hidden={state.immersive && !controlsOpen}>
        <button
          className="secondary"
          aria-expanded={notesOpen}
          onClick={() => setNotesOpen(!notesOpen)}
        >
          {notesOpen ? 'Fechar anotações' : 'Anotações'}
        </button>
        {active?.pdfId ? (
          <span className="domain">PDF local · arquivo da sua biblioteca</span>
        ) : (
          <>
            <div className="browser-controls">
              <IconButton
                label="Voltar"
                disabled={!remote.canBack}
                onClick={() => void run({ type: 'browser', action: 'back' })}
              >
                <ArrowLeft size={18} />
              </IconButton>
              <IconButton
                label="Avançar"
                disabled={!remote.canForward}
                onClick={() => void run({ type: 'browser', action: 'forward' })}
              >
                <ArrowRight size={18} />
              </IconButton>
              <IconButton
                label="Recarregar"
                onClick={() => void run({ type: 'browser', action: 'reload' })}
              >
                <RotateCw size={17} className={remote.loading ? 'spinning' : ''} />
              </IconButton>
              <IconButton
                label="Página inicial"
                onClick={() => void run({ type: 'browser', action: 'home' })}
              >
                <Home size={17} />
              </IconButton>
            </div>
            <div className="domain">
              <ShieldCheck size={15} />
              {remote.domain || 'Preparando seu estudo…'}
            </div>
            <IconButton
              label="Reduzir zoom"
              onClick={() => void run({ type: 'browser', action: 'zoomOut' })}
            >
              <Minus size={16} />
            </IconButton>
            <small>{Math.round(remote.zoom * 100)}%</small>
            <IconButton
              label="Ampliar zoom"
              onClick={() => void run({ type: 'browser', action: 'zoomIn' })}
            >
              <Plus size={16} />
            </IconButton>
            <button
              className="text-button auth-button"
              title="Autoriza por 5 minutos apenas rotas de autenticação de accounts.google.com e accounts.google.com.br. Depois, use o botão de login no site. Provedores podem recusar navegadores incorporados."
              onClick={() => void run({ type: 'browser', action: 'auth' })}
            >
              {remote.authUntil > state.now ? 'Login Google: 5 min' : 'Autorizar login Google'}
            </button>
          </>
        )}
      </div>
      <div className="focus-workspace">
        <div ref={area} className="browser-area">
          {active?.status === 'completed' ? (
            <div className="focus-message">
              <span className="message-icon">
                <ShieldCheck size={32} />
              </span>
              <h1>Você dedicou um tempo a você.</h1>
              <p>Quer continuar? Escolha o próximo passo no seu ritmo.</p>
              <div className="actions">
                <button
                  className="primary"
                  onClick={() => void run({ type: 'extend', minutes: 5 })}
                >
                  Continuar por 5 minutos
                </button>
                <button
                  className="secondary"
                  onClick={() => void run({ type: 'extend', minutes: 25 })}
                >
                  Mais 25 minutos
                </button>
                <button className="text-button" onClick={exit}>
                  Encerrar
                </button>
              </div>
            </div>
          ) : active?.status === 'paused' ? (
            <div className="focus-message">
              <span className="message-icon">
                <Pause size={32} />
              </span>
              <h1>Uma pausa também faz parte.</h1>
              <button className="secondary" onClick={plan}>
                Abrir planejador
              </button>
              <p>O tempo de estudo está pausado. Respire e retome quando quiser.</p>
              {state.recovered && (
                <p className="notice">
                  Sua sessão foi recuperada em segurança. O tempo com o aplicativo fechado não foi
                  contabilizado.
                </p>
              )}
              <button
                className="primary"
                onClick={async () => {
                  if (!active?.pdfId && !state.browser.domain)
                    await run({ type: 'navigate', url: state.settings.lastUrl });
                  await run({ type: 'resume' });
                }}
              >
                Retomar meu estudo <Play size={17} />
              </button>
            </div>
          ) : !active?.pdfId && remote.blocked ? (
            <div className="focus-message">
              <span className="message-icon">
                <ShieldCheck size={32} />
              </span>
              <h1>Vamos manter o foco?</h1>
              <p>Este site não faz parte do seu ambiente de estudos.</p>
              <small>{remote.blocked}</small>
              <button
                className="primary"
                onClick={() => void run({ type: 'browser', action: 'return' })}
              >
                Voltar ao estudo <ArrowLeft size={17} />
              </button>
            </div>
          ) : !active?.pdfId && remote.error ? (
            <div className="focus-message">
              <Globe size={32} />
              <h1>Uma pequena interrupção.</h1>
              <p>{remote.error}</p>
              <button
                className="primary"
                onClick={() => void run({ type: 'browser', action: 'reload' })}
              >
                Tentar novamente
              </button>
            </div>
          ) : active?.pdfId ? (
            state.pdfs.find((p) => p.id === active.pdfId) ? (
              <PdfReader
                key={active.pdfId}
                material={state.pdfs.find((p) => p.id === active.pdfId)!}
                state={state}
              />
            ) : (
              <p>PDF não encontrado. Encerre a sessão e importe o material novamente.</p>
            )
          ) : (
            <div className="loading-copy">Preparando sua página de estudos…</div>
          )}
        </div>
        {notesOpen && (
          <aside className="focus-notes" aria-label="Anotações durante o estudo">
            <Notes state={state} compact />
          </aside>
        )}
      </div>
    </div>
  );
}
