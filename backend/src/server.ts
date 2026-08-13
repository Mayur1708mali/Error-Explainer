import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { AnalyzeRequest, ChatModel, IndexRebuildResponse, ModelStatus, StatusResponse } from '../../shared/types'
import { CHAT_MODELS, DEFAULT_CHAT_MODEL, REQUIRED_MODELS } from '../../shared/types'
import { hasModel, isReachable, listModels } from './ollama'
import { runAnalysis, AnalyzeError } from './analyze'
import { saveAnalysis, getHistory, getHistoryById, deleteHistoryItem, clearAllHistory } from './history'
import { rebuildIndex } from './rag/rebuild'

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
    methods: ['GET', 'POST', 'DELETE'],
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

  // ── History endpoints ────────────────────────────────────────────────────

  /** GET /history — paginated list, searchable by keyword. */
  app.get<{ Querystring: { page?: string; pageSize?: string; q?: string } }>(
    '/history',
    async (request) => {
      const page = Math.max(1, Number(request.query.page) || 1)
      const pageSize = Math.min(100, Math.max(1, Number(request.query.pageSize) || 20))
      const keyword = request.query.q?.trim() || undefined
      return getHistory(page, pageSize, keyword)
    },
  )

  /** GET /history/:id — fetch a single history item. */
  app.get<{ Params: { id: string } }>('/history/:id', async (request, reply) => {
    const item = getHistoryById(request.params.id)
    if (!item) {
      return reply.status(404).send({ error: 'History item not found.' })
    }
    return item
  })

  /** DELETE /history/:id — delete a single history item. */
  app.delete<{ Params: { id: string } }>('/history/:id', async (request, reply) => {
    const deleted = deleteHistoryItem(request.params.id)
    if (!deleted) {
      return reply.status(404).send({ error: 'History item not found.' })
    }
    return { ok: true }
  })

  /** DELETE /history — clear all history. */
  app.delete('/history', async () => {
    const count = clearAllHistory()
    return { ok: true, deleted: count }
  })

  // ── Index endpoints ──────────────────────────────────────────────────────

  /** POST /index/rebuild — rebuild the doc vector index from chunks.json. */
  app.post('/index/rebuild', async (_request, reply): Promise<IndexRebuildResponse> => {
    try {
      const chunksIndexed = await rebuildIndex()
      return { ok: true, chunksIndexed }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Index rebuild failed.'
      return reply.status(500).send({ error: message })
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

// Only start the server when this module is run directly (not imported by tests).
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('/server.ts') || process.argv[1].endsWith('/server.js'))

if (isDirectRun) {
  start()
}
