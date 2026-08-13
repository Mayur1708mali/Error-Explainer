import { z } from 'zod'

/** A single cited documentation source backing an analysis. */
export const sourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
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
})

export type Source = z.infer<typeof sourceSchema>
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>
