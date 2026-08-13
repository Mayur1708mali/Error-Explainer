import { QueryClient } from '@tanstack/react-query'

/** Shared QueryClient for the app. Tuned for a local, single-user tool. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})
