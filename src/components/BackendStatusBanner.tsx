import { useQueryClient } from '@tanstack/react-query'
import { useErrorBotStore } from '../store/useErrorBotStore'

/**
 * A banner that appears at the top of the app when the backend server is
 * unreachable, with a retry button to trigger a manual reconnect attempt.
 */
export function BackendStatusBanner() {
  const backendStatus = useErrorBotStore((s) => s.backendStatus)
  const queryClient = useQueryClient()

  if (backendStatus !== 'unreachable') return null

  function handleRetry() {
    // Force refetch the status query immediately.
    queryClient.invalidateQueries({ queryKey: ['status'] })
  }

  return (
    <div className="backend-banner" role="alert">
      <div className="backend-banner__content">
        <span className="backend-banner__icon" aria-hidden="true">
          ⚠️
        </span>
        <div className="backend-banner__text">
          <strong>Backend unreachable</strong>
          <p>
            Cannot connect to the error-bot server. Make sure it is running on{' '}
            <code>localhost:3001</code>.
          </p>
          <p className="backend-banner__hint">
            Start it with: <code>npm run dev:backend</code>
          </p>
        </div>
        <button type="button" className="backend-banner__retry" onClick={handleRetry}>
          Retry connection
        </button>
      </div>
    </div>
  )
}
