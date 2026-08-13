import Fastify from 'fastify'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '127.0.0.1'

export function buildServer() {
  const app = Fastify({ logger: true })

  // Health/connectivity check. Phase 4 will make this reflect real Ollama state.
  app.get('/status', async () => {
    return { status: 'ok' }
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
