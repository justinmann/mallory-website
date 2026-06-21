import type { KAPLAYCtx, GameObj } from 'kaplay';
import type { GameBook, GameEvents, Vec2 } from '../types';
import { keysToVector, nearestWithin } from '../input';
import { spawnPlayer, PLAYER_SPEED } from '../entities/player';

// How close you must stand to a lectern before you can open its book.
const OPEN_RADIUS = 44;

export interface SceneHandle {
  setBooks(books: GameBook[]): void;
  pressAction(): void;
  destroy(): void;
}

interface Lectern {
  id: string;
  obj: GameObj;
}

export function startLibraryScene(
  k: KAPLAYCtx,
  initialBooks: GameBook[],
  events: GameEvents,
  getJoystick: () => Vec2,
): SceneHandle {
  // Tile the floor across the whole canvas.
  for (let x = 0; x < k.width(); x += 32) {
    for (let y = 0; y < k.height(); y += 32) {
      k.add([k.sprite('floor'), k.pos(x, y), k.z(0)]);
    }
  }

  const player = spawnPlayer(k, { x: k.width() / 2, y: k.height() / 2 });

  // EXTENSION POINT: spawn NPCs / decor here (e.g. k.add([k.sprite('wall'), k.pos(200, 120)])).

  let books = initialBooks;
  let lecterns: Lectern[] = [];
  let nearestId: string | null = null;
  let dragging: Lectern | null = null;

  // The bobbing "E" prompt shown above the nearest lectern.
  const prompt = k.add([
    k.text('E', { size: 18 }),
    k.pos(0, 0),
    k.anchor('center'),
    k.z(20),
    k.opacity(0),
  ]);

  function rebuild(): void {
    lecterns.forEach((l) => l.obj.destroy());
    lecterns = books.map((b) => ({
      id: b.id,
      obj: k.add([
        k.sprite(`lectern-${b.coverStyle}`),
        k.pos(b.pos.x, b.pos.y),
        k.anchor('center'),
        k.area(),
        k.z(5),
      ]),
    }));
  }
  rebuild();

  // Drag-to-place: press on a lectern, drag it, release to save its new spot.
  const onDown = k.onMouseDown('left', () => {
    if (!dragging) dragging = lecterns.find((l) => l.obj.isHovering()) ?? null;
    if (dragging) dragging.obj.pos = k.mousePos();
  });
  const onUp = k.onMouseRelease(() => {
    if (!dragging) return;
    events.onLecternMoved(dragging.id, { x: dragging.obj.pos.x, y: dragging.obj.pos.y });
    dragging = null;
  });

  const onUpdate = k.onUpdate(() => {
    // Keyboard movement; the on-screen joystick overrides it when in use.
    const keyVec = keysToVector({
      up: k.isKeyDown('w') || k.isKeyDown('up'),
      down: k.isKeyDown('s') || k.isKeyDown('down'),
      left: k.isKeyDown('a') || k.isKeyDown('left'),
      right: k.isKeyDown('d') || k.isKeyDown('right'),
    });
    const j = getJoystick();
    const v = j.x !== 0 || j.y !== 0 ? j : keyVec;
    player.move(v.x * PLAYER_SPEED, v.y * PLAYER_SPEED);

    // Highlight the nearest openable lectern with the prompt.
    const near = nearestWithin({ x: player.pos.x, y: player.pos.y }, books, OPEN_RADIUS);
    nearestId = near?.id ?? null;
    if (near) {
      prompt.opacity = 1;
      prompt.pos = k.vec2(near.pos.x, near.pos.y - 30);
    } else {
      prompt.opacity = 0;
    }
  });

  const onOpen = k.onKeyPress('e', () => {
    if (nearestId) events.onOpenBook(nearestId);
  });

  return {
    setBooks(next) {
      books = next;
      rebuild();
    },
    pressAction() {
      if (nearestId) events.onOpenBook(nearestId);
    },
    destroy() {
      onUpdate.cancel();
      onOpen.cancel();
      onDown.cancel();
      onUp.cancel();
    },
  };
}
