import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Root for all generated RAG data. Override with DATA_DIR (see Phase 12). */
export const DATA_DIR = process.env.DATA_DIR ?? join(here, '../../data')

/** Scraped documentation pages (one JSON file per source). */
export const DOCS_DIR = join(DATA_DIR, 'docs')

/** Chunked corpus produced from the scraped docs. */
export const CHUNKS_PATH = join(DATA_DIR, 'chunks.json')

/** SQLite database file holding the vector index. */
export const DB_PATH = process.env.DB_PATH ?? join(DATA_DIR, 'errorbot.db')
