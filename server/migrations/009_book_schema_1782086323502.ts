import type { query as pgQuery } from 'ugly-app/server';

// Schema migration: create collection "book"

export async function up(query: typeof pgQuery): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS "book" (
    _id      TEXT PRIMARY KEY,
    data     JSONB NOT NULL,
    created  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
    version  INTEGER NOT NULL DEFAULT 1
  )`);
  await query(`CREATE INDEX IF NOT EXISTS "idx_book_data" ON "book" USING GIN (data)`);
}
