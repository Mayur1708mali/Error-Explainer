import { create } from 'zustand'
import type { AnalyzeResponse, HistoryItem, OllamaStatus } from '@shared/types'

interface ErrorBotState {
  /** The current textarea contents (the error / stack trace being edited). */
  currentInput: string
  /** The result of the most recent analysis, or null if none yet. */
  currentResult: AnalyzeResponse | null
  /** Past analyses, most recent first. */
  historyList: HistoryItem[]
  /** Connectivity state of the local Ollama server. */
  ollamaStatus: OllamaStatus

  // ── Actions ──────────────────────────────────────────────────────────────
  setCurrentInput: (input: string) => void
  clearCurrentInput: () => void
  setCurrentResult: (result: AnalyzeResponse | null) => void
  /** Submit handler stub — no backend call yet (Phase 3 will wire this up). */
  submitCurrentInput: () => void
  addHistoryItem: (item: HistoryItem) => void
  loadHistoryItem: (id: string) => void
  removeHistoryItem: (id: string) => void
  clearHistory: () => void
  setOllamaStatus: (status: OllamaStatus) => void
  reset: () => void
}

const initialState = {
  currentInput: '',
  currentResult: null as AnalyzeResponse | null,
  historyList: [] as HistoryItem[],
  ollamaStatus: 'unknown' as OllamaStatus,
}

export const useErrorBotStore = create<ErrorBotState>((set, get) => ({
  ...initialState,

  setCurrentInput: (input) => set({ currentInput: input }),

  clearCurrentInput: () => set({ currentInput: '' }),

  setCurrentResult: (result) => set({ currentResult: result }),

  submitCurrentInput: () => {
    const input = get().currentInput.trim()
    if (!input) return
    // No backend call yet. Phase 3 wires this to POST /analyze via TanStack Query.
    // For now we just acknowledge the submission by clearing any stale result.
    set({ currentResult: null })
  },

  addHistoryItem: (item) =>
    set((state) => ({
      historyList: [item, ...state.historyList.filter((h) => h.id !== item.id)],
    })),

  loadHistoryItem: (id) => {
    const item = get().historyList.find((h) => h.id === id)
    if (!item) return
    set({ currentInput: item.input, currentResult: item.result })
  },

  removeHistoryItem: (id) =>
    set((state) => ({
      historyList: state.historyList.filter((h) => h.id !== id),
    })),

  clearHistory: () => set({ historyList: [] }),

  setOllamaStatus: (status) => set({ ollamaStatus: status }),

  reset: () => set({ ...initialState }),
}))
