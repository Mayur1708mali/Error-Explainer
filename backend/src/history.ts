/**
 * Persistence for completed analyses.
 *
 * Stores each validated result in the same SQLite database used by the RAG
 * index. Provides full CRUD for the history feature.
 */
import { randomUUID } from 'node:crypto'
import type { AnalyzeResponse, HistoryItem } from '../../shared/types'
import { openDb, ensureDbDir } from './rag/db'
import type { VecDB } from './rag/db'

let db: VecDB | null = null

function getDb(): VecDB {
  if (db) return db
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

/** Paginated history list response. */
export interface HistoryPage {
  items: HistoryItem[]
  total: number
  page: number
  pageSize: number
}

/** Row shape returned by SELECT on the analyses table. */
interface AnalysisRow {
  id: string
  input: string
  result: string
  created_at: number
}

function rowToHistoryItem(row: AnalysisRow): HistoryItem {
  return {
    id: row.id,
    input: row.input,
    result: JSON.parse(row.result) as AnalyzeResponse,
    createdAt: row.created_at,
  }
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

/**
 * Fetch paginated history, optionally filtered by keyword search across input
 * and result text.
 */
export function getHistory(page = 1, pageSize = 20, keyword?: string): HistoryPage {
  const conn = getDb()
  const offset = (page - 1) * pageSize

  if (keyword && keyword.trim().length > 0) {
    const pattern = `%${keyword.trim()}%`
    const total = (
      conn
        .prepare(
          `SELECT COUNT(*) AS n FROM analyses WHERE input LIKE ? OR result LIKE ?`,
        )
        .get(pattern, pattern) as { n: number }
    ).n

    const rows = conn
      .prepare(
        `SELECT id, input, result, created_at FROM analyses
         WHERE input LIKE ? OR result LIKE ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(pattern, pattern, pageSize, offset) as AnalysisRow[]

    return { items: rows.map(rowToHistoryItem), total, page, pageSize }
  }

  const total = (
    conn.prepare(`SELECT COUNT(*) AS n FROM analyses`).get() as { n: number }
  ).n

  const rows = conn
    .prepare(
      `SELECT id, input, result, created_at FROM analyses
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(pageSize, offset) as AnalysisRow[]

  return { items: rows.map(rowToHistoryItem), total, page, pageSize }
}

/** Fetch a single history item by id, or null if not found. */
export function getHistoryById(id: string): HistoryItem | null {
  const row = getDb()
    .prepare(`SELECT id, input, result, created_at FROM analyses WHERE id = ?`)
    .get(id) as AnalysisRow | undefined
  return row ? rowToHistoryItem(row) : null
}

/** Delete a single history item. Returns true if a row was deleted. */
export function deleteHistoryItem(id: string): boolean {
  const result = getDb().prepare(`DELETE FROM analyses WHERE id = ?`).run(id)
  return result.changes > 0
}

/** Delete all history items. Returns the number of rows deleted. */
export function clearAllHistory(): number {
  const result = getDb().prepare(`DELETE FROM analyses`).run()
  return result.changes
}
