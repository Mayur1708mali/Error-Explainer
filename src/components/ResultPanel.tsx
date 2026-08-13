import { useErrorBotStore } from '../store/useErrorBotStore'
import { EmptyState } from './states'

function confidenceLabel(confidence: number): string {
  const pct = Math.round(confidence * 100)
  return `${pct}% confidence`
}

/** Displays the current analysis result, or an empty state when there is none. */
export function ResultPanel() {
  const result = useErrorBotStore((s) => s.currentResult)

  if (!result) {
    return (
      <div className="result-panel">
        <EmptyState
          title="No analysis yet"
          description="Paste an error or stack trace and hit Analyze to see the root cause and suggested fixes."
        />
      </div>
    )
  }

  return (
    <div className="result-panel">
      <div className="result-panel__meta">
        <span className="tag">{result.language}</span>
        {result.framework ? <span className="tag">{result.framework}</span> : null}
        <span className="tag tag--muted">{confidenceLabel(result.confidence)}</span>
      </div>

      <section className="result-panel__section">
        <h3 className="result-panel__heading">Root cause</h3>
        <p className="result-panel__text">{result.rootCause}</p>
      </section>

      <section className="result-panel__section">
        <h3 className="result-panel__heading">Fix steps</h3>
        <ol className="result-panel__steps">
          {result.fixSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      {result.sources.length > 0 ? (
        <section className="result-panel__section">
          <h3 className="result-panel__heading">Sources</h3>
          <ul className="result-panel__sources">
            {result.sources.map((source, i) => (
              <li key={i}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                <p className="result-panel__snippet">{source.snippet}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
