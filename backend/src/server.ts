import Fastify from 'fastify'
import type { AnalyzeRequest } from '../../shared/types'
import { mockAnalyzeResponse } from './mockAnalyze'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '127.0.0.1'

export function buildServer() {
  const app = Fastify({ logger: true })

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
  const app = buildServer()
  try {
    await app.listen({ port: PORT, host: HOST })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
