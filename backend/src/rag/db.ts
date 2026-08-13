/**
 * SQLite + sqlite-vec setup for the RAG index.
 *
 * Two tables:
 *  - doc_chunks: chunk metadata + text (rowid is the join key)
 *  - vec_chunks: vec0 virtual table holding the 768-dim embeddings
 */
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { Database as DB } from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import { DB_PATH } from './paths'

/** nomic-embed-text produces 768-dimensional vectors. */
export const EMBED_DIM = 768

export type VecDB = DB

/** Open the database and load the sqlite-vec extension. */
export function openDb(path: string = DB_PATH): VecDB {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  sqliteVec.load(db)
  return db
}

/** Create the schema if it does not exist. Safe to call repeatedly. */
export function initSchema(db: VecDB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS doc_chunks (
      rowid     INTEGER PRIMARY KEY,
      chunk_id  TEXT UNIQUE NOT NULL,
      language  TEXT NOT NULL,
      framework TEXT,
      title     TEXT NOT NULL,
      url       TEXT NOT NULL,
      text      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_doc_chunks_language ON doc_chunks(language);
  `)

  db.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(embedding float[${EMBED_DIM}]);`,
  )
}

/** Ensure the parent directory for the database file exists. */
export async function ensureDbDir(path: string = DB_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
}

/** Number of indexed chunks. */
export function countChunks(db: VecDB): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM doc_chunks').get() as { n: number }
  return row.n
}
