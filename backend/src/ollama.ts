/** Minimal client for the local Ollama HTTP API. */

export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaChatResponse {
  message?: { role: string; content: string }
  done?: boolean
}

interface OllamaTagsResponse {
  models?: Array<{ name: string; model?: string }>
}

/** Normalize a model tag so "qwen:3b" and "qwen:3b" compare regardless of ":latest". */
function baseName(tag: string): string {
  return tag.endsWith(':latest') ? tag.slice(0, -':latest'.length) : tag
}

/**
 * Call Ollama's /api/chat (non-streaming) and return the assistant's text.
 * @throws if the request fails or Ollama is unreachable.
 */
export async function chat(
  model: string,
  messages: ChatMessage[],
  opts: { format?: 'json'; temperature?: number } = {},
): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      format: opts.format,
      options: { temperature: opts.temperature ?? 0.2 },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Ollama /api/chat failed (${res.status}): ${detail.slice(0, 200)}`)
  }

  const data = (await res.json()) as OllamaChatResponse
  const content = data.message?.content
  if (typeof content !== 'string') {
    throw new Error('Ollama /api/chat returned no message content.')
  }
  return content
}

/** List the models currently pulled in Ollama (normalized names, no :latest). */
export async function listModels(): Promise<string[]> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
  if (!res.ok) {
    throw new Error(`Ollama /api/tags failed (${res.status}).`)
  }
  const data = (await res.json()) as OllamaTagsResponse
  return (data.models ?? []).map((m) => baseName(m.name))
}

/** True if Ollama responds to /api/tags within the timeout. */
export async function isReachable(timeoutMs = 3000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Check whether a given model tag is present (ignoring an implicit :latest). */
export function hasModel(pulled: string[], required: string): boolean {
  const req = baseName(required)
  return pulled.some((p) => p === req)
}
