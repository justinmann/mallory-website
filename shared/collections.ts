import { z } from 'zod';
import type { InferDocType } from 'ugly-app/shared';
import { defineCollections, d1 } from 'ugly-app/shared';

// ─── Schemas & Types ─────────────────────────────────────────────────────────

export const TodoSchema = z.object({
  userId: z.string(),
  text: z.string(),
  done: z.boolean(),
});
export type Todo = InferDocType<typeof TodoSchema>;

export const ConversationSchema = z.object({
  type: z.string().default('ai-chat'),
  title: z.string().default(''),
});
export type Conversation = InferDocType<typeof ConversationSchema>;

export const MessageSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  text: z.string(),
});
export type Message = InferDocType<typeof MessageSchema>;

export const CollabDocSchema = z.object({
  yjsState: z.string(),
  serialized: z.string().nullable(),
  lastSyncedAt: z.number(),
});
export type CollabDoc = InferDocType<typeof CollabDocSchema>;

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

// --- Collections ---
// meta options:
//   cache        – cache docs in memory LRU (good for small, frequently read collections)
//   trackable    – emit change events so clients can subscribe to real-time updates
//   public       – allow unauthenticated reads (use sparingly)
//   cascadeFrom  – name of a parent collection: when that parent is deleted, cascade here
//   trackKeys    – fields whose values are used as NATS routing keys for scoped trackDocs
//                  subscriptions. Example: trackKeys: ['chatId'] enables
//                  socket.trackDocs(collections.message, { keys: { chatId: '...' } }, cb)
//
// After adding a collection, run: npm run db:schema-gen && npm run db:migrate
//
// ─── D1-migration index lists ────────────────────────────────────────────────
// D1 (`db: d1`) THROWS UnindexedQueryError on any *filter* field, and any *sort*
// field that is not a top-level column (_id/created/updated/version), unless it
// is covered by a declared index. trackKeys do NOT exempt a field: any collection
// whose trackKey is used in a `socket.trackDocs({ keys: { … } })` subscription is
// re-queried server-side via getDocs({ <key> }) and so the key must be indexed.
// Declare indexes as widened `IndexDef[]`-typed module consts (NOT inline tuples)
// so `defineCollections` stays under TypeScript's mapped-type inference budget.
const todoIndexes: { fields: Record<string, 1 | -1> }[] = [
  // trackDocs('todo', { keys: { userId } }) → getDocs({ userId }) (TodoDemoPage).
  { fields: { userId: 1 } },
];
const messageIndexes: { fields: Record<string, 1 | -1> }[] = [
  // Conversation engine: getDocs(message, { conversationId }, sort{created:-1})
  // and deleteQuery(message, { conversationId }). `created` sort is a top-level
  // column — exempt. Only conversationId needs an index.
  { fields: { conversationId: 1 } },
];
const bookIndexes: { fields: Record<string, 1 | -1> }[] = [
  // listMyBooks: getDocs(book, { ownerId }).
  { fields: { ownerId: 1 } },
];
export const collections = defineCollections({
  todo: {
    schema: TodoSchema,
    meta: { cache: false, trackable: true, public: false, cascadeFrom: null, trackKeys: ['userId'], db: d1 },
    indexes: todoIndexes,
  },
  conversation: {
    schema: ConversationSchema,
    meta: { cache: false, trackable: false, public: false, cascadeFrom: null, db: d1 },
  },
  message: {
    schema: MessageSchema,
    meta: { cache: false, trackable: false, public: false, cascadeFrom: 'conversation', trackKeys: ['conversationId'], db: d1 },
    indexes: messageIndexes,
  },
  collabDoc: {
    schema: CollabDocSchema,
    meta: { cache: false, trackable: false, public: false, cascadeFrom: null, db: d1 },
  },
  book: {
    schema: BookSchema,
    meta: { cache: false, trackable: true, public: false, cascadeFrom: null, trackKeys: ['ownerId'], db: d1 },
    indexes: bookIndexes,
  },
});

export type AppCollections = typeof collections;
