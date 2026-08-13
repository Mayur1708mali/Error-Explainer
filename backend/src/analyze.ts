import type { AnalyzeResponse, ChatModel } from '../../shared/types'
import { analyzeResponseSchema } from '../../shared/schema'
import { chat } from './ollama'
import { buildAnalyzeMessages, buildRetryMessage } from './prompt'
import { detectLanguage } from './detect'
import { retrieve, toSnippet, toSources } from './rag/retrieve'
import type { RetrievedChunk } from './rag/retrieve'

/** Format retrieved chunks into a compact context block for the prompt. */
function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] ${c.title} (${c.url})\n${toSnippet(c.text, 600)}`)
    .join('\n\n')
}

/** Strip accidental ``` fences and extract the outermost JSON object. */
function extractJson(raw: string): string {
  let text = raw.trim()
  // Remove ```json ... ``` or ``` ... ``` fences if the model added them.
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) text = fence[1].trim()
  // Fall back to the first {...} block if there is surrounding prose.
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1)
  }
  return text
}

/** Parse + validate a raw model response against the AnalyzeResponse schema. */
function parseAndValidate(raw: string): AnalyzeResponse {
  const json = extractJson(raw)
  const parsed = JSON.parse(json) as unknown
  return analyzeResponseSchema.parse(parsed)
}

export class AnalyzeError extends Error {}

/**
 * Run an analysis via Ollama, validating the JSON against the Zod schema.
 * Retries once with a stricter instruction if the first response is invalid.
 */
export async function runAnalysis(input: string, model: ChatModel): Promise<AnalyzeResponse> {
  // RAG: detect the language (heuristics), retrieve relevant doc chunks, and
  // pass them to the model as grounding context.
  const detected = detectLanguage(input)
  const retrieved = await retrieve(input, { language: detected?.language, topK: 4 })
  const context = retrieved.length > 0 ? buildContext(retrieved) : undefined
  const citations = toSources(retrieved)

  const messages = buildAnalyzeMessages(input, context)

  const finalize = (result: AnalyzeResponse): AnalyzeResponse => {
    // Prefer real retrieved citations over anything the model invented.
    return citations.length > 0 ? { ...result, sources: citations } : result
  }

  // Attempt 1
  const first = await chat(model, messages, { format: 'json' })
  try {
    return finalize(parseAndValidate(first))
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)

    // Attempt 2 (retry): feed back the failure and ask for valid JSON only.
    const retryMessages = [
      ...messages,
      { role: 'assistant' as const, content: first },
      buildRetryMessage(reason),
    ]
    const second = await chat(model, retryMessages, { format: 'json' })
    try {
      return finalize(parseAndValidate(second))
    } catch (err2) {
      const reason2 = err2 instanceof Error ? err2.message : String(err2)
      throw new AnalyzeError(`Model output failed schema validation after one retry: ${reason2}`)
    }
  }
}
