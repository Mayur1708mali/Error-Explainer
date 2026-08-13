import './states.css'

interface LoadingStateProps {
  /** Primary message shown under the spinner. */
  message?: string
  /** Optional secondary line for extra context. */
  hint?: string
}

/** Reusable loading indicator for async sections across the app. */
export function LoadingState({ message = 'Loading…', hint }: LoadingStateProps) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="state__spinner" aria-hidden="true" />
      <p className="state__title">{message}</p>
      {hint ? <p className="state__hint">{hint}</p> : null}
    </div>
  )
}
