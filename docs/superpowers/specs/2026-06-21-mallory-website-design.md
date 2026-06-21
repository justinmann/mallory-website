# mallory-website — Design

**Date:** 2026-06-21
**Status:** Approved (pending spec review)
**Repo:** `mallory-website` (new ugly-app project, sibling to `ugly-app`)
**Production domain:** `listentothiscrazypersontalkaboutstuff.xyz`

## 1. Summary

A cozy, dark-academia **library writing toy**. The visitor walks a candlelit 2D
library, approaches a glowing lectern, and opens a **book** to read or write in.
Books are private by default and can be shared to specific users or made fully
public.

The project is explicitly a **learning skeleton**: a basic functional app the
owner uses to learn web game development. The walkable library is built with a
beginner-friendly game engine (Kaplay/Kaboom.js) and lives in a small,
heavily-commented folder. The non-game features — book typing, page viewing,
persistence, auth, sharing — use standard ugly-app capabilities.

**Goal:** "basic functional skeleton" — working end-to-end on desktop and
mobile, with obvious seams to extend. Not a finished game.

## 2. Aesthetic

Dark academia: candlelit, moody, low-key. Deep charcoal walls, arched moonlit
windows, towering shelves, worn oxblood rug, brass accents, weathered leather
books, aged ivory paper. Two reference mocks were produced and approved during
brainstorming (a walkable library scene and a two-page open-book spread).

## 3. Stack & Architecture

Standard ugly-app: React SPA client, `shared/` collections + API definitions,
auth, deploys to Cloudflare Workers.

### Pages (`shared/pages.ts` → `client/allPages.ts`)
- **`library`** — the Kaplay game canvas (the world). Default landing page.
- **`book/:bookId`** — the open-book reading/writing view.

Navigation: opening a book = `useRouter().push('book', { bookId })`. `Esc` or
browser back returns to the library.

## 4. The Game (Kaplay) — built for learning

Engine: **Kaplay (Kaboom.js)** — chosen for beginner-friendliness and the
fastest path to a working game. Visuals use **pixel sprite assets** from the
start (placeholder pixel art included), loaded via Kaplay's sprite/tilemap
loaders, so asset loading is part of the first lesson.

Code organized into small, commented files under `client/game/`:

- `createGame.ts` — boots the Kaplay context onto a `<canvas>`. **Browser-only**:
  guarded so it never executes during SSR / the Workers build (Kaplay touches
  `window`/`canvas`). Mounted/torn down by a React `LibraryGame` component in a
  `useEffect`.
- `assets/` — placeholder pixel-art PNGs (player sprite sheet, lectern, floor &
  wall tiles) + a manifest loaded at boot.
- `scenes/library.ts` — draws floor/walls/shelves/windows from tiles, spawns one
  **lectern per book** (data fetched from ugly-app), candlelight ambiance.
- `entities/player.ts` — the character sprite + movement / facing.
- `controls/joystick.ts` — input layer producing a single movement vector:
  - **Desktop:** WASD / arrow keys to move, `E` to open the nearest lectern.
  - **Mobile:** on-screen **virtual joystick** (corner) + a tap action button.
- Proximity to a lectern shows the bobbing `E to open` prompt and triggers the
  route change to that book.
- **Drag to place:** lecterns can be dragged to reposition them in the room;
  the new position is persisted to the book's `lecternPos` via `updateBook`.

### `LibraryGame` React component
Owns the `<canvas>`, creates the Kaplay instance on mount with the current
user's books, and destroys it on unmount. Re-spawns lecterns when the book list
changes.

## 5. Books (standard ugly-app)

### Collection: `book`
| field | type | notes |
|---|---|---|
| `_id` | string | |
| `ownerId` | string | owner user id |
| `title` | string | |
| `coverStyle` | string | enum-ish: `oxblood` \| `forest` \| `plain` … → lectern/cover color |
| `pages` | string[] | one markdown string per page |
| `lecternPos` | `{ x: number, y: number }` | position in the library |
| `sharing` | `{ visibility: 'private' \| 'specific' \| 'public', sharedWith: string[] }` | |
| `createdAt` / `updatedAt` | number | `dbDefaults()` |

Indexes: `ownerId`; `sharing.visibility` (for public discovery later).

### Endpoints (`shared/api.ts`, handlers in `server/index.ts` + `server/workers.ts`)
- `listMyBooks` (auth) — books owned by the user.
- `getBook` (public, userId may be null) — returns a book if: owner, or
  `visibility === 'public'`, or `visibility === 'specific'` and the user is in
  `sharedWith`. Otherwise 403/empty.
- `createBook` (auth) — new book, default `private`, auto-assigned starting
  `lecternPos`.
- `updateBook` (auth, owner-only) — saves `title` / `pages` / `coverStyle` /
  `lecternPos` / `sharing`.
- `deleteBook` (auth, owner-only).

> Note: ugly-app deploys `server/workers.ts` (a separate handler map) in prod —
> every endpoint must be registered in **both** `server/index.ts` and
> `server/workers.ts`, or the Worker returns "not registered".

### Book view (`book/:bookId` page)
- Renders the ugly-app `MarkdownEditor` inside the two-page book chrome from the
  mock (brass-bound oxblood cover, aged paper, page-turn arrows).
- **Multi-page:** flip between entries in the `pages` array; the editor edits the
  current page's markdown. Page-turn arrows + page numbers.
- **Size from headings only:** no separate font/size controls — text size comes
  purely from markdown headings (`#`, `##`). One global book font.
- **Sharing pills** (Private / Specific / Public) in the toolbar call
  `updateBook`. "Specific" reveals a simple user-id/email input to populate
  `sharedWith`.
- Autosave (debounced) via `updateBook`.

## 6. Desktop & Mobile

- **Desktop:** keyboard movement + `E`; mouse for menus and drag-to-place.
- **Mobile:** virtual joystick + action button for the game; touch for the
  markdown editor and sharing UI. Responsive book chrome (single page stacked on
  narrow screens if needed).

## 7. Skeleton Scope (what "basic functional" means)

**In scope (must work end-to-end):**
walk the library · open a book · write markdown across multiple pages · autosave ·
create a book · delete a book · drag a lectern to reposition · toggle sharing
(private / specific / public) · works on desktop (keyboard) and mobile (joystick).
One built-in starter character and room. Pixel-art placeholders for all sprites.

**Out of scope (left as labeled extension points for learning):**
NPCs, dialogue, day/night cycle, inventory, quests/progression, multiplayer
presence in the room, custom sprite uploads, audio. The code leaves obvious seams
(e.g. an empty `entities/` for new actors, a comment in `scenes/library.ts` where
NPCs would spawn).

## 8. Units & Boundaries

- **Game core** (`client/game/*`) — knows about Kaplay, sprites, input, the room.
  Receives a plain `Book[]` (id, title, coverStyle, lecternPos) and emits two
  events: "open book X" and "lectern X moved to (x,y)". Knows nothing about the
  API or React.
- **`LibraryGame` React wrapper** — bridges game events to ugly-app
  (`useRouter`, `updateBook`) and feeds the book list in.
- **Book API** (`shared/api.ts` + handlers) — persistence + sharing rules; no
  game knowledge.
- **Book view** (`book/:bookId`) — markdown editing + sharing UI; talks to the
  Book API; no game knowledge.

This keeps the game learnable in isolation (you can tinker with `client/game/`
without touching the backend) and keeps the backend testable without the engine.

## 9. Testing

- API: unit-test sharing rules in `getBook` (owner / public / specific / denied)
  and owner-only enforcement on `updateBook` / `deleteBook`.
- Game core: keep input→vector and proximity logic as pure functions where
  possible so they can be unit-tested without a canvas.
- Manual: walk + open on desktop and a mobile viewport; create/delete/share a
  book; autosave round-trip.

## 10. Open Extension Ideas (not built)

Real art pass, NPCs/dialogue, ambient audio, day/night lighting, public library
discovery page, collaborative books, custom room layouts.
