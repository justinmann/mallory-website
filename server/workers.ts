/**
 * Cloudflare Workers entry — built by `npm run build:workers` and
 * uploaded by Studio's `workers-deploy` step.
 *
 * The Worker exposes:
 *   - `fetch`     — Hono router for HTTP + WS upgrades
 *   - `scheduled` — Cloudflare Cron Triggers → cron handlers
 *   - `queue`     — Cloudflare Queues → worker handlers
 *   - `CollectionDO` / `SessionDO` — Durable Object classes referenced
 *     by `wrangler.toml`'s `[[durable_objects.bindings]]`
 *
 * The handlers below mirror `server/index.ts`. If you only deploy to
 * Workers, you can delete `server/index.ts` and the framework will
 * route everything through this entry point.
 */

import {
  CollectionDO,
  SessionDO,
  createWorkersApp,
} from 'ugly-app/server/adapter/workers';
import type { RequestHandlers } from 'ugly-app';

import { messages, requests } from '../shared/api';
import { collections } from '../shared/collections';
import { cronTasks } from '../shared/cron';
import { createBookHandlers } from './bookHandlers';

// Request handlers run inside the Worker for `fetch` requests. Most
// projects keep these in sync with `server/index.ts`; the book handlers use a
// `createTypedDB`-bound DB that works the same way in both runtimes.
const requestHandlers: Partial<RequestHandlers<typeof requests>> = {
  ...createBookHandlers(),
};

const app = createWorkersApp(
  { requests, messages },
  requestHandlers,
  collections,
  (cfg) => {
    // No cron handlers: `shared/cron.ts` declares an empty registry.
    cfg.setWorkers(cronTasks, {});
  },
);

export default app;
export { CollectionDO, SessionDO };
