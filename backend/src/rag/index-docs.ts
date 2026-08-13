/**
 * Build the vector index: read chunks.json, embed each chunk via
 * nomic-embed-text, and store metadata + embeddings in SQLite.
 *
 * Run with: `npx tsx backend/src/rag/index-docs.ts`
 */
import { readFile } from 'node:fs/promises'
import { CHUNKS_PATH } from './paths'
import type { Chunk } from './chunk'
import { countChunks, ensureDbDir, initSchema, openDb } from './db'
import { embed } from './embed'

async function main() {
  const chunks = JSON.parse(await readFile(CHUNKS_PATH, 'utf8')) as Chunk[]
  if (chunks.length === 0) {
    console.error(`No chunks in ${CHUNKS_PATH}. Run chunk.ts first.`)
    process.exit(1)
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

  console.info(`Indexing ${chunks.length} chunks…`)
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
    if (currentRowid % 10 === 0) console.info(`  embedded ${currentRowid}/${chunks.length}`)
  }

  console.info(`Done. Indexed ${countChunks(db)} chunks.`)
  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
