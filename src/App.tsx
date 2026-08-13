import { InputPanel } from './components/InputPanel'
import { ResultPanel } from './components/ResultPanel'
import { HistorySidebar } from './components/HistorySidebar'
import { OllamaStatusBadge } from './components/OllamaStatusBadge'
import { BackendStatusBanner } from './components/BackendStatusBanner'
import { OnboardingOverlay } from './components/OnboardingOverlay'
import { SettingsPanel } from './components/SettingsPanel'
import { useStatus } from './hooks/useStatus'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import './App.css'

function App() {
  // Poll backend + Ollama health and mirror it into the status badge.
  useStatus()
  // Register global keyboard shortcuts (Cmd+K for history search).
  useKeyboardShortcuts()

  return (
    <div className="app">
      <a href="#error-input" className="sr-only">
        Skip to main content
      </a>
      <OnboardingOverlay />
      <BackendStatusBanner />

      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            🛠️
          </span>
          <h1 className="app__title">error-bot</h1>
        </div>
        <div className="app__header-actions">
          <SettingsPanel />
          <OllamaStatusBadge />
        </div>
      </header>

      <div className="app__body">
        <HistorySidebar />

        <main className="app__main" aria-label="Analysis workspace">
          <section className="app__pane app__pane--input" aria-label="Error input">
            <InputPanel />
          </section>
          <section className="app__pane app__pane--result" aria-label="Analysis results">
            <ResultPanel />
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
