import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    // Include tests from both frontend (src/) and backend dirs
    include: ['backend/src/**/*.test.ts', 'shared/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    // Use node environment for backend/shared tests
    environment: 'node',
  },
})
