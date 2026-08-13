import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { OllamaStatus } from '@shared/types'
import { fetchStatus } from '../lib/api'
import { useErrorBotStore } from '../store/useErrorBotStore'

/**
 * Polls GET /status and mirrors the result into the store's ollamaStatus,
 * statusData, and backendStatus so any component can react to it.
 */
export function useStatus() {
  const setOllamaStatus = useErrorBotStore((s) => s.setOllamaStatus)
  const setStatusData = useErrorBotStore((s) => s.setStatusData)
  const setBackendStatus = useErrorBotStore((s) => s.setBackendStatus)

  const query = useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
    refetchInterval: 15_000,
    retry: false,
  })

  useEffect(() => {
    let next: OllamaStatus
    if (query.isPending) {
      next = 'checking'
      setBackendStatus('checking')
    } else if (query.isError) {
      // Could not reach the backend at all.
      next = 'error'
      setBackendStatus('unreachable')
      setStatusData(null)
    } else {
      setBackendStatus('connected')
      setStatusData(query.data)
      if (!query.data.ollamaReachable) {
        next = 'disconnected'
      } else if (query.data.ok) {
        next = 'connected'
      } else {
        // Ollama is up but a required model is missing.
        next = 'error'
      }
    }
    setOllamaStatus(next)
  }, [query.isPending, query.isError, query.data, setOllamaStatus, setStatusData, setBackendStatus])

  return query
}
