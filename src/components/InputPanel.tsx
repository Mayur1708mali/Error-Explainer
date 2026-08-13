import { useErrorBotStore } from '../store/useErrorBotStore'

/** Error/stack-trace input area with a submit button, wired to the store. */
export function InputPanel() {
  const currentInput = useErrorBotStore((s) => s.currentInput)
  const setCurrentInput = useErrorBotStore((s) => s.setCurrentInput)
  const clearCurrentInput = useErrorBotStore((s) => s.clearCurrentInput)
  const submitCurrentInput = useErrorBotStore((s) => s.submitCurrentInput)

  const canSubmit = currentInput.trim().length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    submitCurrentInput()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter submits.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (canSubmit) submitCurrentInput()
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
          disabled={!currentInput}
        >
          Clear
        </button>
        <button type="submit" className="input-panel__submit" disabled={!canSubmit}>
          Analyze
          <span className="input-panel__hint">⌘↵</span>
        </button>
      </div>
    </form>
  )
}
