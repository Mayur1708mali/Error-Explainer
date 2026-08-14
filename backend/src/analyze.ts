import type { AnalyzeResponse, ChatModel } from '../../shared/types'
import { analyzeResponseSchema } from '../../shared/schema'
import { chat } from './ollama'
import { buildAnalyzeMessages, buildRetryMessage } from './prompt'
import { detectLanguage } from './detect'
import { retrieve, toSnippet, toSources } from './rag/retrieve'
import type { RetrievedChunk } from './rag/retrieve'

/**
 * Max L2 distance for a retrieved chunk to be considered relevant. Chunks
 * farther than this (e.g. cross-language fallback matches) are dropped so we
 * don't attach misleading citations or over-state confidence.
 */
const MAX_RELEVANT_DISTANCE = 20

/** Format retrieved chunks into a compact context block for the prompt. */
function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] ${c.title} (${c.url})\n${toSnippet(c.text, 600)}`)
    .join('\n\n')
}

/**
 * Adjust the model's confidence. When no relevant sources were found we can't
 * corroborate the answer, so we scale confidence down and cap it.
 */
export function adjustConfidence(modelConfidence: number, hasRelevantSources: boolean): number {
  const base = Math.max(0, Math.min(1, modelConfidence))
  if (hasRelevantSources) return Number(base.toFixed(2))
  return Number(Math.min(base * 0.6, 0.45).toFixed(2))
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

/**
 * Fill safe defaults for fields small models sometimes omit, but only when the
 * core fields (language + rootCause) are present. This recovers partial output
 * without fabricating the substance of the analysis.
 */
function normalizeCandidate(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const obj = value as Record<string, unknown>
  if (typeof obj.language !== 'string' || typeof obj.rootCause !== 'string') return value

  return {
    language: obj.language,
    framework: typeof obj.framework === 'string' ? obj.framework : null,
    rootCause: obj.rootCause,
    fixSteps: Array.isArray(obj.fixSteps) ? obj.fixSteps : [],
    confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
    sources: Array.isArray(obj.sources) ? obj.sources : [],
    examples: Array.isArray(obj.examples) ? obj.examples : [],
  }
}

/** Parse + validate a raw model response against the AnalyzeResponse schema. */
function parseAndValidate(raw: string): AnalyzeResponse {
  const json = extractJson(raw)
  const parsed = normalizeCandidate(JSON.parse(json))
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
  // Only retrieve when we have a detected language to filter by. Without one
  // (e.g. garbage / non-stack-trace input) any matches would be untrustworthy.
  const retrieved = detected?.language
    ? await retrieve(input, { language: detected.language, topK: 4 })
    : []

  // Keep only chunks close enough to be genuinely relevant.
  const relevant = retrieved.filter((c) => c.distance <= MAX_RELEVANT_DISTANCE)
  const context = relevant.length > 0 ? buildContext(relevant) : undefined
  const citations = toSources(relevant)

  const messages = buildAnalyzeMessages(input, context)

  const finalize = (result: AnalyzeResponse): AnalyzeResponse => ({
    ...result,
    // Prefer real retrieved citations over anything the model invented.
    sources: citations.length > 0 ? citations : [],
    // Downgrade confidence when we couldn't corroborate with sources.
    confidence: adjustConfidence(result.confidence, citations.length > 0),
  })

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
