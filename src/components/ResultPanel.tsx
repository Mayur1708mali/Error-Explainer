import { useState } from 'react'
import { useErrorBotStore } from '../store/useErrorBotStore'
import { EmptyState, ErrorState, LoadingState } from './states'

function confidenceLabel(confidence: number): string {
  const pct = Math.round(confidence * 100)
  return `${pct}% confidence`
}

/** Copy text to clipboard and briefly show a "Copied" state. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback: no-op if clipboard not available
    }
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      title="Copy to clipboard"
    >
      {copied ? '✓' : '⎘'}
    </button>
  )
}

/** Displays the current analysis result, or loading/error/empty states. */
export function ResultPanel() {
  const result = useErrorBotStore((s) => s.currentResult)
  const analyzeStatus = useErrorBotStore((s) => s.analyzeStatus)
  const analyzeError = useErrorBotStore((s) => s.analyzeError)

  if (analyzeStatus === 'pending') {
    return (
      <div className="result-panel">
        <LoadingState message="Analyzing…" hint="Sending your error to the analyzer." />
      </div>
    )
  }

  if (analyzeStatus === 'error') {
    return (
      <div className="result-panel">
        <ErrorState title="Analysis failed" error={analyzeError ?? undefined} />
      </div>
    )
  }

  if (!result) {
    return (
      <div className="result-panel">
        <EmptyState
          icon={<span>🔍</span>}
          title="No analysis yet"
          description="Paste an error or stack trace on the left and hit Analyze (⌘↵) to see the root cause and suggested fixes."
        />
      </div>
    )
  }

  const allSteps = result.fixSteps.join('\n')

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
        <div className="result-panel__heading-row">
          <h3 className="result-panel__heading">Fix steps</h3>
          <CopyButton text={allSteps} />
        </div>
        <ol className="result-panel__steps">
          {result.fixSteps.map((step, i) => (
            <li key={i}>
              <span className="result-panel__step-text">{step}</span>
              <CopyButton text={step} />
            </li>
          ))}
        </ol>
      </section>

      {result.examples.length > 0 ? (
        <section className="result-panel__section">
          <h3 className="result-panel__heading">Examples</h3>
          <div className="result-panel__examples">
            {result.examples.map((example, i) => (
              <div key={i} className="result-panel__example">
                <p className="result-panel__example-desc">{example.description}</p>
                <div className="result-panel__code-block">
                  <div className="result-panel__code-header">
                    <span className="result-panel__code-label result-panel__code-label--before">Before</span>
                    <CopyButton text={example.before} />
                  </div>
                  <pre className="result-panel__code"><code>{example.before}</code></pre>
                </div>
                <div className="result-panel__code-block">
                  <div className="result-panel__code-header">
                    <span className="result-panel__code-label result-panel__code-label--after">After</span>
                    <CopyButton text={example.after} />
                  </div>
                  <pre className="result-panel__code"><code>{example.after}</code></pre>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
