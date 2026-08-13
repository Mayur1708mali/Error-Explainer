import { describe, expect, it } from 'vitest'
import { toSnippet, toSources } from './rag/retrieve'
import { adjustConfidence } from './analyze'
import type { RetrievedChunk } from './rag/retrieve'

// ─── toSnippet ──────────────────────────────────────────────────────────────

describe('toSnippet', () => {
  it('collapses internal whitespace into single spaces', () => {
    const input = 'hello   world\n\tnewline\ttab'
    expect(toSnippet(input)).toBe('hello world newline tab')
  })

  it('trims leading and trailing whitespace', () => {
    const input = '   padded text   '
    expect(toSnippet(input)).toBe('padded text')
  })

  it('truncates at maxLen and appends ellipsis', () => {
    const input = 'a'.repeat(300)
    const result = toSnippet(input, 240)
    expect(result.length).toBeLessThanOrEqual(241) // 240 + ellipsis char
    expect(result.endsWith('…')).toBe(true)
  })

  it('does not truncate text shorter than maxLen', () => {
    const input = 'short text'
    expect(toSnippet(input, 240)).toBe('short text')
  })

  it('does not truncate text exactly at maxLen', () => {
    const input = 'x'.repeat(240)
    expect(toSnippet(input, 240)).toBe(input)
  })

  it('respects custom maxLen', () => {
    const input = 'a'.repeat(100)
    const result = toSnippet(input, 50)
    expect(result.length).toBeLessThanOrEqual(51)
    expect(result.endsWith('…')).toBe(true)
  })

  it('handles empty string', () => {
    expect(toSnippet('')).toBe('')
  })

  it('handles whitespace-only string', () => {
    expect(toSnippet('   \n\t  ')).toBe('')
  })

  it('preserves content with mixed newlines and tabs', () => {
    const input = 'line1\r\nline2\rline3'
    expect(toSnippet(input)).toBe('line1 line2 line3')
  })
})

// ─── toSources ──────────────────────────────────────────────────────────────

function makeChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: 'chunk-1',
    language: 'JavaScript',
    framework: null,
    title: 'MDN Array.map()',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map',
    text: 'The map() method creates a new array populated with the results of calling a provided function on every element.',
    distance: 5.2,
    ...overrides,
  }
}

describe('toSources', () => {
  it('converts a single chunk to a source with title, url, snippet', () => {
    const chunks = [makeChunk()]
    const sources = toSources(chunks)
    expect(sources).toHaveLength(1)
    expect(sources[0].title).toBe('MDN Array.map()')
    expect(sources[0].url).toBe(
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map',
    )
    expect(sources[0].snippet).toBeTruthy()
  })

  it('deduplicates chunks with the same URL', () => {
    const chunks = [
      makeChunk({ chunkId: 'c1', text: 'First chunk of the page' }),
      makeChunk({ chunkId: 'c2', text: 'Second chunk of same page' }),
      makeChunk({ chunkId: 'c3', text: 'Third chunk of same page' }),
    ]
    const sources = toSources(chunks)
    expect(sources).toHaveLength(1)
    // Uses the first occurrence's text for snippet
    expect(sources[0].snippet).toContain('First chunk')
  })

  it('keeps chunks with different URLs', () => {
    const chunks = [
      makeChunk({ url: 'https://a.com/doc1', title: 'Doc 1' }),
      makeChunk({ url: 'https://b.com/doc2', title: 'Doc 2' }),
      makeChunk({ url: 'https://c.com/doc3', title: 'Doc 3' }),
    ]
    const sources = toSources(chunks)
    expect(sources).toHaveLength(3)
  })

  it('returns empty array for empty input', () => {
    expect(toSources([])).toEqual([])
  })

  it('preserves ordering (first seen URL wins)', () => {
    const chunks = [
      makeChunk({ url: 'https://first.com', title: 'First' }),
      makeChunk({ url: 'https://second.com', title: 'Second' }),
      makeChunk({ url: 'https://first.com', title: 'First again' }),
    ]
    const sources = toSources(chunks)
    expect(sources).toHaveLength(2)
    expect(sources[0].title).toBe('First')
    expect(sources[1].title).toBe('Second')
  })

  it('produces snippets that are single-line and <= default maxLen', () => {
    const longText = 'word '.repeat(100)
    const chunks = [makeChunk({ text: longText })]
    const sources = toSources(chunks)
    expect(sources[0].snippet).not.toContain('\n')
    expect(sources[0].snippet.length).toBeLessThanOrEqual(241) // 240 + ellipsis
  })
})

// ─── adjustConfidence ───────────────────────────────────────────────────────

describe('adjustConfidence', () => {
  describe('with relevant sources', () => {
    it('returns the model confidence clamped to [0, 1]', () => {
      expect(adjustConfidence(0.85, true)).toBe(0.85)
    })

    it('clamps confidence above 1 to 1', () => {
      expect(adjustConfidence(1.5, true)).toBe(1)
    })

    it('clamps negative confidence to 0', () => {
      expect(adjustConfidence(-0.3, true)).toBe(0)
    })

    it('preserves 0', () => {
      expect(adjustConfidence(0, true)).toBe(0)
    })

    it('preserves 1', () => {
      expect(adjustConfidence(1, true)).toBe(1)
    })

    it('rounds to 2 decimal places', () => {
      const result = adjustConfidence(0.777, true)
      const decimals = result.toString().split('.')[1]?.length ?? 0
      expect(decimals).toBeLessThanOrEqual(2)
    })
  })

  describe('without relevant sources', () => {
    it('scales down by 0.6x', () => {
      // 0.8 * 0.6 = 0.48 → capped at 0.45
      expect(adjustConfidence(0.8, false)).toBe(0.45)
    })

    it('caps at 0.45 for high confidence', () => {
      expect(adjustConfidence(1.0, false)).toBe(0.45)
      expect(adjustConfidence(0.9, false)).toBe(0.45)
      expect(adjustConfidence(0.76, false)).toBe(0.45)
    })

    it('does not cap when scaled value is already below 0.45', () => {
      // 0.5 * 0.6 = 0.30
      expect(adjustConfidence(0.5, false)).toBe(0.3)
    })

    it('returns 0 when model confidence is 0', () => {
      expect(adjustConfidence(0, false)).toBe(0)
    })

    it('clamps negative confidence to 0 before scaling', () => {
      expect(adjustConfidence(-1, false)).toBe(0)
    })

    it('rounds to 2 decimal places', () => {
      // 0.33 * 0.6 = 0.198 → 0.20
      const result = adjustConfidence(0.33, false)
      const decimals = result.toString().split('.')[1]?.length ?? 0
      expect(decimals).toBeLessThanOrEqual(2)
    })

    it('threshold boundary: 0.75 * 0.6 = 0.45 (exactly at cap)', () => {
      expect(adjustConfidence(0.75, false)).toBe(0.45)
    })

    it('just below threshold: 0.74 * 0.6 = 0.444 → rounds to 0.44', () => {
      expect(adjustConfidence(0.74, false)).toBe(0.44)
    })
  })
})
