/**
 * Shared types used by both the frontend (/src) and backend (/backend).
 * Keep this framework-agnostic so it can be imported from either side.
 */

// AnalyzeResponse / Source are defined by the Zod schema so there is a single
// source of truth for both runtime validation and the TypeScript types.
import type { AnalyzeResponse, Source } from './schema'
export type { AnalyzeResponse, Source }

/** Chat model that can be selected for analysis. Restricted to what we ship. */
export type ChatModel = 'qwen2.5-coder:3b' | 'qwen2.5-coder:7b'

/** The chat model options exposed in the settings picker. */
export const CHAT_MODELS: ChatModel[] = ['qwen2.5-coder:3b', 'qwen2.5-coder:7b']

/** Human-readable labels for each model option. */
export const CHAT_MODEL_LABELS: Record<ChatModel, string> = {
  'qwen2.5-coder:3b': 'Qwen 2.5 Coder 3B (fast)',
  'qwen2.5-coder:7b': 'Qwen 2.5 Coder 7B (accurate)',
}

/** Default chat model used when none is specified. */
export const DEFAULT_CHAT_MODEL: ChatModel = 'qwen2.5-coder:3b'

/** Models that must be pulled in Ollama for the app to work. */
export const REQUIRED_MODELS = ['qwen2.5-coder:3b', 'qwen2.5-coder:7b', 'nomic-embed-text'] as const

/** The request body sent to POST /analyze. */
export interface AnalyzeRequest {
  /** The raw error / stack trace to analyze. */
  input: string
  /** Which chat model to use. Defaults to DEFAULT_CHAT_MODEL server-side. */
  model?: ChatModel
}

/** Presence of a single required model in Ollama. */
export interface ModelStatus {
  name: string
  present: boolean
}

/** Response body of GET /status. */
export interface StatusResponse {
  /** True when Ollama is reachable and all required models are present. */
  ok: boolean
  /** Whether the Ollama server responded at all. */
  ollamaReachable: boolean
  /** Presence of each required model. */
  models: ModelStatus[]
}

/** A past analysis stored in history. */
export interface HistoryItem {
  id: string
  /** The raw error / stack trace the user submitted. */
  input: string
  result: AnalyzeResponse
  /** Unix epoch milliseconds. */
  createdAt: number
}

/** Paginated response from GET /history. */
export interface HistoryPage {
  items: HistoryItem[]
  total: number
  page: number
  pageSize: number
}

/** Connectivity state of the local Ollama server. */
export type OllamaStatus = 'unknown' | 'checking' | 'connected' | 'disconnected' | 'error'

/** Response body of POST /index/rebuild. */
export interface IndexRebuildResponse {
  ok: boolean
  chunksIndexed: number
}

/** Overall backend connectivity from the frontend's perspective. */
export type BackendStatus = 'connected' | 'unreachable' | 'checking'
