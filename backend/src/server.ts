import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { AnalyzeRequest, ChatModel, ModelStatus, StatusResponse } from '../../shared/types'
import { CHAT_MODELS, DEFAULT_CHAT_MODEL, REQUIRED_MODELS } from '../../shared/types'
import { hasModel, isReachable, listModels } from './ollama'
import { runAnalysis, AnalyzeError } from './analyze'
import { saveAnalysis } from './history'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '127.0.0.1'

/** Input length bounds for /analyze. */
const MIN_INPUT_LENGTH = 8
const MAX_INPUT_LENGTH = 20_000

// The frontend's local dev origin (Vite). Override via CORS_ORIGIN if needed.
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

function isValidModel(value: unknown): value is ChatModel {
  return typeof value === 'string' && (CHAT_MODELS as string[]).includes(value)
}

export async function buildServer() {
  const app = Fastify({ logger: true })

  // Allow the frontend dev origin to call the API from the browser.
  await app.register(cors, {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  })

  // Real health check: Ollama reachable + required models pulled.
  app.get('/status', async (): Promise<StatusResponse> => {
    const reachable = await isReachable()
    if (!reachable) {
      return {
        ok: false,
        ollamaReachable: false,
        models: REQUIRED_MODELS.map((name) => ({ name, present: false })),
      }
    }

    let pulled: string[] = []
    try {
      pulled = await listModels()
    } catch {
      pulled = []
    }

    const models: ModelStatus[] = REQUIRED_MODELS.map((name) => ({
      name,
      present: hasModel(pulled, name),
    }))

    return {
      ok: models.every((m) => m.present),
      ollamaReachable: true,
      models,
    }
  })

  // Analyze an error / stack trace via Ollama, validated against the schema.
  app.post<{ Body: AnalyzeRequest }>('/analyze', async (request, reply) => {
    const input = request.body?.input
    if (typeof input !== 'string' || input.trim().length === 0) {
      return reply
        .status(400)
        .send({ error: 'Field "input" is required and must be a non-empty string.' })
    }

    const trimmed = input.trim()
    // Edge case: too short to be a real error / stack trace (likely garbage).
    if (trimmed.length < MIN_INPUT_LENGTH) {
      return reply.status(400).send({
        error: `Input is too short to analyze (need at least ${MIN_INPUT_LENGTH} characters). Paste the full error or stack trace.`,
      })
    }
    // Edge case: guard against pathologically large inputs.
    if (trimmed.length > MAX_INPUT_LENGTH) {
      return reply.status(413).send({
        error: `Input is too large (max ${MAX_INPUT_LENGTH} characters). Paste only the relevant error and stack trace.`,
      })
    }

    const model = isValidModel(request.body?.model) ? request.body.model : DEFAULT_CHAT_MODEL

    try {
      const result = await runAnalysis(trimmed, model)
      // Persist the validated result (non-fatal on failure).
      try {
        saveAnalysis(trimmed, result)
      } catch (persistErr) {
        request.log.warn({ persistErr }, 'failed to persist analysis')
      }
      return result
    } catch (err) {
      if (err instanceof AnalyzeError) {
        request.log.warn({ err }, 'analysis validation failed')
        return reply.status(502).send({ error: err.message })
      }
      request.log.error({ err }, 'analysis failed')
      const message = err instanceof Error ? err.message : 'Analysis failed.'
      return reply.status(502).send({ error: `Could not analyze: ${message}` })
    }
  })

  return app
}

async function start() {
  const app = await buildServer()
  try {
    await app.listen({ port: PORT, host: HOST })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
