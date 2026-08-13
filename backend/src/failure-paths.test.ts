/**
 * Failure-path tests: verifies graceful behavior when things go wrong.
 *
 * 1. Ollama stopped mid-session (unreachable during /analyze)
 * 2. Malformed model output (unparseable JSON, missing fields, wrong types)
 * 3. Empty doc index (no RAG chunks available)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildServer } from './server'
import type { FastifyInstance } from 'fastify'

// ─── 1. Ollama stopped mid-session ─────────────────────────────────────────

describe('Failure: Ollama unreachable during /analyze', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    // Point Ollama at a port nothing listens on, simulating Ollama being down
    vi.stubEnv('OLLAMA_BASE_URL', 'http://127.0.0.1:19999')
    // Re-import modules so they pick up the new env var
    vi.resetModules()
    const { buildServer: build } = await import('./server')
    app = await build()
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('POST /analyze returns 502 when Ollama is unreachable', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: {
        input: `Traceback (most recent call last):
  File "app.py", line 3, in <module>
    print(user_naem)
NameError: name 'user_naem' is not defined`,
      },
    })

    expect(response.statusCode).toBe(502)
    const body = JSON.parse(response.body)
    expect(body.error).toBeTruthy()
    expect(typeof body.error).toBe('string')
  })

  it('GET /status returns ollamaReachable=false when Ollama is down', async () => {
    const response = await app.inject({ method: 'GET', url: '/status' })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.ollamaReachable).toBe(false)
    expect(body.ok).toBe(false)
    // All models should be reported as not present
    for (const m of body.models) {
      expect(m.present).toBe(false)
    }
  })
})

// ─── 2. Malformed model output ─────────────────────────────────────────────

describe('Failure: Malformed model output', () => {
  let app: FastifyInstance

  afterEach(async () => {
    if (app) await app.close()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  async function setupWithMockedChat(
    mockResponse: string | (() => string),
    mockRetrieve = false,
  ) {
    vi.resetModules()

    if (mockRetrieve) {
      vi.doMock('./rag/retrieve', () => ({
        retrieve: vi.fn().mockResolvedValue([]),
        toSnippet: vi.fn().mockReturnValue(''),
        toSources: vi.fn().mockReturnValue([]),
      }))
    }

    // Mock the ollama module's chat function to return controlled output
    vi.doMock('./ollama', async (importOriginal) => {
      const original = await importOriginal<typeof import('./ollama')>()
      return {
        ...original,
        chat: vi.fn().mockImplementation(() => {
          const response = typeof mockResponse === 'function' ? mockResponse() : mockResponse
          return Promise.resolve(response)
        }),
      }
    })

    const { buildServer: build } = await import('./server')
    app = await build()
    await app.ready()
  }

  const validInput = `Traceback (most recent call last):
  File "app.py", line 3, in <module>
    print(user_naem)
NameError: name 'user_naem' is not defined`

  it('returns 502 when model outputs plain prose (not JSON)', async () => {
    await setupWithMockedChat(
      'I think the error is that user_naem is misspelled. You should fix it.',
    )

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { input: validInput },
    })

    expect(response.statusCode).toBe(502)
    const body = JSON.parse(response.body)
    expect(body.error).toContain('schema validation')
  })

  it('returns 502 when model outputs incomplete JSON (missing required fields)', async () => {
    await setupWithMockedChat(
      JSON.stringify({ language: 'Python' }), // missing rootCause, fixSteps, etc.
    )

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { input: validInput },
    })

    // The normalizeCandidate fills defaults when language+rootCause are present.
    // With only language, it won't normalize, so it should fail validation.
    expect(response.statusCode).toBe(502)
  })

  it('returns 502 when model outputs truncated/broken JSON', async () => {
    await setupWithMockedChat('{"language": "Python", "rootCause": "mis')

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { input: validInput },
    })

    expect(response.statusCode).toBe(502)
    const body = JSON.parse(response.body)
    expect(body.error).toBeTruthy()
  })

  it('returns 502 when model outputs JSON with confidence > 1', async () => {
    await setupWithMockedChat(
      JSON.stringify({
        language: 'Python',
        framework: null,
        rootCause: 'Typo in variable name',
        fixSteps: ['Fix the typo'],
        confidence: 5.0, // invalid: > 1
        sources: [],
      }),
    )

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { input: validInput },
    })

    // Zod rejects confidence > 1 after both attempts
    expect(response.statusCode).toBe(502)
  })

  it('returns 502 when model wraps JSON in markdown fences with extra prose', async () => {
    // extractJson should handle fences, but if there's surrounding junk on retry too...
    const badOutput = `Here's my analysis:
\`\`\`json
not actually valid json at all {{{
\`\`\`
Hope this helps!`
    await setupWithMockedChat(badOutput)

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { input: validInput },
    })

    expect(response.statusCode).toBe(502)
  })

  it('returns 200 when model outputs valid JSON wrapped in markdown fences', async () => {
    const goodFenced = `\`\`\`json
${JSON.stringify({
  language: 'Python',
  framework: null,
  rootCause: 'Variable user_naem is not defined',
  fixSteps: ['Fix the typo to user_name'],
  confidence: 0.9,
  sources: [],
})}
\`\`\``
    await setupWithMockedChat(goodFenced)

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { input: validInput },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.language).toBe('Python')
    expect(body.rootCause).toContain('user_naem')
  })

  it('recovers via normalizeCandidate when fixSteps/sources are missing but core is present', async () => {
    // language + rootCause present → normalizeCandidate fills defaults
    // Also mock retrieve so real RAG index doesn't provide sources
    await setupWithMockedChat(
      JSON.stringify({
        language: 'Python',
        rootCause: 'Typo in variable name',
        // missing: framework, fixSteps, confidence, sources
      }),
      true, // mockRetrieve
    )

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { input: validInput },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.language).toBe('Python')
    expect(body.fixSteps).toEqual([])
    expect(body.sources).toEqual([])
  })

  it('returns 502 when model returns empty string', async () => {
    await setupWithMockedChat('')

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { input: validInput },
    })

    expect(response.statusCode).toBe(502)
  })
})

// ─── 3. Empty doc index ────────────────────────────────────────────────────

describe('Failure: Empty doc index (no RAG chunks)', () => {
  let app: FastifyInstance

  afterEach(async () => {
    if (app) await app.close()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns a valid response with empty sources when RAG retrieves nothing', async () => {
    vi.resetModules()

    // Mock retrieve to return empty (simulating no index / empty DB)
    vi.doMock('./rag/retrieve', () => ({
      retrieve: vi.fn().mockResolvedValue([]),
      toSnippet: vi.fn().mockReturnValue(''),
      toSources: vi.fn().mockReturnValue([]),
    }))

    // Mock chat to return valid JSON so we isolate the "no sources" path
    vi.doMock('./ollama', async (importOriginal) => {
      const original = await importOriginal<typeof import('./ollama')>()
      return {
        ...original,
        chat: vi.fn().mockResolvedValue(
          JSON.stringify({
            language: 'Python',
            framework: null,
            rootCause: 'Variable not defined due to typo',
            fixSteps: ['Correct the variable name'],
            confidence: 0.85,
            sources: [{ title: 'Fake', url: 'https://fake.com', snippet: 'fake' }],
          }),
        ),
      }
    })

    const { buildServer: build } = await import('./server')
    app = await build()
    await app.ready()

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: {
        input: `Traceback (most recent call last):
  File "app.py", line 3, in <module>
    print(user_naem)
NameError: name 'user_naem' is not defined`,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)

    // When RAG returns nothing, sources should be empty (model-invented URLs stripped)
    expect(body.sources).toEqual([])
    // Confidence should be downgraded (no corroborating sources)
    expect(body.confidence).toBeLessThanOrEqual(0.45)
  })

  it('confidence is capped at 0.45 without RAG sources regardless of model confidence', async () => {
    vi.resetModules()

    vi.doMock('./rag/retrieve', () => ({
      retrieve: vi.fn().mockResolvedValue([]),
      toSnippet: vi.fn().mockReturnValue(''),
      toSources: vi.fn().mockReturnValue([]),
    }))

    vi.doMock('./ollama', async (importOriginal) => {
      const original = await importOriginal<typeof import('./ollama')>()
      return {
        ...original,
        chat: vi.fn().mockResolvedValue(
          JSON.stringify({
            language: 'JavaScript',
            framework: 'React',
            rootCause: 'Trying to map over undefined',
            fixSteps: ['Add a null check', 'Initialize state as empty array'],
            confidence: 0.99, // very high model confidence
            sources: [],
          }),
        ),
      }
    })

    const { buildServer: build } = await import('./server')
    app = await build()
    await app.ready()

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: {
        input: `TypeError: Cannot read properties of undefined (reading 'map')
    at UserList (http://localhost:5173/src/UserList.jsx:12:20)
    at renderWithHooks (react-dom.js:12345:18)`,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.confidence).toBeLessThanOrEqual(0.45)
  })
})
