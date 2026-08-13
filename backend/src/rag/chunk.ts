/**
 * Split scraped docs into ~300-500 token chunks with overlap.
 *
 * Token counts are approximated from word counts (~1.33 tokens/word), which
 * is good enough for sizing retrieval chunks without a real tokenizer.
 *
 * Run with: `npx tsx backend/src/rag/chunk.ts`
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CHUNKS_PATH, DATA_DIR, DOCS_DIR } from './paths'
import type { ScrapedDoc } from './scrape'

const TOKENS_PER_WORD = 1.33
const TARGET_TOKENS = 400
const OVERLAP_TOKENS = 60

export interface Chunk {
  id: string
  language: string
  framework: string | null
  title: string
  url: string
  text: string
  tokenEstimate: number
}

/** Rough token estimate for a piece of text. */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.round(words * TOKENS_PER_WORD)
}

/**
 * Split text into overlapping chunks sized to ~targetTokens, using a sliding
 * word window. Returns non-empty trimmed chunks.
 */
export function chunkText(
  text: string,
  targetTokens = TARGET_TOKENS,
  overlapTokens = OVERLAP_TOKENS,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const wordsPerChunk = Math.max(1, Math.round(targetTokens / TOKENS_PER_WORD))
  const overlapWords = Math.min(
    wordsPerChunk - 1,
    Math.max(0, Math.round(overlapTokens / TOKENS_PER_WORD)),
  )
  const step = Math.max(1, wordsPerChunk - overlapWords)

  const chunks: string[] = []
  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + wordsPerChunk)
    const chunk = slice.join(' ').trim()
    if (chunk) chunks.push(chunk)
    if (start + wordsPerChunk >= words.length) break
  }
  return chunks
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true })
  const files = (await readdir(DOCS_DIR)).filter((f) => f.endsWith('.json'))
  if (files.length === 0) {
    console.error(`No scraped docs in ${DOCS_DIR}. Run scrape.ts first.`)
    process.exit(1)
  }

  const chunks: Chunk[] = []
  for (const file of files) {
    const doc = JSON.parse(await readFile(join(DOCS_DIR, file), 'utf8')) as ScrapedDoc
    const parts = chunkText(doc.markdown)
    parts.forEach((text, i) => {
      chunks.push({
        id: `${file.replace(/\.json$/, '')}#${i}`,
        language: doc.language,
        framework: doc.framework,
        title: doc.title,
        url: doc.url,
        text,
        tokenEstimate: estimateTokens(text),
      })
    })
    console.info(`  ${doc.title}: ${parts.length} chunks`)
  }

  await writeFile(CHUNKS_PATH, JSON.stringify(chunks, null, 2), 'utf8')
  console.info(`Wrote ${chunks.length} chunks to ${CHUNKS_PATH}`)
}

// Only run when invoked directly (not when imported by tests).
const invokedDirectly = process.argv[1]?.endsWith('chunk.ts')
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
