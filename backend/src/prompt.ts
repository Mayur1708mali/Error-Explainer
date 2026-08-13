import type { ChatMessage } from './ollama'

/**
 * System prompt instructing the model to act as an error analyzer and return
 * ONLY a JSON object matching AnalyzeResponse. Kept strict to maximize the
 * chance the raw output parses and validates against the Zod schema.
 */
export const SYSTEM_PROMPT = `You are error-bot, an expert software debugging assistant.
You are given a raw error message or stack trace. Analyze it and respond.

Respond with a SINGLE JSON object and NOTHING else. No markdown, no code fences,
no commentary before or after. The JSON MUST match this exact shape:

{
  "language": string,           // primary programming language, e.g. "JavaScript", "Python"
  "framework": string | null,   // framework if identifiable, else null
  "rootCause": string,          // concise explanation of what actually went wrong
  "fixSteps": string[],         // ordered, concrete steps to fix it
  "confidence": number,         // your confidence from 0 to 1
  "sources": [                  // supporting references; use [] if none
    { "title": string, "url": string, "snippet": string }
  ]
}

Rules:
- Output valid JSON only. Do not wrap it in \`\`\` fences.
- "confidence" must be a number between 0 and 1 inclusive.
- If you cannot identify a framework, set "framework" to null (not "none").
- If you have no reliable sources, set "sources" to an empty array [].
- Keep "rootCause" focused on the actual cause, not generic advice.`

/**
 * Build the chat messages for analyzing a given error/stack-trace input.
 * When `context` (retrieved documentation) is provided, it is added as
 * grounding material the model should prefer over its own recollection.
 */
export function buildAnalyzeMessages(input: string, context?: string): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]

  if (context && context.trim().length > 0) {
    messages.push({
      role: 'system',
      content: `Use the following documentation excerpts as authoritative context. Prefer them over your own memory when they are relevant. Do not invent URLs.\n\n${context}`,
    })
  }

  messages.push({ role: 'user', content: `Analyze this error or stack trace:\n\n${input}` })
  return messages
}

/**
 * A stricter follow-up user message used on the automatic retry when the first
 * response failed schema validation.
 */
export function buildRetryMessage(validationError: string): ChatMessage {
  return {
    role: 'user',
    content: `Your previous response did not match the required JSON schema (${validationError}). Respond again with ONLY the valid JSON object, no other text.`,
  }
}
