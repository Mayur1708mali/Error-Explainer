import { InputPanel } from './components/InputPanel'
import { ResultPanel } from './components/ResultPanel'
import { HistorySidebar } from './components/HistorySidebar'
import { OllamaStatusBadge } from './components/OllamaStatusBadge'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            🛠️
          </span>
          <h1 className="app__title">error-bot</h1>
        </div>
        <OllamaStatusBadge />
      </header>

      <div className="app__body">
        <HistorySidebar />

        <main className="app__main">
          <section className="app__pane app__pane--input">
            <InputPanel />
          </section>
          <section className="app__pane app__pane--result">
            <ResultPanel />
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
