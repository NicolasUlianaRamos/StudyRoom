import type { Cell, Direction } from './snake';

// Planta simétrica, casa central e túnel lateral na linha 14.
export const MAZE = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '######.##### ## #####.######',
  '######.##          ##.######',
  '######.## ###--### ##.######',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '######.## ######## ##.######',
  '######.##          ##.######',
  '######.## ######## ##.######',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];
export const MAZE_WIDTH = 28;
export const MAZE_HEIGHT = 31;
export const TUNNEL_ROW = 14;
export const PLAYER_START: Cell = { x: 13, y: 23 };
export const GHOST_STARTS: Cell[] = [
  { x: 13, y: 11 },
  { x: 13, y: 14 },
  { x: 11, y: 14 },
  { x: 16, y: 14 },
];
const vectors: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const directions = Object.keys(vectors) as Direction[];
export const cellKey = (p: Cell) => `${p.x},${p.y}`;
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export const walkable = (p: Cell, ghost = false) =>
  p.x >= 0 &&
  p.y >= 0 &&
  p.x < MAZE_WIDTH &&
  p.y < MAZE_HEIGHT &&
  MAZE[p.y][p.x] !== '#' &&
  (ghost || MAZE[p.y][p.x] !== '-');
export function move(p: Cell, d: Direction): Cell {
  const next = { x: p.x + vectors[d].x, y: p.y + vectors[d].y };
  if (next.y === TUNNEL_ROW) next.x = (next.x + MAZE_WIDTH) % MAZE_WIDTH;
  return next;
}
export type Ghost = Cell & { sleep: number };
export type MazeGame = {
  player: Cell;
  direction: Direction;
  ghosts: Ghost[];
  dots: string[];
  powers: string[];
  score: number;
  lives: number;
  tick: number;
  power: number;
  shield: number;
  over: boolean;
  won: boolean;
};
export function newMaze(): MazeGame {
  const dots: string[] = [],
    powers: string[] = [];
  MAZE.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell === '.' || cell === 'o') dots.push(cellKey({ x, y }));
      if (cell === 'o') powers.push(cellKey({ x, y }));
    }),
  );
  return {
    player: { ...PLAYER_START },
    direction: 'left',
    ghosts: GHOST_STARTS.map((p, i) => ({ ...p, sleep: 8 + i * 5 })),
    dots,
    powers,
    score: 0,
    lives: 3,
    tick: 0,
    power: 0,
    shield: 10,
    over: false,
    won: false,
  };
}
function distances(target: Cell): Map<string, number> {
  const result = new Map([[cellKey(target), 0]]),
    queue = [target];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const d of directions) {
      const next = move(current, d),
        key = cellKey(next);
      if (walkable(next, true) && !result.has(key)) {
        result.set(key, result.get(cellKey(current))! + 1);
        queue.push(next);
      }
    }
  }
  return result;
}
export function stepMaze(game: MazeGame, wanted: Direction): MazeGame {
  if (game.over) return game;
  // Uma direção pedida antes da esquina permanece na interface até ser possível virar.
  const direction = walkable(move(game.player, wanted)) ? wanted : game.direction;
  const candidate = move(game.player, direction),
    player = walkable(candidate) ? candidate : game.player;
  const key = cellKey(player),
    ate = game.dots.includes(key),
    powered = game.powers.includes(key);
  const power = powered ? 40 : Math.max(0, game.power - 1),
    tick = game.tick + 1;
  const dots = ate ? game.dots.filter((dot) => dot !== key) : game.dots;
  const powers = powered ? game.powers.filter((dot) => dot !== key) : game.powers;
  let score = game.score + (ate ? (powered ? 50 : 10) : 0);
  const map = distances(player);
  const exitMap = distances({ x: 13, y: 11 });
  const ghosts = game.ghosts.map((ghost, index) => {
    if (ghost.sleep > 0) return { ...ghost, sleep: ghost.sleep - 1 };
    if (tick % 2 !== 0) return ghost;
    const leavingHouse = ghost.x >= 10 && ghost.x <= 17 && ghost.y >= 12 && ghost.y <= 15;
    const options = directions
      .map((d) => move(ghost, d))
      .filter((p) => walkable(p, true) && (leavingHouse || MAZE[p.y][p.x] !== '-'));
    // Em potência fogem; o segundo fantasma alterna perseguição e dispersão.
    const flee = !leavingHouse && (power > 0 || (index === 1 && tick % 48 < 16));
    const targetMap = leavingHouse ? exitMap : map;
    options.sort(
      (a, b) =>
        ((targetMap.get(cellKey(a)) ?? 999) - (targetMap.get(cellKey(b)) ?? 999)) * (flee ? -1 : 1),
    );
    return { ...(options[0] ?? ghost), sleep: 0 };
  });
  let hit = false;
  ghosts.forEach((ghost, index) => {
    const old = game.ghosts[index];
    const collides =
      same(player, old) || same(player, ghost) || (same(game.player, ghost) && same(player, old));
    if (!collides || old.sleep > 0) return;
    if (power > 0) {
      ghosts[index] = { ...GHOST_STARTS[index], sleep: 12 };
      score += 100;
    } else if (game.shield === 0) hit = true;
  });
  const lives = game.lives - (hit ? 1 : 0),
    won = dots.length === 0;
  return {
    player: hit ? { ...PLAYER_START } : player,
    direction: hit ? 'left' : direction,
    ghosts: hit ? GHOST_STARTS.map((p) => ({ ...p, sleep: 8 })) : ghosts,
    dots,
    powers,
    score,
    lives,
    tick,
    power: hit ? 0 : power,
    shield: hit ? 10 : Math.max(0, game.shield - 1),
    over: lives === 0 || won,
    won,
  };
}
