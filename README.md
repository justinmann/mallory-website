# Mallory's Library

A cozy, dark-academia **library you can walk around** — and every book on a
lectern is something you can open and **write in** with a real markdown editor.
Books are private by default; you can share one with specific people or make it
public.

This repo is a **tutorial project for learning game development.** The walkable
2D library is a real game built in **[Godot 4](https://godotengine.org)** (scripted
in **GDScript**) and compiled to the web. The writing/saving/sharing parts use the
[ugly-app](https://www.npmjs.com/package/ugly-app) framework so you can focus on
the *game* part.

> **Live site:** https://listentothiscrazypersontalkaboutstuff.xyz

## How it fits together

- The **game** lives in [`game/`](game/) — a normal Godot project you open in the
  Godot editor. You export it to the web; the export lands in
  [`client/public/game/`](client/public/game/) (committed to the repo).
- The **website** (React, in `client/`) loads that exported game inside an
  `<iframe>` and talks to it with small messages: it sends your book list in, and
  the game tells it "open this book" / "this lectern moved." See
  [`client/components/LibraryGame.tsx`](client/components/LibraryGame.tsx) and the
  Godot side in [`game/scripts/bridge.gd`](game/scripts/bridge.gd).

---

## What you'll learn

- How a game loop works (moving a character, reading input every frame) — in
  `game/scripts/library.gd`
- Drawing a 2D scene in code and using the Godot engine
- Handling keyboard **and** touch controls
- Wiring a game to a real website (it sends data in, the game sends events out)

You do **not** need to be an expert. If you can read code and follow steps, you
can change this game.

---

## 1. Set up your computer (one time)

1. **Node.js** 20+ — https://nodejs.org
2. **pnpm** (the package manager this project uses): `npm install -g pnpm`
   - ⚠️ Use **pnpm**, not `npm install` — plain npm breaks this project.
3. **Godot 4.6** (only needed if you want to *change the game*) — download the
   editor from https://godotengine.org/download, then in the editor open
   **Manage Export Templates → Download** so it can export to the web.

---

## 2. Run it locally

```bash
pnpm install      # download everything the project needs (do this once)
pnpm run dev      # start the app
```

Open the URL it prints (usually `http://localhost:4321`, or run `npx ugly-app url`).
You'll see the library — walk around with the **arrow keys** or **WASD**, walk up
to a lectern and press **E** to open its book.

> If port 4321 is busy (other ugly-app projects), use another: `PORT=4933 pnpm run dev`.

`pnpm run dev` serves the **already-exported** game from `client/public/game/`. You
don't need Godot just to run the site — only to change the game (next section).

---

## 3. A tour of the project

```
game/                      ← THE GAME (open this folder in the Godot editor)
  project.godot            ← Godot project settings
  Main.tscn                ← the main scene
  scripts/
    library.gd             ← the room, the player, lecterns, movement, controls
    bridge.gd              ← talks to the website (book list in; events out)
  export_presets.cfg       ← the "Web" export settings (single-threaded)

client/
  public/game/             ← the EXPORTED web build (committed; regenerate with build:game)
  components/LibraryGame.tsx ← hosts the game in an iframe + the message bridge
  pages/
    LibraryPage.tsx        ← the page that shows the library (the home page)
    BookPage.tsx           ← the open-book writing screen (React markdown editor)

shared/                    ← rules shared by the app and the server
  collections.ts           ← what a "book" is (its fields)
  bookAccess.ts            ← who is allowed to read a book
server/                    ← the backend that saves your books
docs/                      ← the design + the full build plan
```

---

## 4. Change the game (start here!)

The game is one well-commented file: [`game/scripts/library.gd`](game/scripts/library.gd).

**The loop:** open `game/` in the **Godot editor**, edit, press **Play** to test
instantly inside the editor. When you want to see it in the actual website, export
it back to the web:

```bash
pnpm run build:game     # exports game/ → client/public/game/  (needs Godot installed)
```

then refresh `pnpm run dev` in your browser. (Editing in Godot does **not**
hot-reload the website — you must re-export with `build:game`.)

> Set `GODOT_BIN` if `godot4` isn't on your PATH, e.g.
> `GODOT_BIN="/Applications/Godot.app/Contents/MacOS/Godot" pnpm run build:game`.

Safe first edits in `library.gd`:

```gdscript
const SPEED := 160.0          # walk speed — try 80 (slow) or 300 (zoomy)
const OPEN_RADIUS := 48.0     # how close you must stand to open a lectern
const WALL_FRAC := 0.42       # how tall the back wall is (fraction of the room)
```

- **Lectern colors** live in the `COVER` dictionary near the top.
- **The room art** is drawn in `_draw()` — change the floor/wall/rug/candle colors,
  move the windows or bookshelf, or add your own shapes with `draw_rect` /
  `draw_circle`.
- **Add a new thing** (an NPC, a lamp): draw it in `_draw()`, or learn to add nodes
  in the Godot editor.

> **Tip:** Godot has excellent docs at https://docs.godotengine.org — search for
> `draw_rect`, `Input`, `Node2D`, and `_process` to understand the pieces here.

Whatever you change, **commit the regenerated `client/public/game/`** along with
your `game/` edits (the website ships the exported build, not the Godot source).

---

## 5. How books work (the writing part)

- A **book** is just data: a title, a cover color, and a list of **pages** of
  markdown text — see [`shared/collections.ts`](shared/collections.ts).
- The writing screen ([`client/pages/BookPage.tsx`](client/pages/BookPage.tsx)) uses
  ugly-app's markdown editor. **Text size comes from markdown headings** (`#`, `##`).
- It **saves automatically**. **Sharing** (Private / Specific / Public) is in the
  top bar; the server enforces it — see [`shared/bookAccess.ts`](shared/bookAccess.ts).

This part stays in the website (React), not the game — text editing is much nicer
in HTML than inside a game canvas.

---

## 6. Running the tests

```bash
pnpm test            # unit tests (book schema + sharing rules)
pnpm run test:e2e    # browser smoke test
```

---

## 7. Building and deploying

```bash
pnpm run build:game      # (if you changed the game) re-export Godot → client/public/game/
pnpm run build           # build the website
pnpm run build:workers   # build the server for Cloudflare Workers
pnpm run deploy          # publish to Cloudflare Workers + Neon
```

`build` and `deploy` do **not** run Godot — they ship the committed
`client/public/game/` export. So always run `build:game` and commit its output
*before* deploying a game change.

---

## 8. Where to read more

- **The design:** [`docs/superpowers/specs/2026-06-21-mallory-website-design.md`](docs/superpowers/specs/2026-06-21-mallory-website-design.md)
- **Godot engine docs:** https://docs.godotengine.org
- **Godot web export:** https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- **ugly-app (the framework):** https://www.npmjs.com/package/ugly-app

Have fun. Break things on purpose, then fix them — that's how you learn. 📚
