// Shared types for the game layer. These are plain data — no Kaplay, no React —
// so the game logic stays easy to read and unit-test.

export interface Vec2 {
  x: number;
  y: number;
}

// A book as the GAME cares about it: just enough to draw a lectern and open it.
// (The full Book lives in shared/collections.ts; the React bridge maps one to this.)
export interface GameBook {
  id: string;
  title: string;
  coverStyle: 'oxblood' | 'forest' | 'plain';
  pos: Vec2;
}

// The two things the game tells the outside world about. The React wrapper
// listens for these and turns them into navigation / a save.
export interface GameEvents {
  onOpenBook(id: string): void;
  onLecternMoved(id: string, pos: Vec2): void;
}
