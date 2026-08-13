/**
 * Rebuild the vector index programmatically. Used by POST /index/rebuild.
 * Extracts the core logic from index-docs.ts into a reusable function.
 */
import { readFile } from 'node:fs/promises'
import { CHUNKS_PATH } from './paths'
import type { Chunk } from './chunk'
import { countChunks, ensureDbDir, initSchema, openDb } from './db'
import { embed } from './embed'

/**
 * Rebuild the doc vector index from chunks.json. Deletes existing index data
 * and re-embeds all chunks. Returns the number of chunks indexed.
 */
export async function rebuildIndex(): Promise<number> {
  const raw = await readFile(CHUNKS_PATH, 'utf8')
  const chunks = JSON.parse(raw) as Chunk[]
  if (chunks.length === 0) {
    throw new Error(`No chunks found in ${CHUNKS_PATH}. Run the scrape/chunk pipeline first.`)
  }

  await ensureDbDir()
  const db = openDb()
  initSchema(db)

  // Rebuild from scratch for a deterministic index.
  db.exec('DELETE FROM doc_chunks; DELETE FROM vec_chunks;')

  const insertMeta = db.prepare(
    `INSERT INTO doc_chunks (rowid, chunk_id, language, framework, title, url, text)
     VALUES (@rowid, @chunk_id, @language, @framework, @title, @url, @text)`,
  )
  const insertVec = db.prepare('INSERT INTO vec_chunks (rowid, embedding) VALUES (?, ?)')

  let rowid = 1
  for (const chunk of chunks) {
    const vector = await embed(chunk.text)
    const currentRowid = rowid++
    const write = db.transaction(() => {
      insertMeta.run({
        rowid: currentRowid,
        chunk_id: chunk.id,
        language: chunk.language,
        framework: chunk.framework,
        title: chunk.title,
        url: chunk.url,
        text: chunk.text,
      })
      insertVec.run(BigInt(currentRowid), vector)
    })
    write()
  }

  const total = countChunks(db)
  db.close()
  return total
}
