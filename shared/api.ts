import { authReq, req, defineMessages, defineRequests, frameworkMessages, frameworkRequests, z } from 'ugly-app/shared';

// ─── Book shapes ──────────────────────────────────────────────────────────────
// The full persisted book (what the server returns), and the patch shape used to
// update one. Kept here so every book endpoint stays in sync.
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
  // created/updated/version exist on the stored doc but the UI doesn't use them,
  // so we leave them off the wire shape (zod strips the extras).
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

export const requests = defineRequests({
  // ─── Books ──────────────────────────────────────────────────────────────────
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

  // Todo demo — CRUD requests
  createTodo: authReq({
    input: z.object({ text: z.string().min(1).max(500) }),
    output: z.object({ id: z.string() }),
  }),

  toggleTodo: authReq({
    input: z.object({ todoId: z.string() }),
    output: z.object({ done: z.boolean() }),
  }),

  deleteTodo: authReq({
    input: z.object({ todoId: z.string() }),
    output: z.object({ ok: z.boolean() }),
  }),

  // Push notification test — send a push via ugly.bot
  sendPush: authReq({
    input: z.object({
      targetUserId: z.string(),
      title: z.string().min(1).max(200),
      body: z.string().max(500),
      path: z.string(),
      query: z.record(z.string(), z.string()).optional(),
      imageUrl: z.string().optional(),
    }),
    output: z.object({ sent: z.boolean() }),
    rateLimit: { max: 10, window: 60 },
  }),

  // Email test — send an email via the app's email sender
  sendTestEmail: authReq({
    input: z.object({
      userId: z.string().min(1),
      subject: z.string().min(1).max(200),
      html: z.string().min(1),
      id: z.string().max(100).optional(),
    }),
    output: z.object({ ok: z.boolean() }),
    rateLimit: { max: 5, window: 60 },
  }),

  // Error test — intentionally throws to test error capture
  triggerTestError: authReq({
    input: z.object({ message: z.string().optional() }),
    output: z.object({ ok: z.boolean() }),
  }),

  // Worker task tests — verify exception, DB mutation, and console.error
  testWorkerThrow: authReq({
    input: z.object({ message: z.string().optional() }),
    output: z.object({ ok: z.boolean() }),
  }),

  testWorkerDbMutation: authReq({
    input: z.object({ text: z.string().min(1).max(500) }),
    output: z.object({ id: z.string(), verified: z.boolean() }),
  }),

  testWorkerConsoleError: authReq({
    input: z.object({ message: z.string().optional() }),
    output: z.object({ logged: z.boolean() }),
  }),

  // Perf test — records a perf entry through the framework's perf API
  triggerTestPerf: authReq({
    input: z.object({
      operation: z.string().min(1).max(200),
      durationMs: z.number().int().min(0).max(60_000),
    }),
    output: z.object({ ok: z.boolean() }),
  }),

  // Feedback test — records a feedback entry through the data-proxy capture
  // path so devTunnelId is stamped from the project's JWT (matches what
  // `ugly-app feedback:dev` filters on).
  triggerTestFeedback: authReq({
    input: z.object({
      type: z.enum(['bug', 'design', 'feature']),
      description: z.string().min(1).max(2000),
    }),
    output: z.object({ ok: z.boolean() }),
  }),

  // Example: public request — userId is string | null
  // getPublicData: req({
  //   input: z.object({ id: z.string() }),
  //   output: z.object({ data: z.string() }),
  // }),
});

export const messages = defineMessages({
  // Example fire-and-forget (with Zod):
  // userTyping: msg(z.object({ channelId: z.string() })),
  //
  // Example RPC (with Zod):
  // getOnlineUsers: rpcMsg({
  //   data: z.object({ channelId: z.string() }),
  //   response: z.object({ userIds: z.array(z.string()) }),
  // }),
});

export type { authReq };

export interface AppRegistry {
  requests: typeof frameworkRequests & typeof requests;
  messages: typeof frameworkMessages & typeof messages;
}
