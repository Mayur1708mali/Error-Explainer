/** Vector retrieval: embed a query and find the most similar doc chunks. */
import { existsSync } from 'node:fs'
import type { Source } from '../../shared/types'
import { DB_PATH } from './paths'
import { openDb } from './db'
import type { VecDB } from './db'
import { embed } from './embed'

export interface RetrievedChunk {
  chunkId: string
  language: string
  framework: string | null
  title: string
  url: string
  text: string
  /** L2 distance from the query (smaller = closer). */
  distance: number
}

let db: VecDB | null = null

/** Lazily open a shared read connection. Returns null if the index is absent. */
function getDb(): VecDB | null {
  if (db) return db
  if (!existsSync(DB_PATH)) return null
  db = openDb(DB_PATH)
  return db
}

interface RetrieveOptions {
  language?: string | null
  topK?: number
}

/**
 * Retrieve the top-k most similar chunks to `query`, optionally filtered by
 * language. Over-fetches from the vector index and applies the language
 * filter in SQL. Falls back to an unfiltered search if the language filter
 * yields nothing (so we still surface useful context). Returns [] when the
 * index does not exist yet.
 */
export async function retrieve(
  query: string,
  opts: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? 4
  const conn = getDb()
  if (!conn) return []

  const vector = await embed(query)
  // Over-fetch so the language filter still leaves enough candidates.
  const k = Math.max(topK * 5, 20)

  const base = `
    SELECT d.chunk_id AS chunkId, d.language, d.framework, d.title, d.url, d.text, v.distance
    FROM vec_chunks v
    JOIN doc_chunks d ON d.rowid = v.rowid
    WHERE v.embedding MATCH ? AND k = ?`

  const runQuery = (language?: string | null): RetrievedChunk[] => {
    const sql = language
      ? `${base} AND d.language = ? ORDER BY v.distance LIMIT ?`
      : `${base} ORDER BY v.distance LIMIT ?`
    const params = language ? [vector, k, language, topK] : [vector, k, topK]
    return conn.prepare(sql).all(...params) as RetrievedChunk[]
  }

  let rows = runQuery(opts.language ?? undefined)
  if (rows.length === 0 && opts.language) {
    rows = runQuery(undefined)
  }
  return rows
}

/** Build a short snippet (single line, trimmed) from chunk text. */
export function toSnippet(text: string, maxLen = 240): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen).trimEnd()}…` : oneLine
}

/** Convert retrieved chunks into citation Sources (title/url/snippet), deduped by url. */
export function toSources(chunks: RetrievedChunk[]): Source[] {
  const seen = new Set<string>()
  const sources: Source[] = []
  for (const c of chunks) {
    if (seen.has(c.url)) continue
    seen.add(c.url)
    sources.push({ title: c.title, url: c.url, snippet: toSnippet(c.text) })
  }
  return sources
}
