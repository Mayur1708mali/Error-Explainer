import { describe, expect, it } from 'vitest'
import { analyzeResponseSchema, sourceSchema } from './schema'

// ─── sourceSchema ───────────────────────────────────────────────────────────

describe('sourceSchema', () => {
  it('accepts a valid source object', () => {
    const valid = { title: 'MDN Docs', url: 'https://mdn.io/err', snippet: 'Some snippet' }
    expect(sourceSchema.parse(valid)).toEqual(valid)
  })

  it('rejects when title is missing', () => {
    expect(() => sourceSchema.parse({ url: 'https://x.com', snippet: 'x' })).toThrow()
  })

  it('rejects when url is missing', () => {
    expect(() => sourceSchema.parse({ title: 'T', snippet: 'x' })).toThrow()
  })

  it('rejects when snippet is missing', () => {
    expect(() => sourceSchema.parse({ title: 'T', url: 'https://x.com' })).toThrow()
  })

  it('rejects non-string title', () => {
    expect(() => sourceSchema.parse({ title: 123, url: 'https://x.com', snippet: 'x' })).toThrow()
  })

  it('rejects non-string url', () => {
    expect(() => sourceSchema.parse({ title: 'T', url: 42, snippet: 'x' })).toThrow()
  })

  it('accepts empty strings (schema allows them)', () => {
    const empty = { title: '', url: '', snippet: '' }
    expect(sourceSchema.parse(empty)).toEqual(empty)
  })
})

// ─── analyzeResponseSchema ──────────────────────────────────────────────────

describe('analyzeResponseSchema', () => {
  const validResponse = {
    language: 'Python',
    framework: 'Django',
    rootCause: 'Variable not defined',
    fixSteps: ['Define the variable', 'Restart server'],
    confidence: 0.85,
    sources: [{ title: 'MDN', url: 'https://mdn.io', snippet: 'See docs' }],
    examples: [],
  }

  it('accepts a fully valid response', () => {
    const result = analyzeResponseSchema.parse(validResponse)
    expect(result).toEqual(validResponse)
  })

  it('accepts framework as null', () => {
    const result = analyzeResponseSchema.parse({ ...validResponse, framework: null })
    expect(result.framework).toBeNull()
  })

  it('accepts empty fixSteps array', () => {
    const result = analyzeResponseSchema.parse({ ...validResponse, fixSteps: [] })
    expect(result.fixSteps).toEqual([])
  })

  it('accepts empty sources array', () => {
    const result = analyzeResponseSchema.parse({ ...validResponse, sources: [] })
    expect(result.sources).toEqual([])
  })

  it('accepts confidence = 0 (lower bound)', () => {
    const result = analyzeResponseSchema.parse({ ...validResponse, confidence: 0 })
    expect(result.confidence).toBe(0)
  })

  it('accepts confidence = 1 (upper bound)', () => {
    const result = analyzeResponseSchema.parse({ ...validResponse, confidence: 1 })
    expect(result.confidence).toBe(1)
  })

  it('rejects confidence > 1', () => {
    expect(() =>
      analyzeResponseSchema.parse({ ...validResponse, confidence: 1.5 }),
    ).toThrow()
  })

  it('rejects confidence < 0', () => {
    expect(() =>
      analyzeResponseSchema.parse({ ...validResponse, confidence: -0.1 }),
    ).toThrow()
  })

  it('rejects non-number confidence', () => {
    expect(() =>
      analyzeResponseSchema.parse({ ...validResponse, confidence: 'high' }),
    ).toThrow()
  })

  it('rejects missing language', () => {
    const { language: _, ...noLang } = validResponse
    expect(() => analyzeResponseSchema.parse(noLang)).toThrow()
  })

  it('rejects missing rootCause', () => {
    const { rootCause: _, ...noRoot } = validResponse
    expect(() => analyzeResponseSchema.parse(noRoot)).toThrow()
  })

  it('rejects missing fixSteps', () => {
    const { fixSteps: _, ...noSteps } = validResponse
    expect(() => analyzeResponseSchema.parse(noSteps)).toThrow()
  })

  it('rejects missing confidence', () => {
    const { confidence: _, ...noConf } = validResponse
    expect(() => analyzeResponseSchema.parse(noConf)).toThrow()
  })

  it('rejects missing sources', () => {
    const { sources: _, ...noSources } = validResponse
    expect(() => analyzeResponseSchema.parse(noSources)).toThrow()
  })

  it('rejects fixSteps with non-string elements', () => {
    expect(() =>
      analyzeResponseSchema.parse({ ...validResponse, fixSteps: [1, 2, 3] }),
    ).toThrow()
  })

  it('rejects sources with invalid objects', () => {
    expect(() =>
      analyzeResponseSchema.parse({ ...validResponse, sources: [{ bad: true }] }),
    ).toThrow()
  })

  it('rejects framework as non-string non-null', () => {
    expect(() =>
      analyzeResponseSchema.parse({ ...validResponse, framework: 123 }),
    ).toThrow()
  })

  it('accepts multiple sources', () => {
    const sources = [
      { title: 'A', url: 'https://a.com', snippet: 'a' },
      { title: 'B', url: 'https://b.com', snippet: 'b' },
      { title: 'C', url: 'https://c.com', snippet: 'c' },
    ]
    const result = analyzeResponseSchema.parse({ ...validResponse, sources })
    expect(result.sources).toHaveLength(3)
  })

  it('strips extra properties (Zod strips unknown keys by default)', () => {
    const withExtra = { ...validResponse, extraField: 'should be stripped' }
    const result = analyzeResponseSchema.parse(withExtra)
    expect(result).not.toHaveProperty('extraField')
  })
})
