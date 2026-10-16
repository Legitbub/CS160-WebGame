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

  constructor(width: number, height: number, blockedSpots: [number, number][]) {
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
    reachable.push(space);

    if (dist < unit.moveRange) {
      for (const n of neighbors) {
        const nx = space.x + n.dx;
        const ny = space.y + n.dy;

        if (grid.isValidSquare(nx, ny)) {
          const nextAdjacent = grid.squares[nx][ny];
          const key = `${nx},${ny}`;

          if (!visited.has(key) && nextAdjacent.accessible && !nextAdjacent.occupiedBy) {
            visited.add(key);
            queue.push({ space: nextAdjacent, dist: dist + 1 });
          }
        }
      }
    }
  }

  return reachable;
}