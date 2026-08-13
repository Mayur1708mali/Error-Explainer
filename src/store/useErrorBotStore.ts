import { create } from 'zustand'
import type { AnalyzeResponse, BackendStatus, ChatModel, HistoryItem, OllamaStatus, StatusResponse } from '@shared/types'
import { DEFAULT_CHAT_MODEL } from '@shared/types'
import { fetchHistory, deleteHistoryItemApi, clearHistoryApi } from '../lib/api'

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
  /** Whether history is currently being loaded from the backend. */
  historyLoading: boolean
  /** Search keyword for filtering history. */
  historySearch: string
  /** Connectivity state of the local Ollama server. */
  ollamaStatus: OllamaStatus
  /** Full status response from backend (models info). */
  statusData: StatusResponse | null
  /** Whether the backend server itself is reachable. */
  backendStatus: BackendStatus
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
  setHistorySearch: (keyword: string) => void
  fetchHistoryFromBackend: () => Promise<void>
  setOllamaStatus: (status: OllamaStatus) => void
  setStatusData: (data: StatusResponse | null) => void
  setBackendStatus: (status: BackendStatus) => void
  setSelectedModel: (model: ChatModel) => void
  reset: () => void
}

const initialState = {
  currentInput: '',
  currentResult: null as AnalyzeResponse | null,
  analyzeStatus: 'idle' as AnalyzeStatus,
  analyzeError: null as string | null,
  historyList: [] as HistoryItem[],
  historyLoading: false,
  historySearch: '',
  ollamaStatus: 'unknown' as OllamaStatus,
  statusData: null as StatusResponse | null,
  backendStatus: 'checking' as BackendStatus,
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

  removeHistoryItem: async (id) => {
    // Optimistically remove from UI, then call backend.
    set((state) => ({
      historyList: state.historyList.filter((h) => h.id !== id),
    }))
    try {
      await deleteHistoryItemApi(id)
    } catch {
      // Refetch to reconcile if the delete failed.
      get().fetchHistoryFromBackend()
    }
  },

  clearHistory: async () => {
    set({ historyList: [] })
    try {
      await clearHistoryApi()
    } catch {
      get().fetchHistoryFromBackend()
    }
  },

  setHistorySearch: (keyword) => {
    set({ historySearch: keyword })
    get().fetchHistoryFromBackend()
  },

  fetchHistoryFromBackend: async () => {
    set({ historyLoading: true })
    try {
      const keyword = get().historySearch
      const data = await fetchHistory(1, 50, keyword || undefined)
      set({ historyList: data.items })
    } catch {
      // Silently ignore fetch errors — the sidebar will just show stale data.
    } finally {
      set({ historyLoading: false })
    }
  },

  setOllamaStatus: (status) => set({ ollamaStatus: status }),

  setStatusData: (data) => set({ statusData: data }),

  setBackendStatus: (status) => set({ backendStatus: status }),

  setSelectedModel: (model) => set({ selectedModel: model }),

  reset: () => set({ ...initialState }),
}))
