import { useEffect, useRef, useState } from 'react';
import { Coffee, Gamepad2, Play } from 'lucide-react';
import { duration } from './components';
import { BOARD, newSnake, stepSnake, type Direction } from './snake';

export function StudyBreak({
  resume,
  plan,
  recovered,
  suspended,
}: {
  resume: () => Promise<void>;
  plan: () => void;
  recovered: boolean;
  suspended: boolean;
}) {
  const [minutes, setMinutes] = useState(3);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const [mode, setMode] = useState<'rest' | 'snake' | null>(null);
  const [game, setGame] = useState(newSnake);
  const [playing, setPlaying] = useState(false);
  const direction = useRef<Direction>('right');
  const board = useRef<HTMLDivElement>(null);
  const remaining = deadline === null ? minutes * 60_000 : Math.max(0, deadline - now);
  const expired = deadline !== null && remaining === 0;
  useEffect(() => {
    const pause = () => setPlaying(false);
    window.addEventListener('blur', pause);
    return () => window.removeEventListener('blur', pause);
  }, []);
  useEffect(() => {
    if (deadline === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [deadline]);
  useEffect(() => {
    if (!playing || game.over || mode !== 'snake' || expired || suspended) return;
    const timer = window.setInterval(() => {
      if (deadline !== null && Date.now() >= deadline) {
        setNow(Date.now());
        return;
      }
      setGame((current) => stepSnake(current, direction.current));
    }, 160);
    return () => window.clearInterval(timer);
  }, [playing, game.over, mode, expired, suspended, deadline]);
  function choose(value: 'rest' | 'snake') {
    if (deadline === null) {
      const start = Date.now();
      setNow(start);
      setDeadline(start + minutes * 60_000);
    }
    setMode(value);
    setPlaying(false);
  }
  function start() {
    if (game.over) {
      setGame(newSnake());
      direction.current = 'right';
    }
    setPlaying(true);
    board.current?.focus();
  }
  return (
    <section className="study-break" aria-label="Pausa do estudo">
      <div className="break-copy">
        <span className="eyebrow">UM RESPIRO NO CAMINHO</span>
        <h1>Uma pausa também faz parte.</h1>
        <p>O tempo de estudo está pausado. Escolha como descansar.</p>
        {recovered && (
          <p className="notice">
            Sua sessão foi recuperada em segurança. O tempo com o aplicativo fechado não foi
            contabilizado.
          </p>
        )}
        <div className="break-clock" role="timer" aria-label="Tempo restante da pausa">
          {duration(remaining)}
        </div>
        {!deadline && (
          <div className="break-options" aria-label="Duração da pausa">
            {[3, 5].map((value) => (
              <button
                key={value}
                className="secondary"
                aria-pressed={minutes === value}
                onClick={() => setMinutes(value)}
              >
                {value} minutos
              </button>
            ))}
          </div>
        )}
        {expired ? (
          <p className="break-finished" role="status">
            Pausa concluída. Vamos voltar ao estudo?
          </p>
        ) : (
          <div className="break-options">
            <button
              className="secondary"
              aria-pressed={mode === 'rest'}
              onClick={() => choose('rest')}
            >
              <Coffee size={17} />
              Descansar
            </button>
            <button
              className="secondary"
              aria-pressed={mode === 'snake'}
              onClick={() => choose('snake')}
            >
              <Gamepad2 size={17} />
              Jogar cobrinha
            </button>
          </div>
        )}
        {mode === 'rest' && !expired && (
          <p className="rest-copy">
            Solte os ombros, olhe para longe da tela e respire no seu ritmo.
          </p>
        )}
        <button className="primary" onClick={() => void resume()}>
          Retomar meu estudo <Play size={17} />
        </button>
        <button className="text-button" onClick={plan}>
          Abrir planejador
        </button>
      </div>
      {mode === 'snake' && (
        <div className="snake-panel">
          <div className="snake-heading">
            <strong>Cobrinha</strong>
            <span>Frutas: {game.score}</span>
          </div>
          <div
            ref={board}
            className="snake-board"
            tabIndex={0}
            role="group"
            aria-label="Tabuleiro da cobrinha. Use as setas ou WASD."
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setPlaying(false);
            }}
            onKeyDown={(event) => {
              const keys: Record<string, Direction> = {
                ArrowUp: 'up',
                w: 'up',
                ArrowDown: 'down',
                s: 'down',
                ArrowLeft: 'left',
                a: 'left',
                ArrowRight: 'right',
                d: 'right',
              };
              const next = keys[event.key] ?? keys[event.key.toLowerCase()];
              if (next) {
                event.preventDefault();
                direction.current = next;
              }
            }}
          >
            <svg viewBox={`0 0 ${BOARD * 10} ${BOARD * 10}`} aria-hidden="true">
              {game.body.map((cell, i) => (
                <rect
                  key={i}
                  x={cell.x * 10 + 1}
                  y={cell.y * 10 + 1}
                  width="8"
                  height="8"
                  rx="2"
                  className={i === 0 ? 'snake-head' : 'snake-body'}
                />
              ))}
              {game.food && (
                <circle
                  cx={game.food.x * 10 + 5}
                  cy={game.food.y * 10 + 5}
                  r="3.5"
                  className="snake-food"
                />
              )}
            </svg>
            {(!playing || game.over || expired || suspended) && (
              <div className="snake-overlay">
                <strong>
                  {expired
                    ? 'Hora de voltar'
                    : game.over
                      ? game.food === null
                        ? 'Tabuleiro completo!'
                        : 'Fim desta rodada'
                      : 'Um pequeno intervalo'}
                </strong>
                {!expired && !suspended && (
                  <button className="primary" onClick={start}>
                    {game.over ? 'Jogar de novo' : 'Continuar jogo'}
                  </button>
                )}
              </div>
            )}
          </div>
          <small>Setas ou WASD · Ao sair do tabuleiro, o jogo pausa.</small>
        </div>
      )}
    </section>
  );
}
