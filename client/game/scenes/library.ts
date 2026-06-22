import type { KAPLAYCtx, GameObj } from 'kaplay';
import type { GameBook, GameEvents, Vec2 } from '../types';
import { keysToVector, nearestWithin } from '../input';
import { spawnPlayer, PLAYER_SPEED } from '../entities/player';

// How close you must stand to a lectern before you can open its book.
const OPEN_RADIUS = 48;

export interface SceneHandle {
  setBooks(books: GameBook[]): void;
  pressAction(): void;
  destroy(): void;
}

// A lectern on screen. `book.pos` holds its EFFECTIVE position (saved spot, or
// an auto-assigned grid slot) — kept in sync with the sprite so the "press E"
// proximity check and the visible lectern always agree.
interface Lectern {
  book: GameBook;
  obj: GameObj;
}

// ─── Room art ───────────────────────────────────────────────────────────────
// Draws the dark-academia library: wood floor, a back wall with arched moonlit
// windows and a bookshelf, an oxblood rug, and candle glow. All code-drawn so
// there are no art assets to manage yet — tweak freely.
function drawRoom(k: KAPLAYCtx): { wallH: number } {
  const W = k.width();
  const H = k.height();
  const wallH = Math.round(H * 0.42);

  // Wood floor across the whole canvas.
  for (let x = 0; x < W; x += 32) {
    for (let y = 0; y < H; y += 32) {
      k.add([k.sprite('floor'), k.pos(x, y), k.z(0)]);
    }
  }

  // Back wall + baseboard.
  k.add([k.rect(W, wallH), k.pos(0, 0), k.color(26, 21, 16), k.z(1)]);
  k.add([k.rect(W, 6), k.pos(0, wallH - 6), k.color(10, 7, 6), k.z(2)]);

  // Two arched, moonlit windows with a soft glow behind each.
  for (const wx of [W * 0.2, W * 0.8]) {
    k.add([k.circle(70), k.pos(wx, wallH * 0.5), k.anchor('center'), k.color(150, 180, 210), k.opacity(0.1), k.z(1)]);
    k.add([
      k.rect(92, Math.min(150, wallH * 0.7), { radius: 46 }),
      k.pos(wx, wallH * 0.45),
      k.anchor('center'),
      k.color(38, 52, 68),
      k.outline(8, k.rgb(12, 9, 6)),
      k.z(2),
    ]);
  }

  // A towering bookshelf in the middle of the back wall.
  drawShelf(k, W * 0.5, wallH * 0.46, 180, Math.min(170, wallH * 0.8));

  // Worn oxblood rug on the floor (a flattened circle).
  k.add([
    k.circle(150),
    k.pos(W * 0.5, wallH + (H - wallH) * 0.5),
    k.anchor('center'),
    k.color(94, 43, 43),
    k.opacity(0.45),
    k.scale(1.7, 0.75),
    k.z(1),
  ]);

  // Candle pools of light on the floor.
  for (const cx of [W * 0.12, W * 0.88]) {
    k.add([k.circle(95), k.pos(cx, wallH + 70), k.anchor('center'), k.color(255, 200, 110), k.opacity(0.08), k.z(2)]);
  }

  return { wallH };
}

function drawShelf(k: KAPLAYCtx, cx: number, cy: number, w: number, h: number): void {
  k.add([k.rect(w, h), k.pos(cx, cy), k.anchor('center'), k.color(18, 12, 8), k.outline(5, k.rgb(8, 6, 4)), k.z(1)]);
  const palette: [number, number, number][] = [
    [94, 43, 43], [39, 56, 44], [58, 32, 52], [122, 90, 42], [43, 80, 74], [110, 58, 58],
  ];
  const rows = 3;
  const perRow = 8;
  const rowH = (h - 12) / rows;
  const spineW = (w - 12) / perRow;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < perRow; i++) {
      const c = palette[(r * perRow + i) % palette.length]!;
      const sh = rowH - 8 - ((i * 7 + r * 13) % 16);
      const x = cx - w / 2 + 6 + i * spineW;
      const y = cy - h / 2 + 6 + r * rowH + (rowH - sh) - 4;
      k.add([k.rect(spineW - 2, sh, { radius: 1 }), k.pos(x, y), k.color(c[0], c[1], c[2]), k.opacity(0.85), k.z(2)]);
    }
  }
}

// Visible grid slots in the floor area for lecterns that haven't been placed yet.
function computeSlots(k: KAPLAYCtx): Vec2[] {
  const W = k.width();
  const H = k.height();
  const top = H * 0.42 + 80;
  const bottom = H - 90;
  const cols = 4;
  const rows = 2;
  const slots: Vec2[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = W * 0.5 + (c - (cols - 1) / 2) * (W * 0.19);
      const y = top + r * ((bottom - top) / (rows - 1));
      slots.push({ x, y });
    }
  }
  return slots;
}

export function startLibraryScene(
  k: KAPLAYCtx,
  initialBooks: GameBook[],
  events: GameEvents,
  getJoystick: () => Vec2,
): SceneHandle {
  const { wallH } = drawRoom(k);

  // Player starts in the middle of the floor (not behind the wall).
  const player = spawnPlayer(k, { x: k.width() / 2, y: wallH + (k.height() - wallH) / 2 });

  // EXTENSION POINT: spawn NPCs / decor here.

  let books = initialBooks;
  let lecterns: Lectern[] = [];
  let nearestId: string | null = null;
  let dragging: Lectern | null = null;

  // The "E" prompt shown above the nearest lectern.
  const prompt = k.add([k.text('E', { size: 18 }), k.pos(0, 0), k.anchor('center'), k.z(20), k.opacity(0)]);

  function rebuild(): void {
    lecterns.forEach((l) => l.obj.destroy());
    const slots = computeSlots(k);
    lecterns = books.map((b, i) => {
      // Use the saved spot if it's been placed; otherwise drop it on a visible grid slot.
      const placed = b.pos.x !== 0 || b.pos.y !== 0;
      const pos = placed ? b.pos : (slots[i % slots.length] ?? { x: k.width() / 2, y: k.height() / 2 });
      const obj = k.add([
        k.sprite(`lectern-${b.coverStyle}`),
        k.pos(pos.x, pos.y),
        k.anchor('center'),
        k.area(),
        k.z(5),
      ]);
      return { book: { ...b, pos }, obj };
    });
  }
  rebuild();

  // Drag-to-place: press on a lectern, drag it, release to save its new spot.
  const onDown = k.onMouseDown('left', () => {
    if (!dragging) dragging = lecterns.find((l) => l.obj.isHovering()) ?? null;
    if (dragging) {
      dragging.obj.pos = k.mousePos();
      dragging.book.pos = { x: dragging.obj.pos.x, y: dragging.obj.pos.y };
    }
  });
  const onUp = k.onMouseRelease(() => {
    if (!dragging) return;
    events.onLecternMoved(dragging.book.id, { x: dragging.obj.pos.x, y: dragging.obj.pos.y });
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

    // Nearest openable lectern, using each lectern's effective position.
    const near = nearestWithin({ x: player.pos.x, y: player.pos.y }, lecterns.map((l) => l.book), OPEN_RADIUS);
    nearestId = near?.id ?? null;
    if (near) {
      prompt.opacity = 1;
      prompt.pos = k.vec2(near.pos.x, near.pos.y - 34);
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
