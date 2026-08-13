/**
 * Persistence for completed analyses.
 *
 * Stores each validated result in the same SQLite database used by the RAG
 * index. Phase 8 will build history endpoints on top of this table.
 */
import { randomUUID } from 'node:crypto'
import type { AnalyzeResponse } from '../../shared/types'
import { openDb, ensureDbDir } from './rag/db'
import type { VecDB } from './rag/db'

let db: VecDB | null = null

function getDb(): VecDB {
  if (db) return db
  // openDb creates the file if needed; ensure the directory exists first.
  void ensureDbDir()
  db = openDb()
  initHistorySchema(db)
  return db
}

/** Create the analyses table if it does not exist. Safe to call repeatedly. */
export function initHistorySchema(conn: VecDB): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id         TEXT PRIMARY KEY,
      input      TEXT NOT NULL,
      result     TEXT NOT NULL,
      language   TEXT NOT NULL,
      framework  TEXT,
      confidence REAL NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);
  `)
}

export interface SavedAnalysis {
  id: string
  createdAt: number
}

/**
 * Persist a validated analysis. Returns the generated id and timestamp.
 * Persistence failures are non-fatal to the request and should be caught by
 * the caller if they must not surface to the client.
 */
export function saveAnalysis(input: string, result: AnalyzeResponse): SavedAnalysis {
  const id = randomUUID()
  const createdAt = Date.now()
  getDb()
    .prepare(
      `INSERT INTO analyses (id, input, result, language, framework, confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input,
      JSON.stringify(result),
      result.language,
      result.framework,
      result.confidence,
      createdAt,
    )
  return { id, createdAt }
}
