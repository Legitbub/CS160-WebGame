/**
 * This file helps convert the 2D top-down grid into a 2.5 type of view
 * via dimetric equations. This is how the camera and map can match the 
 * angle where characters move in diagonals (like Final Fantasy Tactics!)
 */

export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 16;

export function gridToScreen(x: number, y: number) {
  return {
    x: (x - y) * (TILE_WIDTH / 2),
    y: (x + y) * (TILE_HEIGHT / 2)
  };
}

export function screenToGrid(screenX: number, screenY: number) {
  const x = Math.floor((screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2);
  const y = Math.floor((screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2);
  return { x, y };
}

export function getTileCorners(x: number, y: number) {
  const top = gridToScreen(x, y);
  const right = gridToScreen(x + 1, y);
  const bottom = gridToScreen(x + 1, y + 1);
  const left = gridToScreen(x, y + 1);
  return { top, right, bottom, left };
}