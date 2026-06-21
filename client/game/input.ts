import type { Vec2, GameBook } from './types';

// Turn four held keys into a movement direction. Diagonals are normalized so
// you don't walk faster on the diagonal, and opposing keys cancel out.
export function keysToVector(keys: {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}): Vec2 {
  const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const len = Math.hypot(x, y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

// Find the closest book within `radius` of the player (or null if none).
export function nearestWithin(player: Vec2, books: GameBook[], radius: number): GameBook | null {
  let best: GameBook | null = null;
  let bestDist = radius;
  for (const b of books) {
    const d = Math.hypot(b.pos.x - player.x, b.pos.y - player.y);
    if (d <= bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}
