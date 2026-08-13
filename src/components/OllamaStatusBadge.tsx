import type { OllamaStatus, StatusResponse } from '@shared/types'
import { useErrorBotStore } from '../store/useErrorBotStore'

const LABELS: Record<OllamaStatus, string> = {
  unknown: 'Ollama: unknown',
  checking: 'Ollama: checking…',
  connected: 'Ollama: connected',
  disconnected: 'Ollama: not running',
  error: 'Ollama: error',
}

/** Instructions shown for each problem state. */
function StatusDetails({ status, data }: { status: OllamaStatus; data: StatusResponse | null }) {
  if (status === 'disconnected') {
    return (
      <div className="ollama-status-details">
        <p className="ollama-status-details__title">Ollama is not running</p>
        <ol className="ollama-status-details__steps">
          <li>
            Install Ollama from{' '}
            <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">
              ollama.com
            </a>
          </li>
          <li>
            Start the server: <code>ollama serve</code>
          </li>
          <li>The status will update automatically once detected.</li>
        </ol>
      </div>
    )
  }

  if (status === 'error' && data) {
    const missing = data.models.filter((m) => !m.present)
    if (missing.length > 0) {
      return (
        <div className="ollama-status-details">
          <p className="ollama-status-details__title">Required model(s) not pulled</p>
          <p className="ollama-status-details__desc">
            The following models are needed but not found locally:
          </p>
          <ul className="ollama-status-details__models">
            {missing.map((m) => (
              <li key={m.name}>
                <code>ollama pull {m.name}</code>
              </li>
            ))}
          </ul>
          <p className="ollama-status-details__hint">
            Run the commands above in your terminal, then this panel will refresh automatically.
          </p>
        </div>
      )
    }
  }

  return null
}

/** Compact indicator for the local Ollama connection state, with expandable details. */
export function OllamaStatusBadge() {
  const status = useErrorBotStore((s) => s.ollamaStatus)
  const statusData = useErrorBotStore((s) => s.statusData)

  const showDetails = status === 'disconnected' || status === 'error'

  return (
    <div className="ollama-badge-wrapper">
      <span
        className={`ollama-badge ollama-badge--${status}`}
        role="status"
        aria-label={LABELS[status]}
      >
        <span className="ollama-badge__dot" aria-hidden="true" />
        {LABELS[status]}
      </span>
      {showDetails && <StatusDetails status={status} data={statusData} />}
    </div>
  )
}
