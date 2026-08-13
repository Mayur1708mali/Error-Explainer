import { useEffect, useRef } from 'react'
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
  const historyLoading = useErrorBotStore((s) => s.historyLoading)
  const historySearch = useErrorBotStore((s) => s.historySearch)
  const setHistorySearch = useErrorBotStore((s) => s.setHistorySearch)
  const loadHistoryItem = useErrorBotStore((s) => s.loadHistoryItem)
  const removeHistoryItem = useErrorBotStore((s) => s.removeHistoryItem)
  const clearHistory = useErrorBotStore((s) => s.clearHistory)
  const fetchHistoryFromBackend = useErrorBotStore((s) => s.fetchHistoryFromBackend)

  // Fetch history from backend on mount.
  const didFetch = useRef(false)
  useEffect(() => {
    if (!didFetch.current) {
      didFetch.current = true
      fetchHistoryFromBackend()
    }
  }, [fetchHistoryFromBackend])

  // Debounce search input.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(value: string) {
    // Update the input immediately for responsiveness.
    useErrorBotStore.setState({ historySearch: value })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setHistorySearch(value)
    }, 300)
  }

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

      <div className="history__search">
        <input
          type="search"
          className="history__search-input"
          placeholder="Search history… (⌘K)"
          value={historySearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          aria-label="Search history"
        />
      </div>

      {historyLoading && historyList.length === 0 ? (
        <p className="history__loading" role="status">Loading…</p>
      ) : historyList.length === 0 ? (
        <EmptyState
          icon={<span>{historySearch ? '🔎' : '📋'}</span>}
          title={historySearch ? 'No matches' : 'No history yet'}
          description={
            historySearch
              ? 'Try a different search term.'
              : 'Analyzed errors will appear here. Use ⌘K to search.'
          }
        />
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
