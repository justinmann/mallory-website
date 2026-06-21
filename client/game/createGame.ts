import kaplay from 'kaplay';
import type { GameBook, GameEvents, Vec2 } from './types';
import { SPRITES } from './assets/manifest';
import { startLibraryScene, type SceneHandle } from './scenes/library';

export interface GameController {
  setBooks(books: GameBook[]): void;
  pressAction(): void;
  destroy(): void;
}

// Boots Kaplay onto a <canvas> and starts the library scene once sprites load.
// Browser-only: only ever import this from client code, never the server.
export function createGame(opts: {
  canvas: HTMLCanvasElement;
  books: GameBook[];
  events: GameEvents;
  getJoystick?: () => Vec2;
}): GameController {
  const k = kaplay({
    canvas: opts.canvas,
    global: false, // don't attach to window — keeps it self-contained + SSR-safe
    background: [18, 12, 8], // dark-academia near-black
    pixelDensity: 2,
  });

  for (const [name, url] of Object.entries(SPRITES)) k.loadSprite(name, url);

  const getJoystick = opts.getJoystick ?? ((): Vec2 => ({ x: 0, y: 0 }));
  let scene: SceneHandle | null = null;

  // Wait for sprites to finish loading, then build the room.
  k.onLoad(() => {
    scene = startLibraryScene(k, opts.books, opts.events, getJoystick);
  });

  return {
    setBooks(books) {
      scene?.setBooks(books);
    },
    pressAction() {
      scene?.pressAction();
    },
    destroy() {
      scene?.destroy();
      k.quit();
    },
  };
}
