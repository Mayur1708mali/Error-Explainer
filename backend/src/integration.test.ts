/**
 * Integration test: exercises the full POST /analyze flow against a REAL
 * running Ollama instance. Requires Ollama to be up with the model
 * qwen2.5-coder:3b pulled.
 *
 * Skip condition: if SKIP_INTEGRATION=1 is set, or Ollama is unreachable,
 * these tests are skipped gracefully.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from './server'
import { analyzeResponseSchema } from '../../shared/schema'
import type { FastifyInstance } from 'fastify'

const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

async function ollamaReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}

describe('POST /analyze — integration (real Ollama)', () => {
  let app: FastifyInstance
  let shouldRun = true

  beforeAll(async () => {
    if (process.env.SKIP_INTEGRATION === '1') {
      shouldRun = false
      return
    }

    const reachable = await ollamaReachable()
    if (!reachable) {
      shouldRun = false
      return
    }

    app = await buildServer()
    await app.ready()
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  it('analyzes a Python NameError and returns valid schema-conformant JSON', async () => {
    if (!shouldRun) return // skip without failing

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: {
        input: `Traceback (most recent call last):
  File "app.py", line 3, in <module>
    print(user_naem)
NameError: name 'user_naem' is not defined`,
        model: 'qwen2.5-coder:3b',
      },
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    // Validate against the Zod schema — this is the real contract
    const parsed = analyzeResponseSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.language).toBe('Python')
      expect(parsed.data.rootCause.length).toBeGreaterThan(0)
      expect(parsed.data.confidence).toBeGreaterThan(0)
      expect(parsed.data.confidence).toBeLessThanOrEqual(1)
    }
  }, 60_000) // LLM inference can be slow

  it('analyzes a JavaScript TypeError', async () => {
    if (!shouldRun) return

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: {
        input: `TypeError: Cannot read properties of undefined (reading 'map')
    at UserList (http://localhost:5173/src/UserList.jsx:12:20)
    at renderWithHooks (http://localhost:5173/node_modules/.vite/deps/react-dom.js:12345:18)`,
        model: 'qwen2.5-coder:3b',
      },
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    const parsed = analyzeResponseSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.language).toBe('JavaScript')
      expect(parsed.data.fixSteps.length).toBeGreaterThan(0)
    }
  }, 60_000)

  it('analyzes a Go panic', async () => {
    if (!shouldRun) return

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: {
        input: `panic: runtime error: invalid memory address or nil pointer dereference
[signal SIGSEGV: segmentation violation code=0x1 addr=0x0 pc=0x47a1b2]

goroutine 1 [running]:
main.main()
\t/app/main.go:15 +0x1d`,
        model: 'qwen2.5-coder:3b',
      },
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    const parsed = analyzeResponseSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.language).toBe('Go')
    }
  }, 60_000)

  it('returns 400 for empty input', async () => {
    if (!shouldRun) return

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { input: '' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 for input too short', async () => {
    if (!shouldRun) return

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { input: 'short' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 413 for input exceeding max length', async () => {
    if (!shouldRun) return

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { input: 'x'.repeat(20_001) },
    })

    expect(response.statusCode).toBe(413)
  })

  it('uses default model when an invalid model is provided', async () => {
    if (!shouldRun) return

    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: {
        input: `Traceback (most recent call last):
  File "app.py", line 1, in <module>
    import nonexistent
ModuleNotFoundError: No module named 'nonexistent'`,
        model: 'not-a-real-model',
      },
    })

    // Server falls back to default model — should still succeed
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(analyzeResponseSchema.safeParse(body).success).toBe(true)
  }, 60_000)
})

describe('GET /status — integration', () => {
  let app: FastifyInstance
  let shouldRun = true

  beforeAll(async () => {
    if (process.env.SKIP_INTEGRATION === '1') {
      shouldRun = false
      return
    }

    const reachable = await ollamaReachable()
    if (!reachable) {
      shouldRun = false
      return
    }

    app = await buildServer()
    await app.ready()
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  it('returns status with ollamaReachable=true when Ollama is up', async () => {
    if (!shouldRun) return

    const response = await app.inject({ method: 'GET', url: '/status' })
    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.ollamaReachable).toBe(true)
    expect(Array.isArray(body.models)).toBe(true)
    expect(body.models.length).toBeGreaterThan(0)

    // Each model entry has name and present fields
    for (const m of body.models) {
      expect(m).toHaveProperty('name')
      expect(m).toHaveProperty('present')
      expect(typeof m.present).toBe('boolean')
    }
  })
})
