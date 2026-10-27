/**
 * This file describes all of the squares where the characters can
 * move to and fight in 
 */

import { Kombatant } from "./Kombatant";

export interface BattleSquare {
    x: number,
    y: number,
    accessible: boolean,
    occupiedBy?: Kombatant
}

export class BattleGrid {
  width: number;
  height: number;
  squares: BattleSquare[][];

  constructor(width: number, height: number, blockedSpots: [number, number][] = []) {
    this.width = width;
    this.height = height;
    this.squares = [];

    const obstacles = new Set(blockedSpots.map(([x, y]) => `${x},${y}`));

    for (let x = 0; x < width; x++) {
      this.squares[x] = [];
      for (let y = 0; y < height; y++) {
        this.squares[x][y] = {
          x,
          y,
          accessible: !obstacles.has(`${x},${y}`),
        };
      }
    }
  }

  isValidSquare(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}

export function getReachableCells(unit: Kombatant, grid: BattleGrid): BattleSquare[] {
  const reachable: BattleSquare[] = [];
  const visited = new Set<string>();
  const queue: { space: BattleSquare; dist: number }[] = [];

  const start = grid.squares[unit.gridX][unit.gridY];
  queue.push({ space: start, dist: 0 });
  visited.add(`${start.x},${start.y}`);

  const neighbors = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
  ];

  while (queue.length > 0) {
    const { space, dist } = queue.shift()!;
    if (dist > 0 && !space.occupiedBy) {
      reachable.push(space);
    }

    if (dist < unit.moveRange) {
      for (const n of neighbors) {
        const nx = space.x + n.dx;
        const ny = space.y + n.dy;

        if (grid.isValidSquare(nx, ny)) {
          const nextAdjacent = grid.squares[nx][ny];
          const key = `${nx},${ny}`;

          const canTraverse = nextAdjacent.accessible &&
            (!nextAdjacent.occupiedBy || nextAdjacent.occupiedBy === unit || nextAdjacent.occupiedBy.isPlayer === unit.isPlayer);

          if (!visited.has(key) && canTraverse) {
            visited.add(key);
            queue.push({ space: nextAdjacent, dist: dist + 1 });
          }
        }
      }
    }
  }

  return reachable;
}

export function findPath(unit: Kombatant, target: BattleSquare, grid: BattleGrid): BattleSquare[] {
  if (!target.accessible || (target.occupiedBy && target.occupiedBy !== unit)) {
    return [];
  }

  const queue: BattleSquare[] = [];
  const parentMap = new Map<string, BattleSquare | null>();
  const visited = new Set<string>();

  const start = grid.squares[unit.gridX][unit.gridY];
  const startKey = `${start.x},${start.y}`;
  queue.push(start);
  visited.add(startKey);
  parentMap.set(startKey, null);

  const neighbors = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
  ];

  let found = false;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === target.x && current.y === target.y) {
      found = true;
      break;
    }

    for (const n of neighbors) {
      const nx = current.x + n.dx;
      const ny = current.y + n.dy;

      if (grid.isValidSquare(nx, ny)) {
        const next = grid.squares[nx][ny];
        const key = `${nx},${ny}`;

        const canTraverse = next.accessible &&
          (!next.occupiedBy || next.occupiedBy === unit || next.occupiedBy.isPlayer === unit.isPlayer);

        if (!visited.has(key) && canTraverse) {
          visited.add(key);
          parentMap.set(key, current);
          queue.push(next);
        }
      }
    }
  }

  if (!found) return [];

  const path: BattleSquare[] = [];
  let curr: BattleSquare | null = target;
  while (curr) {
    path.unshift(curr);
    const key: string = `${curr.x},${curr.y}`;
    curr = parentMap.get(key) || null;
  }

  return path;
}

export function getAttackableCells(unit: Kombatant, grid: BattleGrid): BattleSquare[] {
  const attackable: BattleSquare[] = [];
  const range = unit.attackRange;

  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      if (Math.abs(dx) + Math.abs(dy) <= range && Math.abs(dx) + Math.abs(dy) > 0) {
        const nx = unit.gridX + dx;
        const ny = unit.gridY + dy;
        if (grid.isValidSquare(nx, ny) && grid.squares[nx][ny].accessible) {
          attackable.push(grid.squares[nx][ny]);
        }
      }
    }
  }

  return attackable;
}

export function getItemTargetCells(unit: Kombatant, grid: BattleGrid): BattleSquare[] {
  const itemCells: BattleSquare[] = [];
  const range = 1;

  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      if (Math.abs(dx) + Math.abs(dy) <= range) {
        const nx = unit.gridX + dx;
        const ny = unit.gridY + dy;
        if (grid.isValidSquare(nx, ny) && grid.squares[nx][ny].accessible) {
          itemCells.push(grid.squares[nx][ny]);
        }
      }
    }
  }

  return itemCells;
}