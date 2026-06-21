import { nanoid } from 'nanoid';
// Import from the worker-safe adapter entry (not 'ugly-app/server', whose Node
// deps would break the Cloudflare Workers bundle). This module is shared by
// both server/index.ts (Node) and server/workers.ts (Workers).
import { createTypedDB } from 'ugly-app/server/adapter/workers';
import { dbDefaults } from 'ugly-app/shared';
import type { RequestHandlers } from 'ugly-app';
import { collections, type Book } from '../shared/collections';
import { canReadBook, assertOwner } from '../shared/bookAccess';
import type { requests } from '../shared/api';

// A typed DB bound to the ambient per-request adapter. `createTypedDB` is the
// same primitive `createApp` and `createWorkersApp` use internally, so this
// works in BOTH the Node server and the Cloudflare Worker.
const db = createTypedDB(collections);

// The five book endpoints, picked from the full handler map so each handler's
// (userId, input) params are correctly typed and all five keys are required.
type BookHandlers = Pick<
  RequestHandlers<typeof requests>,
  'listMyBooks' | 'getBook' | 'createBook' | 'updateBook' | 'deleteBook'
>;

// Build a brand-new book document. Pure (no DB) so it can be unit-tested.
export function buildNewBook(
  ownerId: string,
  opts: { title?: string | undefined; coverStyle?: Book['coverStyle'] | undefined },
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

export function createBookHandlers(): BookHandlers {
  return {
    listMyBooks: async (userId) => {
      const books = await db.getDocs(collections.book, { ownerId: userId });
      return { books };
    },

    getBook: async (userId, { bookId }) => {
      const book = await db.getDoc(collections.book, bookId);
      if (!book || !canReadBook(book, userId)) return { book: null };
      return { book };
    },

    createBook: async (userId, opts) => {
      const book = buildNewBook(userId, opts);
      await db.setDoc(collections.book, book);
      return { id: book._id };
    },

    updateBook: async (userId, { bookId, patch }) => {
      const book = await db.getDoc(collections.book, bookId);
      if (!book) throw new Error('Book not found');
      assertOwner(book, userId);
      // Apply only the provided patch fields; preserve `created`, bump `updated`.
      const updated: Book = { ...book, updated: new Date() };
      if (patch.title !== undefined) updated.title = patch.title;
      if (patch.coverStyle !== undefined) updated.coverStyle = patch.coverStyle;
      if (patch.pages !== undefined) updated.pages = patch.pages;
      if (patch.lecternPos !== undefined) updated.lecternPos = patch.lecternPos;
      if (patch.sharing !== undefined) updated.sharing = patch.sharing;
      await db.setDoc(collections.book, updated);
      return { ok: true };
    },

    deleteBook: async (userId, { bookId }) => {
      const book = await db.getDoc(collections.book, bookId);
      if (!book) return { ok: true };
      assertOwner(book, userId);
      await db.deleteDoc(collections.book, bookId);
      return { ok: true };
    },
  };
}
