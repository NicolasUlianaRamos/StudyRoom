import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import type { Snapshot } from './shared';
import type { Run } from './components';
import { Profiles } from './Profiles';
export function Settings({ state, run }: { state: Snapshot; run: Run }) {
  const locked = !!state.active && state.active.status !== 'completed';
  return (
    <>
      <div className="eyebrow">UM AMBIENTE ESCOLHIDO POR VOCÊ</div>
      <h1>Sites e preferências</h1>
      <p className="lead">Abra espaço para o que importa no seu estudo.</p>
      {locked && (
        <div className="notice">
          <ShieldCheck size={19} /> Encerre a sessão conscientemente para alterar os sites ou as
          opções de foco.
        </div>
      )}
      <Profiles state={state} />
      <section className="card settings-card">
        <h2>Sites autorizados</h2>
        <p>Apenas HTTPS. Subdomínios precisam de autorização explícita.</p>
        {state.sites.map((site) => (
          <div className="site-row" key={site.id}>
            <div>
              <strong>{site.name}</strong>
              <small>
                {site.url}
                {site.subdomains ? ' · inclui subdomínios' : ''}
              </small>
            </div>
            <label className="toggle">
              <input
                aria-label={'Ativar ' + site.name}
                disabled={locked}
                type="checkbox"
                checked={site.enabled}
                onChange={() => void run({ type: 'site:toggle', id: site.id })}
              />
              Ativo
            </label>
            <button
              className="icon-button"
              disabled={locked}
              aria-label={'Excluir ' + site.name}
              onClick={() => void run({ type: 'site:remove', id: site.id })}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <form
          className="site-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);
            await run({
              type: 'site:add',
              name: String(data.get('name')),
              url: String(data.get('url')),
              subdomains: data.get('subdomains') === 'on',
            });
          }}
        >
          <label>
            Nome
            <input
              name="name"
              required
              maxLength={80}
              disabled={locked}
              placeholder="Minha plataforma"
            />
          </label>
          <label>
            Página inicial
            <input
              name="url"
              type="url"
              required
              disabled={locked}
              placeholder="https://exemplo.com/estudos"
            />
          </label>
          <label className="check">
            <input name="subdomains" type="checkbox" disabled={locked} />
            Permitir subdomínios deste endereço
          </label>
          <button className="secondary" disabled={locked}>
            <Plus size={17} />
            Adicionar site
          </button>
        </form>
      </section>
      <section className="card settings-card">
        <h2>Seu jeito de concentrar</h2>
        <div className="setting-row">
          <div>
            <strong>Proteção da sessão</strong>
            <small>Forte: motivo de saída e um breve intervalo de reflexão.</small>
          </div>
          <select
            aria-label="Proteção da sessão"
            disabled={locked}
            value={state.settings.mode}
            onChange={(e) =>
              void run({
                type: 'settings',
                settings: { mode: e.target.value as 'light' | 'strong' },
              })
            }
          >
            <option value="light">Leve · saída livre</option>
            <option value="strong">Forte · saída consciente</option>
          </select>
        </div>
        <div className="setting-row">
          <label htmlFor="reflection">Intervalo de reflexão</label>
          <select
            id="reflection"
            disabled={locked}
            value={state.settings.reflectionSeconds}
            onChange={(e) =>
              void run({
                type: 'settings',
                settings: { reflectionSeconds: Number(e.target.value) },
              })
            }
          >
            {[5, 10, 20, 30, 60].map((n) => (
              <option key={n} value={n}>
                {n} segundos
              </option>
            ))}
          </select>
        </div>
        <div className="setting-row">
          <label htmlFor="goal">Objetivo diário</label>
          <select
            id="goal"
            disabled={locked}
            value={state.settings.dailyGoal}
            onChange={(e) =>
              void run({ type: 'settings', settings: { dailyGoal: Number(e.target.value) } })
            }
          >
            {Array.from(new Set([15, 30, 60, 90, 120, 180, state.settings.dailyGoal]))
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {n} minutos
                </option>
              ))}
          </select>
        </div>
        <div className="setting-row">
          <label htmlFor="theme">Aparência</label>
          <select
            id="theme"
            value={state.settings.theme}
            onChange={(e) =>
              void run({
                type: 'settings',
                settings: { theme: e.target.value as 'light' | 'dark' },
              })
            }
          >
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
          </select>
        </div>
      </section>
      <p className="privacy">
        <ShieldCheck size={17} /> Seus dados ficam neste computador. Sem conta StudyRoom e sem
        telemetria.
      </p>
    </>
  );
}
export function History({ state }: { state: Snapshot }) {
  return (
    <>
      <div className="eyebrow">ATENÇÃO, SEM COMPETIÇÃO</div>
      <h1>Seus momentos de foco</h1>
      <p className="lead">Um registro simples do tempo que você dedicou a estudar.</p>
      <section className="card settings-card">
        {!state.history.length ? (
          <p>Suas sessões aparecerão aqui quando você começar.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Site</th>
                <th>Planejado</th>
                <th>Efetivo</th>
                <th>Pausas</th>
                <th>Sessão</th>
              </tr>
            </thead>
            <tbody>
              {state.history.map((s) => (
                <tr key={s.id}>
                  <td>
                    {new Date(s.start).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td>
                    {s.site}
                    {s.pdfName && <small className="session-topic">{s.pdfName}</small>}
                    {s.profileName && (
                      <small className="session-topic">Perfil: {s.profileName}</small>
                    )}
                    {s.topicName && (
                      <small className="session-topic">
                        {s.subjectName} · {s.topicName}
                      </small>
                    )}
                  </td>
                  <td>{Math.round(s.plannedMs / 60000)} min</td>
                  <td>{Math.floor(s.effectiveMs / 60000)} min</td>
                  <td>{s.pauses}</td>
                  <td>
                    {
                      {
                        running: 'Em estudo',
                        paused: 'Em pausa',
                        completed: 'Concluída',
                        interrupted: 'Encerrada',
                      }[s.status]
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
