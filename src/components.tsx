import { useEffect, useRef, type ReactNode } from 'react';
import { Leaf, ArrowUpRight, Clock3, ShieldCheck } from 'lucide-react';
import type { Command, Snapshot } from './shared';
import { ProfileSelect } from './Profiles';
export type Run = (command: Command) => Promise<void>;
export const duration = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return (
    Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0') +
    ':' +
    (seconds % 60).toString().padStart(2, '0')
  );
};
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Leaf size={22} />
      </span>
      studyroom<span className="beta">BETA</span>
    </div>
  );
}
export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className="icon-button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function Home({
  state,
  run,
  begin,
}: {
  state: Snapshot;
  run: Run;
  begin: (minutes: number, url?: string) => void;
}) {
  const last = state.history.find((s) => s.status === 'completed' || s.status === 'interrupted');
  return (
    <>
      <div className="eyebrow">SEU ESPAÇO DE CONCENTRAÇÃO</div>
      <h1>Um passo de cada vez.</h1>
      <p className="lead">Deixe o ruído lá fora. Seu próximo momento de foco começa aqui.</p>
      <ProfileSelect state={state} select={(id) => void run({ type: 'profile:select', id })} />
      <div className="home-grid">
        <section className="start-card">
          <div className="tag">
            <span className="status-dot" />
            Tudo pronto para estudar
          </div>
          <h2>
            O mais difícil é começar.
            <br />
            Vamos por cinco minutos?
          </h2>
          <p>Sem pressão. Uma página, uma questão, um pequeno avanço.</p>
          {state.pdfs.find((p) => p.id === state.settings.lastPdfId) && (
            <p>Retomar PDF: {state.pdfs.find((p) => p.id === state.settings.lastPdfId)!.name}</p>
          )}
          {state.topics.find((t) => t.id === state.settings.lastTopicId) && (
            <p>Retomar: {state.topics.find((t) => t.id === state.settings.lastTopicId)!.name}</p>
          )}
          <button className="primary big" onClick={() => begin(5)}>
            Só começar por 5 minutos <ArrowUpRight size={20} />
          </button>
          <span className="card-foot">
            <ShieldCheck size={15} /> Apenas os sites que você escolheu.
          </span>
          <div className="orb orb-one" />
          <div className="orb orb-two" />
        </section>
        <section className="card daily">
          <div className="section-label">
            SEU RITMO, HOJE <Clock3 size={18} />
          </div>
          <div className="minutes">
            {Math.floor(state.todayMs / 60000)}
            <span>min</span>
          </div>
          <p>de {state.settings.dailyGoal} minutos planejados</p>
          <progress value={state.todayMs / 60000} max={state.settings.dailyGoal} />
          <small>Cada minuto de atenção conta.</small>
        </section>
      </div>
      <div className="section-heading">
        <h2>Sua próxima sessão</h2>
        <span>Escolha um tempo confortável</span>
      </div>
      <div className="session-options">
        {[
          [25, 'Pomodoro'],
          [45, 'Tradicional'],
          [60, 'Foco prolongado'],
        ].map(([time, label]) => (
          <button className="session-option" key={time} onClick={() => begin(Number(time))}>
            <Clock3 size={19} />
            <strong>{time} min</strong>
            <span>{label}</span>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      <form
        className="custom-time"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          begin(Number(data.get('minutes')));
        }}
      >
        <label htmlFor="custom-minutes">Seu próprio ritmo</label>
        <input
          id="custom-minutes"
          name="minutes"
          type="number"
          min="1"
          max="480"
          defaultValue="30"
          required
        />
        <span>minutos</span>
        <button className="secondary" type="submit">
          Começar a estudar
        </button>
      </form>
      <div className="section-heading">
        <h2>Seu ambiente de estudos</h2>
        <span>{state.sites.filter((s) => s.enabled).length} sites autorizados</span>
      </div>
      <div className="site-shortcuts">
        {state.sites
          .filter((s) => s.enabled)
          .map((site) => (
            <button key={site.id} className="site-shortcut" onClick={() => begin(25, site.url)}>
              <span className="site-letter">{site.name.slice(0, 1).toUpperCase()}</span>
              <span>
                <strong>{site.name}</strong>
                <small>{new URL(site.url).hostname}</small>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
      </div>
      <div className="last-session">
        <span className="status-dot" />
        {last ? (
          <span>
            Última sessão · {new Date(last.start).toLocaleDateString('pt-BR')} ·{' '}
            {Math.floor(last.effectiveMs / 60000)} min de estudo
          </span>
        ) : (
          <span>Sua primeira sessão pode começar com apenas cinco minutos.</span>
        )}
      </div>
      {!state.settings.onboarded && (
        <Modal label="Configuração inicial">
          <section className="modal">
            <span className="brand-icon">
              <Leaf size={26} />
            </span>
            <h2>Bem-vindo ao seu StudyRoom.</h2>
            <p>
              O QConcursos já está autorizado. Entre com sua conta no próprio site e estude em um
              ambiente reservado.
            </p>
            <p>
              O modo forte oferece um intervalo de reflexão antes de sair. Ele não bloqueia outros
              aplicativos do computador.
            </p>
            <label>
              Objetivo diário (minutos)
              <input
                type="number"
                min="5"
                max="480"
                defaultValue={state.settings.dailyGoal}
                id="onboarding-goal"
              />
            </label>
            <button
              className="primary"
              onClick={() =>
                void run({
                  type: 'settings',
                  settings: {
                    onboarded: true,
                    dailyGoal: Number(
                      (document.getElementById('onboarding-goal') as HTMLInputElement).value,
                    ),
                  },
                })
              }
            >
              Preparar meu espaço <ArrowUpRight size={18} />
            </button>
          </section>
        </Modal>
      )}
    </>
  );
}

export function Modal({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const element = ref.current!;
    const focusable = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),textarea,select,[tabindex="0"]',
        ),
      );
    if (!element.contains(document.activeElement)) focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const all = focusable();
      const first = all[0],
        last = all[all.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    element.addEventListener('keydown', key);
    return () => {
      element.removeEventListener('keydown', key);
      before?.focus();
    };
  }, []);
  return (
    <div ref={ref} className="modal-backdrop" role="dialog" aria-modal="true" aria-label={label}>
      {children}
    </div>
  );
}
