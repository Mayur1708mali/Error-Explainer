import { useState, useEffect } from 'react'
import { useErrorBotStore } from '../store/useErrorBotStore'

const STORAGE_KEY = 'errorbot:onboarding-dismissed'

/**
 * First-run onboarding overlay explaining the Ollama dependency and how to
 * set up error-bot. Shown once until dismissed; remembers via localStorage.
 */
export function OnboardingOverlay() {
  const [visible, setVisible] = useState(false)
  const backendStatus = useErrorBotStore((s) => s.backendStatus)
  const ollamaStatus = useErrorBotStore((s) => s.ollamaStatus)

  useEffect(() => {
    // Only show on first run (not dismissed yet) AND when something is wrong.
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed) return

    // Show onboarding if backend is unreachable or Ollama is not connected
    if (backendStatus === 'unreachable' || ollamaStatus === 'disconnected' || ollamaStatus === 'error') {
      setVisible(true)
    }
  }, [backendStatus, ollamaStatus])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="onboarding-overlay" role="dialog" aria-labelledby="onboarding-title" aria-modal="true">
      <div className="onboarding">
        <h2 className="onboarding__title" id="onboarding-title">
          Welcome to error-bot
        </h2>
        <p className="onboarding__desc">
          error-bot analyzes your errors and stack traces using a local AI model.
          It requires <strong>Ollama</strong> to run on your machine.
        </p>

        <div className="onboarding__steps">
          <h3 className="onboarding__step-heading">Setup steps</h3>
          <ol className="onboarding__list">
            <li>
              <strong>Install Ollama</strong> — Download from{' '}
              <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">
                ollama.com
              </a>
            </li>
            <li>
              <strong>Start Ollama</strong> — Run{' '}
              <code>ollama serve</code> in your terminal
            </li>
            <li>
              <strong>Pull required models</strong> — Run these commands:
              <div className="onboarding__commands">
                <code>ollama pull qwen2.5-coder:3b</code>
                <code>ollama pull qwen2.5-coder:7b</code>
                <code>ollama pull nomic-embed-text</code>
              </div>
            </li>
            <li>
              <strong>Start the backend</strong> — Run{' '}
              <code>npm run dev:backend</code>
            </li>
          </ol>
        </div>

        <p className="onboarding__note">
          Once everything is running, the status indicator in the header will turn green.
          Your data stays fully local — nothing is sent to external servers.
        </p>

        <button type="button" className="onboarding__dismiss" onClick={dismiss}>
          Got it, let's go
        </button>
      </div>
    </div>
  )
}
