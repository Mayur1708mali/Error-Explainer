import { z } from 'zod'

/** A single cited documentation source backing an analysis. */
export const sourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
})

/** A before/after code example illustrating a fix. */
export const codeExampleSchema = z.object({
  /** Short description of what this example demonstrates. */
  description: z.string(),
  /** The broken code snippet. */
  before: z.string(),
  /** The corrected code snippet. */
  after: z.string(),
})

/**
 * The structured result of analyzing an error / stack trace.
 * The LLM is instructed to return JSON matching exactly this shape.
 */
export const analyzeResponseSchema = z.object({
  language: z.string(),
  framework: z.string().nullable(),
  rootCause: z.string(),
  fixSteps: z.array(z.string()),
  /** Model confidence, clamped to 0..1. */
  confidence: z.number().min(0).max(1),
  sources: z.array(sourceSchema),
  /** 1–2 before/after code examples showing the fix in action. */
  examples: z.array(codeExampleSchema),
})

export type Source = z.infer<typeof sourceSchema>
export type CodeExample = z.infer<typeof codeExampleSchema>
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>
