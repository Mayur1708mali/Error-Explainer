import { z } from 'zod'
import type { ChatModel } from '../../shared/types'
import { DEFAULT_CHAT_MODEL } from '../../shared/types'
import { chat } from './ollama'
import type { ChatMessage } from './ollama'
import { detectLanguage } from './detect'
import type { DetectionResult } from './detect'

const CLASSIFY_SYSTEM_PROMPT = `You classify the programming language and framework of an error message or stack trace.
Respond with a SINGLE JSON object and NOTHING else, matching:

{ "language": string, "framework": string | null }

Rules:
- "language" is the primary programming language (e.g. "Python", "JavaScript", "Java").
- "framework" is the framework if clearly identifiable, otherwise null.
- Output valid JSON only, no markdown, no commentary.`

const classificationSchema = z.object({
  language: z.string().min(1),
  framework: z.string().nullable(),
})

function buildMessages(input: string): ChatMessage[] {
  return [
    { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
    { role: 'user', content: `Classify this error or stack trace:\n\n${input}` },
  ]
}

function extractJson(raw: string): string {
  let text = raw.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) text = fence[1].trim()
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) text = text.slice(first, last + 1)
  return text
}

/** Ask the LLM to classify language/framework. Confidence is fixed and modest. */
export async function classifyWithLLM(
  input: string,
  model: ChatModel = DEFAULT_CHAT_MODEL,
): Promise<DetectionResult> {
  const raw = await chat(model, buildMessages(input), { format: 'json' })
  const parsed = classificationSchema.parse(JSON.parse(extractJson(raw)))
  return {
    language: parsed.language,
    framework: parsed.framework,
    confidence: 0.5,
    source: 'llm',
  }
}

/**
 * Detect language/framework: try heuristics first, and only fall back to the
 * LLM when the heuristics are inconclusive.
 */
export async function detectLanguageWithFallback(
  input: string,
  model: ChatModel = DEFAULT_CHAT_MODEL,
): Promise<DetectionResult> {
  const heuristic = detectLanguage(input)
  if (heuristic) return heuristic
  return classifyWithLLM(input, model)
}
