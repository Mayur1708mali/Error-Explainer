import type { OllamaStatus } from '@shared/types'
import { useErrorBotStore } from '../store/useErrorBotStore'

const LABELS: Record<OllamaStatus, string> = {
  unknown: 'Ollama: unknown',
  checking: 'Ollama: checking…',
  connected: 'Ollama: connected',
  disconnected: 'Ollama: not running',
  error: 'Ollama: error',
}

/** Compact indicator for the local Ollama connection state. */
export function OllamaStatusBadge() {
  const status = useErrorBotStore((s) => s.ollamaStatus)
  return (
    <span className={`ollama-badge ollama-badge--${status}`}>
      <span className="ollama-badge__dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  )
}
