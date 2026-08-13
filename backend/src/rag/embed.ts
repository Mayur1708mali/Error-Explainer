/** Embedding helper using Ollama's nomic-embed-text model. */
import { OLLAMA_BASE_URL } from '../ollama'

export const EMBED_MODEL = 'nomic-embed-text'

interface EmbeddingsResponse {
  embedding?: number[]
}

/**
 * Embed a single piece of text. Returns a Float32Array suitable for binding
 * directly into a sqlite-vec vec0 column.
 * @throws if Ollama is unreachable or returns no embedding.
 */
export async function embed(text: string): Promise<Float32Array> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Ollama /api/embeddings failed (${res.status}): ${detail.slice(0, 200)}`)
  }
  const data = (await res.json()) as EmbeddingsResponse
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Ollama /api/embeddings returned no embedding.')
  }
  return Float32Array.from(data.embedding)
}
