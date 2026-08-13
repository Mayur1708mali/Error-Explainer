/**
 * Standalone connectivity check: sends a trivial prompt to Ollama's /api/chat
 * and prints the reply. Run with: `npx tsx backend/src/testOllama.ts`
 */
import { chat, isReachable, listModels, OLLAMA_BASE_URL } from './ollama'
import { DEFAULT_CHAT_MODEL } from '../../shared/types'

async function main() {
  console.info(`Checking Ollama at ${OLLAMA_BASE_URL}…`)

  if (!(await isReachable())) {
    console.error('Ollama is not reachable. Is it running? Try: ollama serve')
    process.exit(1)
  }

  console.info('Pulled models:', await listModels())

  const reply = await chat(DEFAULT_CHAT_MODEL, [
    { role: 'user', content: 'Reply with the single word: pong' },
  ])
  console.info(`Reply from ${DEFAULT_CHAT_MODEL}:`, reply.trim())
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
