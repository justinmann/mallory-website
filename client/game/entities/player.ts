import type { KAPLAYCtx, GameObj } from 'kaplay';

// How fast the character walks, in pixels per second.
// TRY THIS: change 160 to 80 (slow stroll) or 300 (zoomy) and save.
export const PLAYER_SPEED = 160;

// Create the player object at a position and hand it back so the scene can move it.
export function spawnPlayer(k: KAPLAYCtx, at: { x: number; y: number }): GameObj {
  return k.add([
    k.sprite('player'),
    k.pos(at.x, at.y),
    k.anchor('center'),
    k.area(),
    k.z(10),
    'player',
  ]);
}
