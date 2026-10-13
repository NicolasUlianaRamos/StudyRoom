import { describe, expect, it } from 'vitest';
import {
  MAZE,
  MAZE_WIDTH,
  MAZE_HEIGHT,
  TUNNEL_ROW,
  move,
  cellKey,
  newMaze,
  stepMaze,
  walkable,
} from '../src/maze';

describe('labirinto da pausa', () => {
  it('tem planta simétrica, túnel lateral e todas as pastilhas acessíveis', () => {
    expect(MAZE).toHaveLength(MAZE_HEIGHT);
    for (const [y, row] of MAZE.entries()) {
      expect(row).toHaveLength(MAZE_WIDTH);
      expect(row).toBe([...row].reverse().join(''));
      expect(row[0] + row.at(-1)).toBe(y === TUNNEL_ROW ? '  ' : '##');
    }
    expect(MAZE[0] + MAZE.at(-1)).toBe('#'.repeat(MAZE_WIDTH * 2));
    const game = newMaze(),
      queue = [game.player],
      seen = new Set([cellKey(game.player)]);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      for (const [dx, dy] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        const next = { x: p.x + dx, y: p.y + dy },
          key = cellKey(next);
        if (walkable(next) && !seen.has(key)) {
          seen.add(key);
          queue.push(next);
        }
      }
    }
    for (const dot of game.dots) expect(seen.has(dot), dot).toBe(true);
    expect(game.ghosts).toHaveLength(4);
  });
  it('respeita paredes, segue na direção atual e aceita a curva quando livre', () => {
    const next = stepMaze(newMaze(), 'up');
    expect(next.player).toEqual({ x: 12, y: 23 });
    expect(next.direction).toBe('left');
    expect(next.score).toBe(10);
    const curve = stepMaze({ ...next, player: { x: 12, y: 23 } }, 'up');
    expect(curve.player).toEqual({ x: 12, y: 22 });
    const blocked = stepMaze({ ...next, player: { x: 1, y: 1 }, direction: 'up' }, 'left');
    expect(blocked.player).toEqual({ x: 1, y: 1 });
  });
  it('retira uma vida e reposiciona ao encontrar um fantasma', () => {
    const game = newMaze();
    const hit = stepMaze(
      { ...game, shield: 0, ghosts: [{ x: 12, y: 23, sleep: 0 }, game.ghosts[1]] },
      'left',
    );
    expect(hit.lives).toBe(2);
    expect(hit.player).toEqual(game.player);
    expect(hit.shield).toBeGreaterThan(0);
  });
  it('pastilha especial permite capturar um fantasma e se esgota', () => {
    const game = newMaze();
    const power = stepMaze(
      {
        ...game,
        shield: 0,
        player: { x: 1, y: 2 },
        ghosts: [{ x: 1, y: 3, sleep: 0 }, game.ghosts[1]],
      },
      'down',
    );
    expect(power.lives).toBe(3);
    expect(power.score).toBe(150);
    expect(power.power).toBe(40);
    expect(power.powers).not.toContain('1,3');
    expect(power.ghosts[0].sleep).toBe(12);
    expect(stepMaze({ ...power, power: 1 }, 'right').power).toBe(0);
  });
  it('detecta colisão quando o fantasma entra na casa do jogador', () => {
    const game = newMaze();
    const next = stepMaze(
      { ...game, tick: 1, shield: 0, ghosts: [{ x: 11, y: 23, sleep: 0 }, game.ghosts[1]] },
      'left',
    );
    expect(next.lives).toBe(2);
  });
  it('encerra a rodada na última vida e mantém estado parado', () => {
    const game = newMaze();
    const next = stepMaze(
      { ...game, shield: 0, lives: 1, ghosts: [{ x: 12, y: 23, sleep: 0 }, game.ghosts[1]] },
      'left',
    );
    expect(next.over).toBe(true);
    expect(next.won).toBe(false);
    expect(stepMaze(next, 'up')).toBe(next);
  });
  it('vence ao coletar a última pastilha', () => {
    const next = stepMaze({ ...newMaze(), dots: ['12,23'] }, 'left');
    expect(next.won).toBe(true);
    expect(next.over).toBe(true);
  });
  it('atravessa os túneis nas duas direções e reserva a porta aos fantasmas', () => {
    expect(move({ x: 0, y: TUNNEL_ROW }, 'left')).toEqual({ x: MAZE_WIDTH - 1, y: TUNNEL_ROW });
    expect(
      stepMaze({ ...newMaze(), player: { x: MAZE_WIDTH - 1, y: TUNNEL_ROW } }, 'right').player,
    ).toEqual({ x: 0, y: TUNNEL_ROW });
    expect(walkable({ x: 13, y: 12 })).toBe(false);
    expect(walkable({ x: 13, y: 12 }, true)).toBe(true);
    let game = { ...newMaze(), shield: 1000 };
    for (let i = 0; i < 50; i++) game = stepMaze(game, 'left');
    for (const ghost of game.ghosts)
      expect(ghost.y < 13 || ghost.y > 15 || ghost.x < 10 || ghost.x > 17).toBe(true);
  });
});

