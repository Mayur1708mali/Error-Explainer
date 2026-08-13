import { create } from 'zustand'
import type { AnalyzeResponse, ChatModel, HistoryItem, OllamaStatus } from '@shared/types'
import { DEFAULT_CHAT_MODEL } from '@shared/types'

/** Lifecycle of an /analyze request, mirrored from the TanStack Query mutation. */
export type AnalyzeStatus = 'idle' | 'pending' | 'error'

interface ErrorBotState {
  /** The current textarea contents (the error / stack trace being edited). */
  currentInput: string
  /** The result of the most recent analysis, or null if none yet. */
  currentResult: AnalyzeResponse | null
  /** Status of the in-flight (or last) analyze request. */
  analyzeStatus: AnalyzeStatus
  /** Error message from the last failed analyze request, if any. */
  analyzeError: string | null
  /** Past analyses, most recent first. */
  historyList: HistoryItem[]
  /** Connectivity state of the local Ollama server. */
  ollamaStatus: OllamaStatus
  /** Chat model selected in settings, passed through to /analyze. */
  selectedModel: ChatModel

  // ── Actions ──────────────────────────────────────────────────────────────
  setCurrentInput: (input: string) => void
  clearCurrentInput: () => void
  setCurrentResult: (result: AnalyzeResponse | null) => void
  setAnalyzeStatus: (status: AnalyzeStatus) => void
  setAnalyzeError: (message: string | null) => void
  addHistoryItem: (item: HistoryItem) => void
  loadHistoryItem: (id: string) => void
  removeHistoryItem: (id: string) => void
  clearHistory: () => void
  setOllamaStatus: (status: OllamaStatus) => void
  setSelectedModel: (model: ChatModel) => void
  reset: () => void
}

const initialState = {
  currentInput: '',
  currentResult: null as AnalyzeResponse | null,
  analyzeStatus: 'idle' as AnalyzeStatus,
  analyzeError: null as string | null,
  historyList: [] as HistoryItem[],
  ollamaStatus: 'unknown' as OllamaStatus,
  selectedModel: DEFAULT_CHAT_MODEL as ChatModel,
}

export const useErrorBotStore = create<ErrorBotState>((set, get) => ({
  ...initialState,

  setCurrentInput: (input) => set({ currentInput: input }),

  clearCurrentInput: () => set({ currentInput: '' }),

  setCurrentResult: (result) => set({ currentResult: result }),

  setAnalyzeStatus: (status) => set({ analyzeStatus: status }),

  setAnalyzeError: (message) => set({ analyzeError: message }),

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

  setSelectedModel: (model) => set({ selectedModel: model }),

  reset: () => set({ ...initialState }),
}))
