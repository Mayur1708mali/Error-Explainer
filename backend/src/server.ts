import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { AnalyzeRequest } from '../../shared/types'
import { mockAnalyzeResponse } from './mockAnalyze'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '127.0.0.1'

// The frontend's local dev origin (Vite). Override via CORS_ORIGIN if needed.
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

export async function buildServer() {
  const app = Fastify({ logger: true })

  // Allow the frontend dev origin to call the API from the browser.
  await app.register(cors, {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  })

  // Health/connectivity check. Phase 4 will make this reflect real Ollama state.
  app.get('/status', async () => {
    return { status: 'ok' }
  })

  // Analyze an error / stack trace. Returns a hardcoded mock for now;
  // Phase 4+ will run a real Ollama-backed analysis.
  app.post<{ Body: AnalyzeRequest }>('/analyze', async (request, reply) => {
    const input = request.body?.input
    if (typeof input !== 'string' || input.trim().length === 0) {
      return reply.status(400).send({ error: 'Field "input" is required and must be a non-empty string.' })
    }
    return mockAnalyzeResponse
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
