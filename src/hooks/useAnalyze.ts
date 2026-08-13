import { useMutation } from '@tanstack/react-query'
import type { AnalyzeResponse } from '@shared/types'
import { analyzeError } from '../lib/api'
import { useErrorBotStore } from '../store/useErrorBotStore'

/**
 * Wraps POST /analyze in a TanStack Query mutation and mirrors its lifecycle
 * into the store so any component (e.g. ResultPanel) can react to it.
 */
export function useAnalyze() {
  const setCurrentResult = useErrorBotStore((s) => s.setCurrentResult)
  const setAnalyzeStatus = useErrorBotStore((s) => s.setAnalyzeStatus)
  const setAnalyzeError = useErrorBotStore((s) => s.setAnalyzeError)
  const fetchHistoryFromBackend = useErrorBotStore((s) => s.fetchHistoryFromBackend)
  const selectedModel = useErrorBotStore((s) => s.selectedModel)

  return useMutation<AnalyzeResponse, Error, string>({
    mutationFn: (input: string) => analyzeError(input, selectedModel),
    onMutate: () => {
      setAnalyzeStatus('pending')
      setAnalyzeError(null)
    },
    onSuccess: (result) => {
      setCurrentResult(result)
      setAnalyzeStatus('idle')
      // Refetch history from backend to get the server-persisted item.
      fetchHistoryFromBackend()
    },
    onError: (error) => {
      setAnalyzeStatus('error')
      setAnalyzeError(error.message)
    },
  })
}
