# mallory-website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a functional dark-academia "library writing toy" skeleton: a Kaplay 2D walkable library where each book is an ugly-app markdown document, private by default and shareable.

**Architecture:** Standard ugly-app project (React SPA + `shared/` collections/API + Cloudflare Workers). The walkable room is a small, well-commented Kaplay game in `client/game/` that knows nothing about the API — it receives a plain `Book[]` and emits two events (`open book`, `lectern moved`). A thin React `LibraryGame` wrapper bridges those events to ugly-app (`useRouter`, `updateBook`). Books are persisted in a `book` collection with sharing rules enforced server-side; the book view reuses ugly-app's `MarkdownEditor`.

**Tech Stack:** ugly-app `0.1.652`, React, Zod, Kaplay (Kaboom.js), TypeScript, Vitest (unit), Playwright (e2e). Deploys to Cloudflare Workers.

## Global Constraints

- ugly-app version floor: `0.1.652`. Project uses **pnpm** (per platform convention for ugly-app child apps; `npm install` crashes on arborist dedupe).
- Production domain: `listentothiscrazypersontalkaboutstuff.xyz`.
- Every endpoint MUST be registered in **both** `server/index.ts` and `server/workers.ts` — prod deploys `workers.ts`; an endpoint only in `index.ts` returns `[Router] not registered`.
- **Never** read `process.env` in client code — use `import.meta.env.VITE_*`.
- **Never** add `any` types (`noExplicitAny` enforced).
- **Never** change a collection field type without a migration.
- After adding/altering a collection: run `pnpm run db:schema-gen && pnpm run db:migrate`.
- Kaplay is browser-only (touches `window`/`canvas`): it MUST only be imported from `client/game/**` and client page modules, never from `server/**` or `shared/**`, and must be instantiated inside a `useEffect` (never at module top level).
- No emojis in UI — use inline SVG (lucide `IconNode`) or text glyphs.
- Commit after every passing step.

---

## File Structure

**Created/owned by this plan:**

- `shared/collections.ts` — add `BookSchema` + `book` collection (modify scaffold file).
- `shared/api.ts` — add book request defs (modify scaffold file).
- `shared/bookAccess.ts` — **pure** access-rule helpers (`canReadBook`, `assertOwner`). No DB, no React. Unit-tested.
- `shared/pages.ts` — register `library` + `book/:bookId` routes (modify scaffold file).
- `server/bookHandlers.ts` — `createBookHandlers(getApp)` factory: the book endpoint implementations, shared by both server entries.
- `server/index.ts` — wire `createBookHandlers` (modify scaffold file).
- `server/workers.ts` — wire `createBookHandlers` (modify scaffold file).
- `client/allPages.ts` — map the two new routes (modify scaffold file).
- `client/pages/LibraryPage.tsx` — hosts `LibraryGame`.
- `client/pages/BookPage.tsx` — the open-book reading/writing view.
- `client/components/LibraryGame.tsx` — React↔Kaplay bridge.
- `client/components/BookChrome.tsx` — the two-page open-book visual frame.
- `client/components/SharingPills.tsx` — Private/Specific/Public toggle + `sharedWith` editor.
- `client/components/TouchJoystick.tsx` — on-screen joystick + action button (DOM overlay) feeding a movement vector.
- `client/game/types.ts` — `GameBook`, `GameEvents`, `Vec2` shared game types.
- `client/game/input.ts` — **pure** `keysToVector()` + proximity helpers. Unit-tested.
- `client/game/createGame.ts` — boots Kaplay onto a canvas; returns a controller.
- `client/game/scenes/library.ts` — draws the room, spawns lecterns, wires movement + open prompt + drag.
- `client/game/entities/player.ts` — player sprite + facing.
- `client/game/assets/manifest.ts` — placeholder pixel-art asset paths.
- `client/game/assets/*.png` — placeholder sprites (player, lectern, floor tile, wall tile).
- `tests/bookAccess.test.ts`, `tests/gameInput.test.ts` — unit tests.
- `tests/e2e/library.spec.ts` — smoke e2e.
- `README.md` — beginner-friendly tutorial docs (run locally, project tour, how to change the game). Drafted up front, finalized in the last task.

---

## Task 1: Scaffold the project and boot it

**Files:**
- Create: entire ugly-app scaffold inside `/Users/admin/Documents/GitHub/mallory-website` (the repo already contains `docs/`).
- Modify: `package.json` (name), `.uglyapp` (display name + domain).

- [ ] **Step 1: Scaffold into the existing repo**

```bash
cd /Users/admin/Documents/GitHub/mallory-website
# init into a temp dir then move (init refuses non-empty dirs); docs/ + .git must survive
npx ugly-app@latest init mallory-tmp
shopt -s dotglob && mv mallory-tmp/* . && rmdir mallory-tmp && shopt -u dotglob
```

If `ugly-app init` is unavailable or refuses, fall back to copying the template:
```bash
rsync -a --exclude node_modules --exclude .git /Users/admin/Documents/GitHub/ugly-app/templates/ .
mv gitignore .gitignore 2>/dev/null || true
```

- [ ] **Step 2: Set the app name and domain**

Set `"name": "mallory-website"` in `package.json`. Create/edit `.uglyapp`:
```json
{
  "name": "mallory-website",
  "title": "Mallory's Library",
  "description": "A cozy dark-academia library you walk around and write books in.",
  "domain": "listentothiscrazypersontalkaboutstuff.xyz"
}
```
Confirm `vite.config.ts` has `envDir: '..'` if `root` is `'client'` (so `VITE_*` bakes into the client bundle — known scaffold gotcha).

- [ ] **Step 3: Install deps (pnpm)**

```bash
pnpm install
```
Expected: completes without arborist/dedupe errors.

- [ ] **Step 4: Boot the dev server and confirm it serves**

```bash
pnpm run dev
```
Expected: server + Vite start; opening the local URL shows the scaffold home page. Stop with Ctrl-C.

- [ ] **Step 5: Typecheck baseline**

```bash
pnpm exec tsc --noEmit
```
Expected: PASS (scaffold is clean). If the scaffold has known drift errors, fix them now so the baseline is green before adding features.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold mallory-website (ugly-app) + app name/domain"
```

---

## Task 2: `book` collection + schema

**Files:**
- Modify: `shared/collections.ts`
- Test: `tests/bookSchema.test.ts`

**Interfaces:**
- Produces: `BookSchema` (zod), `Book` type, and `collections.book`. `Book` shape:
  `{ _id: string; ownerId: string; title: string; coverStyle: 'oxblood'|'forest'|'plain'; pages: string[]; lecternPos: { x: number; y: number }; sharing: { visibility: 'private'|'specific'|'public'; sharedWith: string[] }; created: number; updated: number }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/bookSchema.test.ts
import { describe, it, expect } from 'vitest';
import { BookSchema } from '../shared/collections';

const valid = {
  ownerId: 'u1',
  title: 'The Travelogue',
  coverStyle: 'oxblood' as const,
  pages: ['# Day one'],
  lecternPos: { x: 100, y: 80 },
  sharing: { visibility: 'private' as const, sharedWith: [] },
};

describe('BookSchema', () => {
  it('accepts a valid book', () => {
    expect(BookSchema.parse(valid)).toMatchObject({ title: 'The Travelogue' });
  });
  it('rejects an unknown visibility', () => {
    expect(() => BookSchema.parse({ ...valid, sharing: { visibility: 'world', sharedWith: [] } })).toThrow();
  });
  it('defaults pages to a single empty page', () => {
    const { pages } = BookSchema.parse({ ...valid, pages: undefined });
    expect(pages).toEqual(['']);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec vitest run tests/bookSchema.test.ts`
Expected: FAIL — `BookSchema` is not exported.

- [ ] **Step 3: Add the schema and collection**

In `shared/collections.ts`, add:
```ts
export const BookSchema = z.object({
  ownerId: z.string(),
  title: z.string().default('Untitled Volume'),
  coverStyle: z.enum(['oxblood', 'forest', 'plain']).default('oxblood'),
  pages: z.array(z.string()).default(['']),
  lecternPos: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
  sharing: z
    .object({
      visibility: z.enum(['private', 'specific', 'public']).default('private'),
      sharedWith: z.array(z.string()).default([]),
    })
    .default({ visibility: 'private', sharedWith: [] }),
});
export type Book = InferDocType<typeof BookSchema>;
```
And inside `defineCollections({ ... })` add:
```ts
  book: {
    schema: BookSchema,
    meta: { cache: false, trackable: true, public: false, cascadeFrom: null, trackKeys: ['ownerId'] },
  },
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm exec vitest run tests/bookSchema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Generate + apply the DB schema**

```bash
pnpm run db:schema-gen && pnpm run db:migrate
```
Expected: a `docs_book` table/migration is created without error.

- [ ] **Step 6: Commit**

```bash
git add shared/collections.ts tests/bookSchema.test.ts
git commit -m "feat(book): add book collection + schema"
```

---

## Task 3: Pure access-rule helpers

**Files:**
- Create: `shared/bookAccess.ts`
- Test: `tests/bookAccess.test.ts`

**Interfaces:**
- Produces:
  - `canReadBook(book: Pick<Book,'ownerId'|'sharing'>, userId: string | null): boolean`
  - `assertOwner(book: Pick<Book,'ownerId'>, userId: string): void` — throws `Error('Forbidden')` if `book.ownerId !== userId`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/bookAccess.test.ts
import { describe, it, expect } from 'vitest';
import { canReadBook, assertOwner } from '../shared/bookAccess';

const base = { ownerId: 'owner' };
const priv = { ...base, sharing: { visibility: 'private' as const, sharedWith: [] } };
const pub = { ...base, sharing: { visibility: 'public' as const, sharedWith: [] } };
const spec = { ...base, sharing: { visibility: 'specific' as const, sharedWith: ['friend'] } };

describe('canReadBook', () => {
  it('owner always reads', () => expect(canReadBook(priv, 'owner')).toBe(true));
  it('stranger cannot read private', () => expect(canReadBook(priv, 'x')).toBe(false));
  it('anyone reads public, even logged-out', () => expect(canReadBook(pub, null)).toBe(true));
  it('specific allows listed user only', () => {
    expect(canReadBook(spec, 'friend')).toBe(true);
    expect(canReadBook(spec, 'x')).toBe(false);
  });
});

describe('assertOwner', () => {
  it('passes for owner', () => expect(() => assertOwner(base, 'owner')).not.toThrow());
  it('throws for non-owner', () => expect(() => assertOwner(base, 'x')).toThrow('Forbidden'));
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec vitest run tests/bookAccess.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

```ts
// shared/bookAccess.ts
import type { Book } from './collections';

export function canReadBook(
  book: Pick<Book, 'ownerId' | 'sharing'>,
  userId: string | null,
): boolean {
  if (userId && book.ownerId === userId) return true;
  if (book.sharing.visibility === 'public') return true;
  if (book.sharing.visibility === 'specific' && userId) {
    return book.sharing.sharedWith.includes(userId);
  }
  return false;
}

export function assertOwner(book: Pick<Book, 'ownerId'>, userId: string): void {
  if (book.ownerId !== userId) throw new Error('Forbidden');
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm exec vitest run tests/bookAccess.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/bookAccess.ts tests/bookAccess.test.ts
git commit -m "feat(book): pure access-rule helpers"
```

---

## Task 4: Book API definitions

**Files:**
- Modify: `shared/api.ts`

**Interfaces:**
- Produces request defs consumed by Task 5:
  - `listMyBooks` (auth) → `{ books: Book[] }`
  - `getBook` (public) input `{ bookId: string }` → `{ book: Book | null }`
  - `createBook` (auth) input `{ title?: string; coverStyle?: 'oxblood'|'forest'|'plain' }` → `{ id: string }`
  - `updateBook` (auth) input `{ bookId; patch: { title?; coverStyle?; pages?; lecternPos?; sharing? } }` → `{ ok: boolean }`
  - `deleteBook` (auth) input `{ bookId: string }` → `{ ok: boolean }`

- [ ] **Step 1: Add request defs**

In `shared/api.ts`, import `req` alongside the existing imports:
```ts
import { authReq, req, defineMessages, defineRequests, frameworkMessages, frameworkRequests, z } from 'ugly-app/shared';
```
Add a reusable zod shape near the top:
```ts
const BookDoc = z.object({
  _id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  coverStyle: z.enum(['oxblood', 'forest', 'plain']),
  pages: z.array(z.string()),
  lecternPos: z.object({ x: z.number(), y: z.number() }),
  sharing: z.object({
    visibility: z.enum(['private', 'specific', 'public']),
    sharedWith: z.array(z.string()),
  }),
  created: z.number(),
  updated: z.number(),
});
const BookPatch = z.object({
  title: z.string().max(200).optional(),
  coverStyle: z.enum(['oxblood', 'forest', 'plain']).optional(),
  pages: z.array(z.string().max(50_000)).max(500).optional(),
  lecternPos: z.object({ x: z.number(), y: z.number() }).optional(),
  sharing: z.object({
    visibility: z.enum(['private', 'specific', 'public']),
    sharedWith: z.array(z.string()).max(200),
  }).optional(),
});
```
Inside `defineRequests({ ... })` add:
```ts
  listMyBooks: authReq({
    input: z.object({}),
    output: z.object({ books: z.array(BookDoc) }),
  }),
  getBook: req({
    input: z.object({ bookId: z.string() }),
    output: z.object({ book: BookDoc.nullable() }),
  }),
  createBook: authReq({
    input: z.object({
      title: z.string().max(200).optional(),
      coverStyle: z.enum(['oxblood', 'forest', 'plain']).optional(),
    }),
    output: z.object({ id: z.string() }),
    rateLimit: { max: 30, window: 60 },
  }),
  updateBook: authReq({
    input: z.object({ bookId: z.string(), patch: BookPatch }),
    output: z.object({ ok: z.boolean() }),
    rateLimit: { max: 120, window: 60 },
  }),
  deleteBook: authReq({
    input: z.object({ bookId: z.string() }),
    output: z.object({ ok: z.boolean() }),
  }),
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (defs only; handlers added next task). If `tsc` complains that handlers are missing, that surfaces in Task 5 — defs alone compile.

- [ ] **Step 3: Commit**

```bash
git add shared/api.ts
git commit -m "feat(book): API request definitions"
```

---

## Task 5: Book endpoint handlers (both server entries)

**Files:**
- Create: `server/bookHandlers.ts`
- Modify: `server/index.ts`, `server/workers.ts`
- Test: `tests/bookHandlers.test.ts`

**Interfaces:**
- Consumes: `canReadBook`/`assertOwner` (Task 3), `collections.book` (Task 2), request defs (Task 4).
- Produces: `createBookHandlers(getApp: () => { db: AppDb }): Partial<RequestHandlers<typeof requests>>` where `AppDb` has `getDoc`, `setDoc`, `deleteDoc`, `queryDocs`. Exported helper `buildNewBook(ownerId, opts)` for unit testing.

- [ ] **Step 1: Write the failing test (pure parts)**

```ts
// tests/bookHandlers.test.ts
import { describe, it, expect } from 'vitest';
import { buildNewBook } from '../server/bookHandlers';

describe('buildNewBook', () => {
  it('creates a private oxblood book with one empty page', () => {
    const b = buildNewBook('owner', {});
    expect(b.ownerId).toBe('owner');
    expect(b.sharing.visibility).toBe('private');
    expect(b.coverStyle).toBe('oxblood');
    expect(b.pages).toEqual(['']);
    expect(typeof b._id).toBe('string');
  });
  it('honors title and coverStyle options', () => {
    const b = buildNewBook('owner', { title: 'Spells', coverStyle: 'forest' });
    expect(b.title).toBe('Spells');
    expect(b.coverStyle).toBe('forest');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec vitest run tests/bookHandlers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the handler factory**

```ts
// server/bookHandlers.ts
import { nanoid } from 'nanoid';
import { dbDefaults } from 'ugly-app/shared';
import type { RequestHandlers } from 'ugly-app';
import { collections, type Book } from '../shared/collections';
import { canReadBook, assertOwner } from '../shared/bookAccess';
import type { requests } from '../shared/api';

interface AppDb {
  getDoc<T>(col: typeof collections.book, id: string): Promise<T | null>;
  setDoc<T>(col: typeof collections.book, doc: T): Promise<void>;
  deleteDoc(col: typeof collections.book, id: string): Promise<void>;
  queryDocs<T>(col: typeof collections.book, query: Record<string, unknown>): Promise<T[]>;
}

export function buildNewBook(
  ownerId: string,
  opts: { title?: string; coverStyle?: Book['coverStyle'] },
): Book {
  return {
    _id: nanoid(),
    ownerId,
    title: opts.title ?? 'Untitled Volume',
    coverStyle: opts.coverStyle ?? 'oxblood',
    pages: [''],
    lecternPos: { x: 0, y: 0 },
    sharing: { visibility: 'private', sharedWith: [] },
    ...dbDefaults(),
  };
}

export function createBookHandlers(
  getApp: () => { db: AppDb },
): Partial<RequestHandlers<typeof requests>> {
  return {
    listMyBooks: async (userId) => {
      const books = await getApp().db.queryDocs<Book>(collections.book, { ownerId: userId });
      return { books };
    },

    getBook: async (userId, { bookId }) => {
      const book = await getApp().db.getDoc<Book>(collections.book, bookId);
      if (!book || !canReadBook(book, userId)) return { book: null };
      return { book };
    },

    createBook: async (userId, opts) => {
      const book = buildNewBook(userId, opts);
      await getApp().db.setDoc(collections.book, book);
      return { id: book._id };
    },

    updateBook: async (userId, { bookId, patch }) => {
      const book = await getApp().db.getDoc<Book>(collections.book, bookId);
      if (!book) throw new Error('Book not found');
      assertOwner(book, userId);
      const updated: Book = { ...book, ...patch, ...dbDefaults() };
      await getApp().db.setDoc(collections.book, updated);
      return { ok: true };
    },

    deleteBook: async (userId, { bookId }) => {
      const book = await getApp().db.getDoc<Book>(collections.book, bookId);
      if (!book) return { ok: true };
      assertOwner(book, userId);
      await getApp().db.deleteDoc(collections.book, bookId);
      return { ok: true };
    },
  };
}
```
> If `app.db` lacks a `queryDocs(col, { ownerId })` signature, use the project's actual list API (e.g. `app.db.query(...)` or a `pgQuery` over `docs_book`); confirm against `ugly-app/server` types and adjust `AppDb` accordingly. The handler shape stays the same.

- [ ] **Step 4: Wire into `server/index.ts`**

Add the import and spread the handlers into the `createApp` handler object:
```ts
import { createBookHandlers } from './bookHandlers';
// ...
const app = createApp(
  { requests, messages },
  {
    // ...existing todo/test handlers...
    ...createBookHandlers(() => app),
  },
);
```

- [ ] **Step 5: Wire into `server/workers.ts`**

```ts
import { createBookHandlers } from './bookHandlers';
// ...
const requestHandlers: Partial<RequestHandlers<typeof requests>> = {
  ...createBookHandlers(() => app),
};
const app = createWorkersApp({ requests, messages }, requestHandlers, collections, (cfg) => {
  cfg.setWorkers(cronTasks, cronHandlers);
});
```
> `app` is referenced inside the thunk before its declaration completes; this is safe because handlers run after `createWorkersApp` returns. If the linter flags use-before-define, declare `let app` then assign, or move `requestHandlers` to be built right after `app`.

- [ ] **Step 6: Run unit test + typecheck**

Run: `pnpm exec vitest run tests/bookHandlers.test.ts && pnpm exec tsc --noEmit`
Expected: tests PASS (2); typecheck PASS.

- [ ] **Step 7: Manually verify the round-trip**

Start `pnpm run dev`, open the browser devtools console on any page, and run:
```js
await window.__app.socket.request('createBook', { title: 'Smoke' })
await window.__app.socket.request('listMyBooks', {})
```
> Use whatever the project exposes for the socket; if `window.__app` is absent, defer this to the Task 8/10 UI verification instead. Expected: `createBook` returns an id; `listMyBooks` includes it.

- [ ] **Step 8: Commit**

```bash
git add server/bookHandlers.ts server/index.ts server/workers.ts tests/bookHandlers.test.ts
git commit -m "feat(book): endpoint handlers wired into both server entries"
```

---

## Task 6: Register routes + placeholder pages

**Files:**
- Modify: `shared/pages.ts`, `client/allPages.ts`
- Create: `client/pages/LibraryPage.tsx`, `client/pages/BookPage.tsx`

**Interfaces:**
- Produces routes: `library` (auth: true), `book/:bookId` (auth: false — sharing is enforced server-side so public/shared books render for anyone).

- [ ] **Step 1: Add routes in `shared/pages.ts`**

Inside `definePages({ ... })`:
```ts
  'library': definePage<{}>({ auth: true }),
  'book/:bookId': definePage<{ bookId: string }>({ auth: false }),
```

- [ ] **Step 2: Create placeholder page components**

```tsx
// client/pages/LibraryPage.tsx
import React from 'react';

export default function LibraryPage(): React.ReactElement {
  return <div data-testid="library-page">Library coming soon</div>;
}
```
```tsx
// client/pages/BookPage.tsx
import React from 'react';
import { useRouter } from 'ugly-app/client';

export default function BookPage(): React.ReactElement {
  const { params } = useRouter();
  return <div data-testid="book-page">Book {String((params as { bookId?: string }).bookId)}</div>;
}
```
> Confirm the `useRouter()` param accessor against the scaffold's `client/router` (the template generates it). If params come via props instead, adjust.

- [ ] **Step 3: Map routes in `client/allPages.ts`**

```ts
  ['library']: lazyPage(() => import('./pages/LibraryPage')),
  ['book/:bookId']: lazyPage(() => import('./pages/BookPage')),
```

- [ ] **Step 4: Verify routes render**

Run `pnpm run dev`, visit `/#/library` and `/#/book/abc` (use the project's actual URL scheme). Expected: the two placeholder divs render; no console errors.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add shared/pages.ts client/allPages.ts client/pages/LibraryPage.tsx client/pages/BookPage.tsx
git commit -m "feat(routes): library + book pages (placeholders)"
```

---

## Task 7: Pure game input + proximity logic

**Files:**
- Create: `client/game/types.ts`, `client/game/input.ts`
- Test: `tests/gameInput.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `interface Vec2 { x: number; y: number }`; `interface GameBook { id: string; title: string; coverStyle: 'oxblood'|'forest'|'plain'; pos: Vec2 }`; `interface GameEvents { onOpenBook(id: string): void; onLecternMoved(id: string, pos: Vec2): void }`.
  - `input.ts`:
    - `keysToVector(keys: { up: boolean; down: boolean; left: boolean; right: boolean }): Vec2` — normalized (length ≤ 1).
    - `nearestWithin(player: Vec2, books: GameBook[], radius: number): GameBook | null`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/gameInput.test.ts
import { describe, it, expect } from 'vitest';
import { keysToVector, nearestWithin } from '../client/game/input';

describe('keysToVector', () => {
  it('returns zero when idle', () => expect(keysToVector({ up: false, down: false, left: false, right: false })).toEqual({ x: 0, y: 0 }));
  it('normalizes diagonals to length ~1', () => {
    const v = keysToVector({ up: true, down: false, left: false, right: true });
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 5);
  });
  it('cancels opposing keys', () => expect(keysToVector({ up: true, down: true, left: false, right: false })).toEqual({ x: 0, y: 0 }));
});

describe('nearestWithin', () => {
  const books = [
    { id: 'a', title: 'A', coverStyle: 'oxblood' as const, pos: { x: 0, y: 0 } },
    { id: 'b', title: 'B', coverStyle: 'forest' as const, pos: { x: 100, y: 0 } },
  ];
  it('finds the closest within radius', () => expect(nearestWithin({ x: 10, y: 0 }, books, 40)?.id).toBe('a'));
  it('returns null when none within radius', () => expect(nearestWithin({ x: 50, y: 0 }, books, 20)).toBeNull());
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec vitest run tests/gameInput.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement types + input**

```ts
// client/game/types.ts
export interface Vec2 { x: number; y: number }
export interface GameBook {
  id: string;
  title: string;
  coverStyle: 'oxblood' | 'forest' | 'plain';
  pos: Vec2;
}
export interface GameEvents {
  onOpenBook(id: string): void;
  onLecternMoved(id: string, pos: Vec2): void;
}
```
```ts
// client/game/input.ts
import type { Vec2, GameBook } from './types';

export function keysToVector(keys: { up: boolean; down: boolean; left: boolean; right: boolean }): Vec2 {
  const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const len = Math.hypot(x, y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

export function nearestWithin(player: Vec2, books: GameBook[], radius: number): GameBook | null {
  let best: GameBook | null = null;
  let bestDist = radius;
  for (const b of books) {
    const d = Math.hypot(b.pos.x - player.x, b.pos.y - player.y);
    if (d <= bestDist) { best = b; bestDist = d; }
  }
  return best;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm exec vitest run tests/gameInput.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add client/game/types.ts client/game/input.ts tests/gameInput.test.ts
git commit -m "feat(game): pure input + proximity logic"
```

---

## Task 8: Kaplay game core (room, player, lecterns, desktop controls)

**Files:**
- Create: `client/game/assets/manifest.ts`, `client/game/assets/*.png`, `client/game/entities/player.ts`, `client/game/scenes/library.ts`, `client/game/createGame.ts`
- Modify: `package.json` (add `kaplay`)

**Interfaces:**
- Consumes: `keysToVector`, `nearestWithin`, `GameBook`, `GameEvents`, `Vec2`.
- Produces: `createGame(opts: { canvas: HTMLCanvasElement; books: GameBook[]; events: GameEvents; getJoystick?: () => Vec2 }): GameController` where `GameController = { setBooks(books: GameBook[]): void; pressAction(): void; destroy(): void }`.

- [ ] **Step 1: Install Kaplay**

```bash
pnpm add kaplay
```

- [ ] **Step 2: Add placeholder pixel-art assets + manifest**

Create four tiny placeholder PNGs (16×16 or 32×32) under `client/game/assets/`: `player.png`, `lectern-oxblood.png`, `lectern-forest.png`, `lectern-plain.png`, `floor.png`, `wall.png`. Generate solid-color/simple pixel placeholders (e.g. via the `assets` skill or any pixel editor) — real art is an extension point.
```ts
// client/game/assets/manifest.ts
import player from './player.png';
import lecternOxblood from './lectern-oxblood.png';
import lecternForest from './lectern-forest.png';
import lecternPlain from './lectern-plain.png';
import floor from './floor.png';
import wall from './wall.png';

export const SPRITES = {
  player,
  'lectern-oxblood': lecternOxblood,
  'lectern-forest': lecternForest,
  'lectern-plain': lecternPlain,
  floor,
  wall,
} as const;
```
> Vite serves PNG imports as URLs. If TS complains about importing `.png`, add `client/vite-env.d.ts` with `/// <reference types="vite/client" />` (the scaffold usually already has this).

- [ ] **Step 3: Implement the player entity**

```ts
// client/game/entities/player.ts
import type { KAPLAYCtx, GameObj } from 'kaplay';

export const PLAYER_SPEED = 160; // px/sec — tweak to learn how speed feels

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
```

- [ ] **Step 4: Implement the library scene**

```ts
// client/game/scenes/library.ts
import type { KAPLAYCtx, GameObj } from 'kaplay';
import type { GameBook, GameEvents, Vec2 } from '../types';
import { keysToVector, nearestWithin } from '../input';
import { spawnPlayer, PLAYER_SPEED } from '../entities/player';

const OPEN_RADIUS = 44;

export interface SceneHandle {
  setBooks(books: GameBook[]): void;
  pressAction(): void;
  destroy(): void;
}

export function startLibraryScene(
  k: KAPLAYCtx,
  initialBooks: GameBook[],
  events: GameEvents,
  getJoystick: () => Vec2,
): SceneHandle {
  // floor tiles
  for (let x = 0; x < k.width(); x += 32)
    for (let y = 0; y < k.height(); y += 32)
      k.add([k.sprite('floor'), k.pos(x, y), k.z(0)]);

  const player = spawnPlayer(k, { x: k.width() / 2, y: k.height() / 2 });

  // EXTENSION POINT: spawn NPCs / decor here.

  let books = initialBooks;
  let lecternObjs: GameObj[] = [];
  let nearestId: string | null = null;

  const prompt = k.add([
    k.text('E', { size: 16 }),
    k.pos(0, 0),
    k.anchor('center'),
    k.z(20),
    k.opacity(0),
  ]);

  function rebuild(): void {
    lecternObjs.forEach((o) => o.destroy());
    lecternObjs = books.map((b) => {
      const obj = k.add([
        k.sprite(`lectern-${b.coverStyle}`),
        k.pos(b.pos.x, b.pos.y),
        k.anchor('center'),
        k.area(),
        k.z(5),
        'lectern',
        { bookId: b.id },
      ]);
      // drag-to-place
      obj.onMouseDown(() => {
        if (!k.isMouseDown('left')) return;
        obj.pos = k.mousePos();
      });
      obj.onMouseRelease(() => {
        events.onLecternMoved(b.id, { x: obj.pos.x, y: obj.pos.y });
      });
      return obj;
    });
  }
  rebuild();

  const update = k.onUpdate(() => {
    const kb = {
      up: k.isKeyDown('w') || k.isKeyDown('up'),
      down: k.isKeyDown('s') || k.isKeyDown('down'),
      left: k.isKeyDown('a') || k.isKeyDown('left'),
      right: k.isKeyDown('d') || k.isKeyDown('right'),
    };
    let v = keysToVector(kb);
    const j = getJoystick();
    if (j.x !== 0 || j.y !== 0) v = j; // joystick overrides keyboard
    player.move(v.x * PLAYER_SPEED, v.y * PLAYER_SPEED);

    const near = nearestWithin(player.pos, books, OPEN_RADIUS);
    nearestId = near?.id ?? null;
    if (near) { prompt.opacity = 1; prompt.pos = k.vec2(near.pos.x, near.pos.y - 30); }
    else prompt.opacity = 0;
  });

  const keyOpen = k.onKeyPress('e', () => { if (nearestId) events.onOpenBook(nearestId); });

  return {
    setBooks(next) { books = next; rebuild(); },
    pressAction() { if (nearestId) events.onOpenBook(nearestId); },
    destroy() { update.cancel(); keyOpen.cancel(); },
  };
}
```
> Kaplay API names (`onMouseDown`, `isKeyDown`, `move`, `onUpdate().cancel()`) match Kaplay v3+. If the installed version differs, adjust to its docs — the structure is the same.

- [ ] **Step 5: Implement `createGame`**

```ts
// client/game/createGame.ts
import kaplay from 'kaplay';
import type { GameBook, GameEvents, Vec2 } from './types';
import { SPRITES } from './assets/manifest';
import { startLibraryScene, type SceneHandle } from './scenes/library';

export interface GameController {
  setBooks(books: GameBook[]): void;
  pressAction(): void;
  destroy(): void;
}

export function createGame(opts: {
  canvas: HTMLCanvasElement;
  books: GameBook[];
  events: GameEvents;
  getJoystick?: () => Vec2;
}): GameController {
  const k = kaplay({
    canvas: opts.canvas,
    global: false,          // do NOT pollute window — keeps it learnable + SSR-safe
    background: [18, 12, 8], // dark-academia near-black
    pixelDensity: 2,
  });

  for (const [name, url] of Object.entries(SPRITES)) k.loadSprite(name, url);

  const getJoystick = opts.getJoystick ?? (() => ({ x: 0, y: 0 }));
  let scene: SceneHandle | null = null;

  // wait for sprites, then start the scene
  void k.load(undefined as unknown as Promise<void>);
  k.onLoad(() => { scene = startLibraryScene(k, opts.books, opts.events, getJoystick); });

  return {
    setBooks(books) { scene?.setBooks(books); },
    pressAction() { scene?.pressAction(); },
    destroy() { scene?.destroy(); k.quit(); },
  };
}
```
> `k.onLoad` fires once sprites finish loading. Remove the `k.load(...)` line if your Kaplay version auto-loads; the key requirement is starting the scene inside `onLoad`.

- [ ] **Step 6: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. (Visual verification happens in Task 9 once mounted.)

- [ ] **Step 7: Commit**

```bash
git add client/game package.json pnpm-lock.yaml
git commit -m "feat(game): kaplay room, player, lecterns, desktop + drag"
```

---

## Task 9: `LibraryGame` React bridge + touch joystick

**Files:**
- Create: `client/components/TouchJoystick.tsx`, `client/components/LibraryGame.tsx`
- Modify: `client/pages/LibraryPage.tsx`

**Interfaces:**
- Consumes: `createGame` (Task 8), `listMyBooks`/`updateBook`/`createBook` (Tasks 4–5), `useApp`/`useRouter` (ugly-app).
- Produces: `LibraryGame` (default-exported component), `TouchJoystick` with props `{ onVector(v: Vec2): void; onAction(): void }`.

- [ ] **Step 1: Implement the touch joystick (DOM overlay)**

```tsx
// client/components/TouchJoystick.tsx
import React, { useRef } from 'react';
import type { Vec2 } from '../game/types';

export function TouchJoystick({ onVector, onAction }: { onVector: (v: Vec2) => void; onAction: () => void }): React.ReactElement {
  const base = useRef<HTMLDivElement>(null);
  const R = 48;

  function handle(e: React.TouchEvent): void {
    const el = base.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const t = e.touches[0];
    let dx = t.clientX - (r.left + r.width / 2);
    let dy = t.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, R);
    onVector({ x: (dx / len) * (clamped / R), y: (dy / len) * (clamped / R) });
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', touchAction: 'none' }}>
      <div
        ref={base}
        onTouchStart={handle}
        onTouchMove={handle}
        onTouchEnd={() => onVector({ x: 0, y: 0 })}
        style={{ position: 'absolute', left: 24, bottom: 24, width: 96, height: 96, borderRadius: '50%', border: '2px solid #c9a24b', background: 'rgba(10,7,6,.55)', pointerEvents: 'auto' }}
      />
      <button
        onTouchStart={(e) => { e.preventDefault(); onAction(); }}
        style={{ position: 'absolute', right: 24, bottom: 36, width: 64, height: 64, borderRadius: '50%', border: '2px solid #e8b84b', background: 'rgba(10,7,6,.7)', color: '#e8b84b', fontFamily: 'monospace', pointerEvents: 'auto' }}
      >E</button>
    </div>
  );
}
```

- [ ] **Step 2: Implement the React bridge**

```tsx
// client/components/LibraryGame.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useApp, useRouter } from 'ugly-app/client';
import { createGame, type GameController } from '../game/createGame';
import type { GameBook, Vec2 } from '../game/types';
import type { Book } from '../../shared/collections';
import { TouchJoystick } from './TouchJoystick';

function toGameBook(b: Book): GameBook {
  return { id: b._id, title: b.title, coverStyle: b.coverStyle, pos: b.lecternPos };
}

export default function LibraryGame(): React.ReactElement {
  const { socket } = useApp();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const joystickRef = useRef<Vec2>({ x: 0, y: 0 });
  const [books, setBooks] = useState<Book[]>([]);

  // load the user's books
  useEffect(() => {
    void socket.request('listMyBooks', {}).then((r) => setBooks(r.books));
  }, [socket]);

  // boot/destroy the game once
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    controllerRef.current = createGame({
      canvas,
      books: books.map(toGameBook),
      getJoystick: () => joystickRef.current,
      events: {
        onOpenBook: (id) => router.push('book/:bookId', { bookId: id }),
        onLecternMoved: (id, pos) => { void socket.request('updateBook', { bookId: id, patch: { lecternPos: pos } }); },
      },
    });
    return () => { controllerRef.current?.destroy(); controllerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push book updates into the running game
  useEffect(() => { controllerRef.current?.setBooks(books.map(toGameBook)); }, [books]);

  async function handleNewBook(): Promise<void> {
    await socket.request('createBook', {});
    const r = await socket.request('listMyBooks', {});
    setBooks(r.books);
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0706' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <button
        onClick={() => void handleNewBook()}
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 5, fontFamily: 'monospace', background: '#1c130c', color: '#e8b84b', border: '1px solid #c9a24b', borderRadius: 8, padding: '8px 12px' }}
      >+ New Volume</button>
      <TouchJoystick onVector={(v) => { joystickRef.current = v; }} onAction={() => controllerRef.current?.pressAction()} />
    </div>
  );
}
```
> Confirm `router.push` signature against the scaffold router (key + params). If it's `push('book', { bookId })` rather than `push('book/:bookId', ...)`, adjust both here and Task 6.

- [ ] **Step 3: Mount it in `LibraryPage`**

```tsx
// client/pages/LibraryPage.tsx
import React from 'react';
import LibraryGame from '../components/LibraryGame';

export default function LibraryPage(): React.ReactElement {
  return <LibraryGame />;
}
```

- [ ] **Step 4: Verify in the browser (desktop + mobile emulation)**

Run `pnpm run dev`, open `/#/library`:
- Desktop: WASD/arrows move the player; walking near a lectern shows the `E` prompt; pressing `E` navigates to the book page; "+ New Volume" adds a lectern; dragging a lectern repositions it and persists (reload keeps the new position).
- Mobile (devtools device emulation): the joystick moves the player; the E button opens the nearest book.
Expected: all of the above; no console errors.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add client/components/LibraryGame.tsx client/components/TouchJoystick.tsx client/pages/LibraryPage.tsx
git commit -m "feat(game): LibraryGame React bridge + touch joystick"
```

---

## Task 10: Book view — chrome, markdown editor, pages, autosave, sharing

**Files:**
- Create: `client/components/BookChrome.tsx`, `client/components/SharingPills.tsx`
- Modify: `client/pages/BookPage.tsx`

**Interfaces:**
- Consumes: `getBook`/`updateBook` (Tasks 4–5), `MarkdownEditor` from `ugly-app/markdown/client`, `useApp`/`useRouter`.
- Produces: full book view.

- [ ] **Step 1: Implement the book chrome (two-page frame)**

```tsx
// client/components/BookChrome.tsx
import React from 'react';

export function BookChrome({ left, right, onPrev, onNext, pageLabel }: {
  left: React.ReactNode; right: React.ReactNode;
  onPrev: () => void; onNext: () => void; pageLabel: string;
}): React.ReactElement {
  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(120% 90% at 50% 20%,#1a120c,#070504)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 }}>
      <div style={{ position: 'relative', width: 'min(900px,100%)', aspectRatio: '16 / 10', background: 'linear-gradient(#241811,#1c130c)', borderRadius: 16, padding: 18, boxShadow: '0 34px 80px rgba(0,0,0,.7), inset 0 0 0 6px #c9a24b' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', background: 'linear-gradient(#d8c8a0,#cbb98c)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '28px 32px', overflow: 'auto', boxShadow: 'inset -16px 0 26px -16px rgba(40,25,12,.7)' }}>{left}</div>
          <div style={{ padding: '28px 32px', overflow: 'auto', boxShadow: 'inset 16px 0 26px -16px rgba(40,25,12,.7)' }}>{right}</div>
        </div>
        <button onClick={onPrev} style={arrow('left')}>‹</button>
        <button onClick={onNext} style={arrow('right')}>›</button>
      </div>
      <div style={{ fontFamily: 'monospace', color: '#9a8a64', fontSize: 12 }}>{pageLabel}</div>
    </div>
  );
}
function arrow(side: 'left' | 'right'): React.CSSProperties {
  return { position: 'absolute', top: '50%', [side]: -10, transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(10,7,6,.85)', color: '#e8b84b', border: '1px solid #e8b84b', fontSize: 20, cursor: 'pointer' } as React.CSSProperties;
}
```
> On narrow viewports collapse to one column (single page) via a CSS media query / `window.innerWidth` check — the spec requires mobile readability.

- [ ] **Step 2: Implement sharing pills**

```tsx
// client/components/SharingPills.tsx
import React, { useState } from 'react';
import type { Book } from '../../shared/collections';

type Sharing = Book['sharing'];

export function SharingPills({ value, onChange }: { value: Sharing; onChange: (s: Sharing) => void }): React.ReactElement {
  const [draft, setDraft] = useState('');
  const pill = (v: Sharing['visibility'], label: string) => (
    <button key={v} onClick={() => onChange({ ...value, visibility: v })}
      style={{ borderRadius: 20, padding: '4px 10px', cursor: 'pointer', border: '1px solid #4a3826', background: value.visibility === v ? '#5e2b2b' : '#1c130c', color: value.visibility === v ? '#fff' : '#d8c8a0', fontFamily: 'monospace', fontSize: 12 }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {pill('private', 'Private')}{pill('specific', 'Specific')}{pill('public', 'Public')}
      {value.visibility === 'specific' && (
        <span style={{ display: 'flex', gap: 4 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="user id" style={{ fontFamily: 'monospace', fontSize: 12 }} />
          <button onClick={() => { if (draft.trim()) { onChange({ ...value, sharedWith: [...value.sharedWith, draft.trim()] }); setDraft(''); } }}>add</button>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9a8a64' }}>{value.sharedWith.join(', ')}</span>
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement the book page**

```tsx
// client/pages/BookPage.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp, useRouter } from 'ugly-app/client';
import { MarkdownEditor } from 'ugly-app/markdown/client';
import type { Book } from '../../shared/collections';
import { BookChrome } from '../components/BookChrome';
import { SharingPills } from '../components/SharingPills';

export default function BookPage(): React.ReactElement {
  const { socket, userId } = useApp();
  const router = useRouter();
  const bookId = String((router.params as { bookId?: string }).bookId);
  const [book, setBook] = useState<Book | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void socket.request('getBook', { bookId }).then((r) => setBook(r.book));
  }, [socket, bookId]);

  const isOwner = !!book && book.ownerId === userId;

  const scheduleSave = useCallback((patch: Partial<Book>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void socket.request('updateBook', { bookId, patch }); }, 600);
  }, [socket, bookId]);

  if (!book) return <div style={{ color: '#d8c8a0', padding: 24 }}>This volume is sealed (private or missing).</div>;

  const pages = book.pages.length ? book.pages : [''];
  const leftIdx = pageIndex;
  const rightIdx = pageIndex + 1;

  function setPage(idx: number, md: string): void {
    setBook((prev) => {
      if (!prev) return prev;
      const next = [...prev.pages]; next[idx] = md;
      const updated = { ...prev, pages: next };
      scheduleSave({ pages: next });
      return updated;
    });
  }

  const renderPage = (idx: number) =>
    idx < pages.length ? (
      <MarkdownEditor value={pages[idx]} disabled={!isOwner} placeholder="Write…" onValueChanged={(md) => setPage(idx, md)} />
    ) : <div style={{ color: '#9a8a64', fontFamily: 'monospace', fontSize: 12 }}>— end —</div>;

  return (
    <>
      <div style={{ position: 'fixed', top: 12, left: 12, right: 12, zIndex: 5, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', fontFamily: 'monospace' }}>
        <button onClick={() => router.push('library', {})} style={{ background: '#1c130c', color: '#e8b84b', border: '1px solid #c9a24b', borderRadius: 8, padding: '6px 10px' }}>← Library</button>
        {isOwner && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <SharingPills value={book.sharing} onChange={(s) => { setBook({ ...book, sharing: s }); scheduleSave({ sharing: s }); }} />
            <button onClick={() => { setBook((b) => b ? { ...b, pages: [...b.pages, ''] } : b); scheduleSave({ pages: [...book.pages, ''] }); }}
              style={{ background: '#1c130c', color: '#e8b84b', border: '1px solid #c9a24b', borderRadius: 8, padding: '6px 10px' }}>+ Page</button>
            <button onClick={() => { if (confirm('Delete this volume?')) void socket.request('deleteBook', { bookId }).then(() => router.push('library', {})); }}
              style={{ background: '#1c130c', color: '#8a3a3a', border: '1px solid #5e2b2b', borderRadius: 8, padding: '6px 10px' }}>Delete</button>
          </div>
        )}
      </div>
      <BookChrome
        left={renderPage(leftIdx)}
        right={renderPage(rightIdx)}
        pageLabel={`— ${leftIdx + 1}–${Math.min(rightIdx + 1, pages.length)} of ${pages.length} —`}
        onPrev={() => setPageIndex((i) => Math.max(0, i - 2))}
        onNext={() => setPageIndex((i) => (i + 2 < pages.length ? i + 2 : i))}
      />
    </>
  );
}
```
> Confirm `MarkdownEditor`'s exact prop names against `ugly-app/markdown/client` (`value`, `onValueChanged`, `disabled`, `placeholder` per the package types). Use `useRouter().openPopup` for the delete confirm if the project forbids `confirm()`.

- [ ] **Step 4: Verify in the browser**

Run `pnpm run dev`. From the library, open a book:
- Type markdown; headings change text size; reload re-loads saved content (autosave round-trip).
- "+ Page" adds pages; arrows flip 2 at a time.
- Sharing pills switch visibility; "Specific" adds a user id.
- "← Library" returns to the game.
- Open the same `book/:bookId` URL while logged out / as another user: private → "sealed"; public → readable but editor `disabled`.
Expected: all behaviors hold; no console errors.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add client/components/BookChrome.tsx client/components/SharingPills.tsx client/pages/BookPage.tsx
git commit -m "feat(book): book view with markdown editor, pages, autosave, sharing"
```

---

## Task 11: e2e smoke + final verification

**Files:**
- Create: `tests/e2e/library.spec.ts`

- [ ] **Step 1: Write the smoke e2e**

```ts
// tests/e2e/library.spec.ts
import { test, expect } from '@playwright/test';

// Assumes the project's playwright config handles auth (injectAuthCookie) per repo convention.
test('library loads and a book can be created and opened', async ({ page }) => {
  await page.goto('/#/library');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByText('+ New Volume').click();
  // navigate directly to a freshly created book via the API-less UI path:
  // (open by walking is hard to script; assert the new-volume button works + book route renders)
  await page.goto('/#/book/does-not-exist');
  await expect(page.getByText(/sealed|Write/i)).toBeVisible();
});
```
> Adapt selectors/auth to the scaffold's Playwright setup (see the repo's `playwright.config.ts` + any `injectAuthCookie` fixture). Walking-to-open is not scripted; this asserts the canvas mounts, the create button works, and the book route renders.

- [ ] **Step 2: Run unit + e2e suites**

```bash
pnpm exec vitest run
pnpm run test:e2e
```
Expected: unit suites PASS; e2e smoke PASS (or documented skip if auth fixture isn't wired locally).

- [ ] **Step 3: Full typecheck + lint + build**

```bash
pnpm exec tsc --noEmit
pnpm run build
pnpm run build:workers
```
Expected: all succeed. `build:workers` must NOT pull Kaplay into the server bundle — if it errors on `window`/`canvas`, a `client/game` import leaked into `server/**` or `shared/**`; fix the import boundary.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/library.spec.ts
git commit -m "test(e2e): library + book smoke"
```

---

## Task 12: Finalize the tutorial README

**Files:**
- Modify: `README.md` (drafted before Task 1; bring it in line with the built code).

- [ ] **Step 1: Verify every command and path in the README is real**

Walk the README top to bottom and confirm: `pnpm install` / `pnpm run dev` work; every file path it names exists (`client/game/entities/player.ts` `PLAYER_SPEED`, `client/game/assets/`, `client/game/scenes/library.ts` NPC extension comment, `shared/collections.ts` `book`); the "change the game" recipes actually produce the described effect (e.g. editing `PLAYER_SPEED` changes walk speed).

- [ ] **Step 2: Fix any drift inline**

Update wording/paths so a brand-new programmer can follow it without prior context. Keep recipes concrete (exact file + exact line to change + what they'll see).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: finalize tutorial README"
```

---

## Manual Acceptance Checklist (skeleton "done")

- [ ] Walk the library on desktop (WASD/arrows) and mobile (joystick).
- [ ] Approach a lectern → `E` prompt → open the book (key + tap action button).
- [ ] Create a new volume from the library; it appears as a lectern.
- [ ] Drag a lectern; position persists across reload.
- [ ] Write markdown across multiple pages; autosaves; reload restores.
- [ ] Toggle Private / Specific / Public; "Specific" grants a named user read access.
- [ ] A non-owner sees public/shared books read-only and private books "sealed".
- [ ] Delete a volume; it disappears from the library.
- [ ] `tsc`, unit tests, `build`, and `build:workers` all pass.

## Extension Points (intentionally not built — for learning)

NPCs/dialogue (`scenes/library.ts` marked spot), day/night lighting, ambient audio, real pixel-art pass (swap `client/game/assets/*.png`), public-library discovery page, custom room layouts, multiplayer presence.
