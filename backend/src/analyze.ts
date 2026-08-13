import type { AnalyzeResponse, ChatModel } from '../../shared/types'
import { analyzeResponseSchema } from '../../shared/schema'
import { chat } from './ollama'
import { buildAnalyzeMessages, buildRetryMessage } from './prompt'

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
  const messages = buildAnalyzeMessages(input)

  // Attempt 1
  const first = await chat(model, messages, { format: 'json' })
  try {
    return parseAndValidate(first)
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
      return parseAndValidate(second)
    } catch (err2) {
      const reason2 = err2 instanceof Error ? err2.message : String(err2)
      throw new AnalyzeError(`Model output failed schema validation after one retry: ${reason2}`)
    }
  }
}
