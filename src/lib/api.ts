import type { AnalyzeRequest, AnalyzeResponse, ChatModel, StatusResponse } from '@shared/types'

/** Base URL of the backend API. Override with VITE_API_BASE_URL. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

/** Thrown when an API request fails; carries the HTTP status when available. */
export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    if (body?.error) return body.error
  } catch {
    // fall through to a generic message
  }
  return `Request failed with status ${res.status}`
}

/** POST /analyze — send an error / stack trace, get back an analysis. */
export async function analyzeError(input: string, model?: ChatModel): Promise<AnalyzeResponse> {
  const body: AnalyzeRequest = { input, model }
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Could not reach the server. Is the backend running?')
  }
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status)
  }
  return (await res.json()) as AnalyzeResponse
}

/** GET /status — backend + Ollama health and required-model presence. */
export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE_URL}/status`)
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status)
  }
  return (await res.json()) as StatusResponse
}
