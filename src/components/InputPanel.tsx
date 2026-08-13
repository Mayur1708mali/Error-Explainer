import { useErrorBotStore } from '../store/useErrorBotStore'
import { useAnalyze } from '../hooks/useAnalyze'

/** Error/stack-trace input area with a submit button, wired to POST /analyze. */
export function InputPanel() {
  const currentInput = useErrorBotStore((s) => s.currentInput)
  const setCurrentInput = useErrorBotStore((s) => s.setCurrentInput)
  const clearCurrentInput = useErrorBotStore((s) => s.clearCurrentInput)
  const analyze = useAnalyze()

  const canSubmit = currentInput.trim().length > 0 && !analyze.isPending

  const submit = () => {
    if (!canSubmit) return
    analyze.mutate(currentInput.trim())
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter submits.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form className="input-panel" onSubmit={handleSubmit}>
      <label className="input-panel__label" htmlFor="error-input">
        Paste your error or stack trace
      </label>
      <textarea
        id="error-input"
        className="input-panel__textarea"
        value={currentInput}
        placeholder="e.g. TypeError: Cannot read properties of undefined (reading 'map')…"
        spellCheck={false}
        onChange={(e) => setCurrentInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="input-panel__actions">
        <button
          type="button"
          className="input-panel__clear"
          onClick={clearCurrentInput}
          disabled={!currentInput || analyze.isPending}
          aria-label="Clear input"
        >
          Clear
        </button>
        <button
          type="submit"
          className="input-panel__submit"
          disabled={!canSubmit}
          aria-label={analyze.isPending ? 'Analyzing in progress' : 'Analyze error (⌘ Enter)'}
        >
          {analyze.isPending ? 'Analyzing…' : 'Analyze'}
          <span className="input-panel__hint" aria-hidden="true">⌘↵</span>
        </button>
      </div>
    </form>
  )
}
