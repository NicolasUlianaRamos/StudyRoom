import { useState } from 'react';
import type { Snapshot } from './shared';

export function studyTime(ms: number) {
  const minutes = Math.floor(ms / 60000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}
const label = (date: string) =>
  new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function Statistics({ state }: { state: Snapshot }) {
  const [offset, setOffset] = useState(0);
  const week = state.statistics[offset];
  const peak = Math.max(60000, ...week.days.map((d) => d.effectiveMs));
  return (
    <>
      <div className="eyebrow">SEU TEMPO, SEM COMPARAÇÕES</div>
      <h1>Seu ritmo de estudo</h1>
      <p className="lead">Observe onde você dedicou atenção e ajuste seu próximo passo.</p>
      <section className="card settings-card">
        <div className="section-heading stats-heading">
          <div>
            <h2>{offset === 0 ? 'Esta semana' : 'Semana anterior'}</h2>
            <p>
              {label(week.days[0].date)} a {label(week.days[6].date)} · segunda a domingo
            </p>
          </div>
          <div className="actions">
            <button
              className="secondary"
              disabled={offset === state.statistics.length - 1}
              onClick={() => setOffset(offset + 1)}
            >
              Semana mais antiga
            </button>
            <button
              className="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(offset - 1)}
            >
              Semana mais recente
            </button>
          </div>
        </div>
        <div className="stats-grid">
          <div>
            <small>Tempo efetivo</small>
            <strong data-testid="weekly-effective">{studyTime(week.effectiveMs)}</strong>
          </div>
          <div>
            <small>Sessões iniciadas</small>
            <strong>{week.started}</strong>
          </div>
          <div>
            <small>Concluídas</small>
            <strong>{week.completed}</strong>
          </div>
          <div>
            <small>Encerradas antes do alvo</small>
            <strong>{week.interrupted}</strong>
          </div>
        </div>
        <p>
          {studyTime(week.plannedMs)} planejados nas sessões iniciadas nesta semana · {week.pauses}{' '}
          pausas nessas sessões.
        </p>
        {!week.started && !week.effectiveMs && (
          <p>
            Nenhum estudo registrado nesta semana. Seu próximo momento pode começar com cinco
            minutos.
          </p>
        )}
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Tempo efetivo</th>
                <th>Sessões iniciadas</th>
                <th>Tentativas bloqueadas</th>
              </tr>
            </thead>
            <tbody>
              {week.days.map((day) => (
                <tr key={day.date}>
                  <td>
                    {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'short',
                    })}{' '}
                    · {label(day.date)}
                  </td>
                  <td>
                    <div className="stats-time">
                      <progress
                        aria-label={'Tempo em ' + label(day.date)}
                        max={peak}
                        value={day.effectiveMs}
                      />
                      <span>{studyTime(day.effectiveMs)}</span>
                    </div>
                  </td>
                  <td>{day.started}</td>
                  <td>{day.blocks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="stats-note">
          O tempo exclui pausas e inclui a sessão em andamento. Novas sessões são divididas pelos
          dias em que você estudou. Quantidade, conclusão e pausas são atribuídas ao dia de início
          da sessão.
        </p>
        {week.legacySessions > 0 && (
          <p className="stats-note">
            {week.legacySessions} sessão(ões) anterior(es) a esta versão: tempo atribuído ao dia de
            início, pois os intervalos não foram registrados.
          </p>
        )}
      </section>
      <section className="card settings-card">
        <h2>Tempo por site nesta semana</h2>
        {!week.sites.length ? (
          <p>Os sites aparecerão após registrar tempo de estudo.</p>
        ) : (
          week.sites.map((site) => (
            <div className="setting-row" key={site.name}>
              <span>{site.name}</span>
              <strong>{studyTime(site.effectiveMs)}</strong>
            </div>
          ))
        )}
      </section>
      <p className="privacy">
        Dados locais de todos os perfis. Há oito semanas disponíveis. Tentativas bloqueadas usam
        registros dos últimos 30 dias; semanas anteriores podem não ter esses dados. Tempos são
        exibidos em minutos completos. Repetições consecutivas do mesmo domínio bloqueado contam
        como um registro.
      </p>
    </>
  );
}
