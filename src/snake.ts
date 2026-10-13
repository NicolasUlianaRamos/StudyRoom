export type Cell = { x: number; y: number };
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Snake = {
  body: Cell[];
  direction: Direction;
  food: Cell | null;
  score: number;
  over: boolean;
};
export const BOARD = 18;
const vectors: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export function foodFor(body: Cell[], random = Math.random): Cell | null {
  const free: Cell[] = [];
  for (let y = 0; y < BOARD; y++)
    for (let x = 0; x < BOARD; x++)
      if (!body.some((c) => c.x === x && c.y === y)) free.push({ x, y });
  return free.length ? free[Math.min(free.length - 1, Math.floor(random() * free.length))] : null;
}
export function newSnake(): Snake {
  const body = [
    { x: 6, y: 9 },
    { x: 5, y: 9 },
    { x: 4, y: 9 },
  ];
  return { body, direction: 'right', food: { x: 12, y: 9 }, score: 0, over: false };
}
export function stepSnake(game: Snake, requested: Direction, random = Math.random): Snake {
  if (game.over) return game;
  const old = vectors[game.direction],
    next = vectors[requested];
  const direction = old.x + next.x === 0 && old.y + next.y === 0 ? game.direction : requested;
  const v = vectors[direction],
    head = { x: game.body[0].x + v.x, y: game.body[0].y + v.y };
  const eats = game.food !== null && same(head, game.food);
  const obstacles = eats ? game.body : game.body.slice(0, -1);
  if (
    head.x < 0 ||
    head.y < 0 ||
    head.x >= BOARD ||
    head.y >= BOARD ||
    obstacles.some((c) => same(c, head))
  )
    return { ...game, over: true };
  const body = [head, ...game.body];
  if (!eats) body.pop();
  const food = eats ? foodFor(body, random) : game.food;
  return { body, direction, food, score: game.score + (eats ? 1 : 0), over: food === null };
}
