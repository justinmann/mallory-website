import { describe, it, expect } from 'vitest';
import { keysToVector, nearestWithin } from '../../client/game/input';

describe('keysToVector', () => {
  it('returns zero when idle', () =>
    expect(keysToVector({ up: false, down: false, left: false, right: false })).toEqual({ x: 0, y: 0 }));
  it('normalizes diagonals to length ~1', () => {
    const v = keysToVector({ up: true, down: false, left: false, right: true });
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 5);
  });
  it('cancels opposing keys', () =>
    expect(keysToVector({ up: true, down: true, left: false, right: false })).toEqual({ x: 0, y: 0 }));
});

describe('nearestWithin', () => {
  const books = [
    { id: 'a', title: 'A', coverStyle: 'oxblood' as const, pos: { x: 0, y: 0 } },
    { id: 'b', title: 'B', coverStyle: 'forest' as const, pos: { x: 100, y: 0 } },
  ];
  it('finds the closest within radius', () =>
    expect(nearestWithin({ x: 10, y: 0 }, books, 40)?.id).toBe('a'));
  it('returns null when none within radius', () =>
    expect(nearestWithin({ x: 50, y: 0 }, books, 20)).toBeNull());
});
