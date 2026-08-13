import './states.css'

interface ErrorStateProps {
  /** Short headline describing what failed. */
  title?: string
  /** Human-readable detail. Accepts an Error or a string. */
  error?: unknown
  /** Optional retry handler; renders a retry button when provided. */
  onRetry?: () => void
}

function toMessage(error: unknown): string | undefined {
  if (!error) return undefined
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return String(error)
}

/** Reusable error-state panel with an optional retry action. */
export function ErrorState({ title = 'Something went wrong', error, onRetry }: ErrorStateProps) {
  const detail = toMessage(error)
  return (
    <div className="state state--error" role="alert">
      <span className="state__badge" aria-hidden="true">
        !
      </span>
      <p className="state__title">{title}</p>
      {detail ? <p className="state__hint">{detail}</p> : null}
      {onRetry ? (
        <div className="state__action">
          <button type="button" className="state__retry" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  )
}
