import type { AnalyzeRequest, AnalyzeResponse, ChatModel, HistoryItem, HistoryPage, IndexRebuildResponse, StatusResponse } from '@shared/types'

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

/** GET /history — paginated history list, optionally filtered by keyword. */
export async function fetchHistory(
  page = 1,
  pageSize = 20,
  keyword?: string,
): Promise<HistoryPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (keyword?.trim()) params.set('q', keyword.trim())

  const res = await fetch(`${API_BASE_URL}/history?${params}`)
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status)
  }
  return (await res.json()) as HistoryPage
}

/** GET /history/:id — fetch a single history item. */
export async function fetchHistoryItem(id: string): Promise<HistoryItem> {
  const res = await fetch(`${API_BASE_URL}/history/${encodeURIComponent(id)}`)
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status)
  }
  return (await res.json()) as HistoryItem
}

/** DELETE /history/:id — delete a single history item. */
export async function deleteHistoryItemApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/history/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status)
  }
}

/** DELETE /history — clear all history. */
export async function clearHistoryApi(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/history`, { method: 'DELETE' })
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status)
  }
}

/** POST /index/rebuild — trigger a full doc index rebuild. */
export async function rebuildIndexApi(): Promise<IndexRebuildResponse> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/index/rebuild`, { method: 'POST' })
  } catch {
    throw new ApiError('Could not reach the server. Is the backend running?')
  }
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status)
  }
  return (await res.json()) as IndexRebuildResponse
}
