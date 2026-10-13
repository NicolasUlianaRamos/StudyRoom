import { useEffect, useRef, useState } from 'react';
import { MAZE, MAZE_WIDTH, MAZE_HEIGHT, newMaze, stepMaze } from './maze';
import type { Direction } from './snake';

// Contorno dos blocos unidos, sem divisões entre células.
const wallOutline = MAZE.flatMap((row, y) =>
  [...row].flatMap((cell, x) => {
    if (cell !== '#') return [];
    const edges: string[] = [];
    const left = x * 20,
      top = y * 20;
    if (y > 0 && MAZE[y - 1][x] !== '#') edges.push(`M ${left} ${top} h 20`);
    if (y < MAZE_HEIGHT - 1 && MAZE[y + 1][x] !== '#') edges.push(`M ${left} ${top + 20} h 20`);
    if (x > 0 && row[x - 1] !== '#') edges.push(`M ${left} ${top} v 20`);
    if (x < MAZE_WIDTH - 1 && row[x + 1] !== '#') edges.push(`M ${left + 20} ${top} v 20`);
    return edges;
  }),
).join(' ');

export function MazeBreak({
  deadline,
  expired,
  suspended,
}: {
  deadline: number;
  expired: boolean;
  suspended: boolean;
}) {
  const [game, setGame] = useState(newMaze);
  const [playing, setPlaying] = useState(false);
  const direction = useRef<Direction>('left');
  const board = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pause = () => setPlaying(false);
    window.addEventListener('blur', pause);
    return () => window.removeEventListener('blur', pause);
  }, []);
  useEffect(() => {
    if (!playing || game.over || expired || suspended) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= deadline) return;
      setGame((current) => stepMaze(current, direction.current));
    }, 170);
    return () => window.clearInterval(timer);
  }, [playing, game.over, expired, suspended, deadline]);
  function start() {
    if (game.over) {
      setGame(newMaze());
      direction.current = 'left';
    }
    setPlaying(true);
    board.current?.focus();
  }
  const angle = { right: 0, down: 90, left: 180, up: 270 }[game.direction];
  return (
    <div className="snake-panel maze-panel">
      <div className="snake-heading">
        <strong>Pac-Man · Labirinto</strong>
        <span>
          Pontos: {game.score} · Vidas: {game.lives}
        </span>
      </div>
      <div
        className="snake-board maze-board"
        ref={board}
        tabIndex={0}
        role="group"
        aria-label="Labirinto. Use as setas ou WASD."
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
        <svg viewBox={`0 0 ${MAZE_WIDTH * 20} ${MAZE_HEIGHT * 20}`} aria-hidden="true">
          <path d={wallOutline} className="maze-wall" />
          {MAZE.flatMap((row, y) =>
            [...row].map((cell, x) =>
              cell === '-' ? (
                <path
                  key={`gate-${x}`}
                  d={`M ${x * 20} ${y * 20 + 10} h 20`}
                  className="maze-gate"
                />
              ) : null,
            ),
          )}
          {game.dots.map((key) => {
            const [x, y] = key.split(',').map(Number);
            return (
              <circle
                key={key}
                cx={x * 20 + 10}
                cy={y * 20 + 10}
                r={game.powers.includes(key) ? 5 : 2}
                className="maze-dot"
              />
            );
          })}
          <g
            className="maze-player"
            transform={`translate(${game.player.x * 20 + 10} ${game.player.y * 20 + 10}) rotate(${angle})`}
            opacity={game.shield > 0 && game.tick % 2 ? 0.6 : 1}
          >
            <path
              d={
                game.tick % 2 ? 'M 0 0 L 7 -5 A 9 9 0 1 0 7 5 Z' : 'M 0 0 L 8 -2 A 9 9 0 1 0 8 2 Z'
              }
              fill="#f4cb56"
            />
          </g>
          {game.ghosts.map((ghost, i) => (
            <g
              key={i}
              transform={`translate(${ghost.x * 20 + 10} ${ghost.y * 20 + 10})`}
              opacity={ghost.sleep > 0 ? 0.45 : 1}
            >
              <path
                d="M -8 8 V -1 A 8 8 0 0 1 8 -1 V 8 L 4 5 L 0 8 L -4 5 Z"
                fill={game.power > 0 ? '#779bed' : ['#ff4242', '#ffb8de', '#42e5ee', '#ffb852'][i]}
              />
              <circle cx="-3" cy="-1" r="2.4" fill="white" />
              <circle cx="3" cy="-1" r="2.4" fill="white" />
              <circle cx="-3" cy="0" r="1.1" fill="#192b30" />
              <circle cx="3" cy="0" r="1.1" fill="#192b30" />
            </g>
          ))}
        </svg>
        {(!playing || game.over || expired || suspended) && (
          <div className="snake-overlay">
            <strong>
              {expired
                ? 'Hora de voltar'
                : game.over
                  ? game.won
                    ? 'Todas as pastilhas!'
                    : 'Fim desta rodada'
                  : 'Explore o labirinto'}
            </strong>
            {!expired && !suspended && (
              <button className="primary" onClick={start}>
                {game.over ? 'Jogar de novo' : 'Continuar jogo'}
              </button>
            )}
          </div>
        )}
      </div>
      <small>
        Setas ou WASD · Pastilhas grandes permitem capturar os fantasmas por alguns segundos. Ao
        sair do tabuleiro, o jogo pausa. Use os túneis laterais para atravessar o mapa.
      </small>
    </div>
  );
}
