# Mallory's Library

A cozy, dark-academia **library you can walk around** — and every book on a
lectern is something you can open and **write in** with a real markdown editor.
Books are private by default; you can share one with specific people or make it
public.

This repo is a **tutorial project for learning web game development.** The 2D
library is built with a beginner-friendly game engine ([Kaplay / Kaboom.js](https://kaplayjs.com)),
and the writing/saving/sharing parts use the [ugly-app](https://www.npmjs.com/package/ugly-app)
framework so you can focus on the *game* part.

> **Live site:** https://listentothiscrazypersontalkaboutstuff.xyz

---

## What you'll learn

- How a game loop works (moving a character, reading input every frame)
- Loading and drawing sprites
- Handling keyboard **and** touch controls
- Wiring a game to a real backend (saving data, loading it back)

You do **not** need to be an expert. If you can read JavaScript/TypeScript and
follow steps, you can change this game.

---

## 1. Set up your computer (one time)

You need two things installed:

1. **Node.js** (version 20 or newer) — https://nodejs.org
2. **pnpm** (the package manager this project uses):
   ```bash
   npm install -g pnpm
   ```

> ⚠️ Use **pnpm**, not `npm install`. This project breaks with plain npm.

---

## 2. Run it locally

From the project folder:

```bash
pnpm install      # download everything the project needs (do this once)
pnpm run dev      # start the app
```

When it finishes starting, open the URL it prints (usually
`http://localhost:4321`) in your browser — or run `npx ugly-app url` to print
it. You should see the library. Walk around with the **arrow keys** or **WASD**.

> If port 4321 is already in use (e.g. you run other ugly-app projects), start
> on another port: `PORT=4933 pnpm run dev`.

To stop the app, press `Ctrl + C` in the terminal.

---

## 3. A tour of the project

You'll mostly care about two folders. Here's the map:

```
client/
  game/                  ← THE GAME. This is where you'll spend your time.
    createGame.ts        ← starts the game engine and loads sprites
    scenes/library.ts    ← builds the room, the lecterns, and the controls
    entities/player.ts   ← the character you walk around as
    input.ts             ← turns key presses into movement (plain math, no engine)
    assets/              ← the pictures (sprites). Swap these for your own art.
  components/
    LibraryGame.tsx      ← connects the game to the website (loads/saves books)
    TouchJoystick.tsx    ← the on-screen joystick for phones
  pages/
    LibraryPage.tsx      ← the page that shows the library
    BookPage.tsx         ← the open-book writing screen

shared/                  ← rules shared by the app and the server
  collections.ts         ← what a "book" is (its fields)
  api.ts                 ← the list of things the server can do
  bookAccess.ts          ← who is allowed to read a book

server/                  ← the backend that saves your books
docs/                    ← the design + the full build plan for this project
```

If a file isn't in this list, you probably don't need to touch it yet.

---

## 4. Change the game (start here!)

These are safe, fun first edits. After each change, **save the file** — the app
reloads automatically. If something breaks, undo your change and save again.

### Make the character walk faster or slower
Open `client/game/entities/player.ts` and change this number:
```ts
export const PLAYER_SPEED = 160; // pixels per second — try 80 (slow) or 300 (zoomy)
```

### Change the background color of the room
Open `client/game/createGame.ts` and find `background`:
```ts
background: [18, 12, 8], // [red, green, blue], each 0–255. Try [10, 20, 35] for midnight blue.
```

### How close you must stand to open a book
Open `client/game/scenes/library.ts` and change:
```ts
const OPEN_RADIUS = 44; // bigger = you can open books from farther away
```

### Use your own artwork
Replace the `.png` files in `client/game/assets/` with your own pixel art (keep
the same file names). The character is `player.png`; the books are the
`lectern-*.png` files.

### Add a new kind of thing in the room (e.g. an NPC, a plant, a lamp)
Open `client/game/scenes/library.ts` and find the comment:
```ts
// EXTENSION POINT: spawn NPCs / decor here.
```
Add objects right below it. For example, a decorative lamp:
```ts
k.add([k.sprite('floor'), k.pos(200, 120), k.z(1)]); // (uses an existing sprite for now)
```

> **Tip:** Kaplay has excellent, beginner-friendly docs and a live playground at
> https://kaplayjs.com — that's the best place to learn what `k.add`,
> `k.sprite`, `k.pos`, and friends can do.

---

## 5. How books work (the writing part)

- A **book** is just data: a title, a cover color, and a list of **pages**, where
  each page is markdown text. That shape lives in
  [`shared/collections.ts`](shared/collections.ts).
- The writing screen ([`client/pages/BookPage.tsx`](client/pages/BookPage.tsx))
  uses ugly-app's built-in markdown editor. **Text size comes from markdown
  headings** — type `# Big title` or `## Smaller title`.
- It **saves automatically** a moment after you stop typing.
- **Sharing** (Private / Specific / Public) is in the top bar. The server decides
  who's allowed to read a book — see [`shared/bookAccess.ts`](shared/bookAccess.ts).

You usually won't need to change these to learn game dev — they're here so the
game has something real to do.

---

## 6. Running the tests

```bash
pnpm test            # fast unit tests (movement math, access rules)
pnpm run test:e2e    # browser smoke test
```

If you change the movement math in `client/game/input.ts` or the rules in
`shared/bookAccess.ts`, run `pnpm test` to make sure you didn't break anything.

---

## 7. Building and deploying

```bash
pnpm run build           # build the website
pnpm run build:workers   # build the server for Cloudflare Workers
pnpm run deploy          # publish (requires the project to be set up for deploy)
```

You can keep developing entirely with `pnpm run dev` and never deploy if you just
want to learn.

---

## 8. Where to read more

- **The design** (what we're building and why):
  [`docs/superpowers/specs/2026-06-21-mallory-website-design.md`](docs/superpowers/specs/2026-06-21-mallory-website-design.md)
- **The full build plan** (every step, in order):
  [`docs/superpowers/plans/2026-06-21-mallory-website.md`](docs/superpowers/plans/2026-06-21-mallory-website.md)
- **Kaplay (the game engine):** https://kaplayjs.com
- **ugly-app (the framework):** https://www.npmjs.com/package/ugly-app

Have fun. Break things on purpose, then fix them — that's how you learn. 📚
