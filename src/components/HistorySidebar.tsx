import { useErrorBotStore } from '../store/useErrorBotStore'
import { EmptyState } from './states'

function summarize(input: string): string {
  const firstLine = input.split('\n').find((l) => l.trim().length > 0) ?? input
  return firstLine.trim().slice(0, 80)
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Sidebar listing past analyses; clicking one reloads it into the workspace. */
export function HistorySidebar() {
  const historyList = useErrorBotStore((s) => s.historyList)
  const loadHistoryItem = useErrorBotStore((s) => s.loadHistoryItem)
  const removeHistoryItem = useErrorBotStore((s) => s.removeHistoryItem)
  const clearHistory = useErrorBotStore((s) => s.clearHistory)

  return (
    <aside className="history">
      <div className="history__header">
        <h2 className="history__title">History</h2>
        {historyList.length > 0 ? (
          <button type="button" className="history__clear" onClick={clearHistory}>
            Clear all
          </button>
        ) : null}
      </div>

      {historyList.length === 0 ? (
        <EmptyState title="No history yet" description="Analyzed errors will appear here." />
      ) : (
        <ul className="history__list">
          {historyList.map((item) => (
            <li key={item.id} className="history__item">
              <button
                type="button"
                className="history__entry"
                onClick={() => loadHistoryItem(item.id)}
              >
                <span className="history__summary">{summarize(item.input)}</span>
                <span className="history__time">{formatTime(item.createdAt)}</span>
              </button>
              <button
                type="button"
                className="history__delete"
                aria-label="Delete this history item"
                onClick={() => removeHistoryItem(item.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
