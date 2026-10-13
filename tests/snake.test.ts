import { describe, expect, it } from 'vitest';
import { BOARD, foodFor, newSnake, stepSnake } from '../src/snake';

describe('cobrinha da pausa', () => {
  it('impede meia-volta e mantém o tamanho ao andar', () => {
    const next = stepSnake(newSnake(), 'left');
    expect(next.body[0]).toEqual({ x: 7, y: 9 });
    expect(next.body).toHaveLength(3);
  });
  it('cresce e coloca a fruta fora do corpo', () => {
    const game = { ...newSnake(), food: { x: 7, y: 9 } };
    const next = stepSnake(game, 'right', () => 0);
    expect(next.score).toBe(1);
    expect(next.body).toHaveLength(4);
    expect(next.body).not.toContainEqual(next.food);
  });
  it('encerra ao bater na parede e permanece parado', () => {
    const game = { ...newSnake(), body: [{ x: BOARD - 1, y: 0 }] };
    const next = stepSnake(game, 'right');
    expect(next.over).toBe(true);
    expect(stepSnake(next, 'down')).toBe(next);
  });
  it('permite ocupar a cauda que está saindo, mas não o corpo', () => {
    const game = {
      ...newSnake(),
      direction: 'up' as const,
      body: [
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
        { x: 1, y: 2 },
      ],
    };
    expect(stepSnake(game, 'left').over).toBe(false);
    expect(stepSnake({ ...game, body: [...game.body, { x: 0, y: 2 }] }, 'left').over).toBe(true);
  });
  it('termina com vitória quando não sobra espaço para fruta', () => {
    const cells = Array.from({ length: BOARD * BOARD }, (_, i) => ({
      x: i % BOARD,
      y: Math.floor(i / BOARD),
    }));
    expect(foodFor(cells)).toBeNull();
    const next = stepSnake(
      { ...newSnake(), direction: 'left', body: cells.slice(1), food: cells[0] },
      'left',
    );
    expect(next.food).toBeNull();
    expect(next.over).toBe(true);
    expect(next.body).toHaveLength(BOARD * BOARD);
  });
});
