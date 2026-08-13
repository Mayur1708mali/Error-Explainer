/**
 * Shared types used by both the frontend (/src) and backend (/backend).
 * Keep this framework-agnostic so it can be imported from either side.
 */

/** A single cited documentation source backing an analysis. */
export interface Source {
  title: string
  url: string
  snippet: string
}

/**
 * The structured result of analyzing an error / stack trace.
 * Mirrors the AnalyzeResponse the backend will eventually return
 * (see Phase 4 — validated with Zod).
 */
export interface AnalyzeResponse {
  language: string
  framework: string | null
  rootCause: string
  fixSteps: string[]
  /** Model confidence, 0..1. */
  confidence: number
  sources: Source[]
}

/** The request body sent to POST /analyze. */
export interface AnalyzeRequest {
  /** The raw error / stack trace to analyze. */
  input: string
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

/** Connectivity state of the local Ollama server. */
export type OllamaStatus = 'unknown' | 'checking' | 'connected' | 'disconnected' | 'error'
