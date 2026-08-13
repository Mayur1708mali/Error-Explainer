import { useState } from 'react'
import { CHAT_MODELS, CHAT_MODEL_LABELS } from '@shared/types'
import type { ChatModel } from '@shared/types'
import { useErrorBotStore } from '../store/useErrorBotStore'
import { rebuildIndexApi } from '../lib/api'

/** Settings: chat model picker and maintenance actions. */
export function SettingsPanel() {
  const selectedModel = useErrorBotStore((s) => s.selectedModel)
  const setSelectedModel = useErrorBotStore((s) => s.setSelectedModel)

  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildResult, setRebuildResult] = useState<string | null>(null)

  async function handleRebuildIndex() {
    setRebuilding(true)
    setRebuildResult(null)
    try {
      const res = await rebuildIndexApi()
      setRebuildResult(`Indexed ${res.chunksIndexed} chunks.`)
    } catch (err) {
      setRebuildResult(err instanceof Error ? err.message : 'Rebuild failed.')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div className="settings">
      <div className="settings__group">
        <label className="settings__label" htmlFor="model-picker">
          Model
        </label>
        <select
          id="model-picker"
          className="settings__select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value as ChatModel)}
        >
          {CHAT_MODELS.map((model) => (
            <option key={model} value={model}>
              {CHAT_MODEL_LABELS[model]}
            </option>
          ))}
        </select>
      </div>

      <div className="settings__group">
        <button
          type="button"
          className="settings__rebuild-btn"
          onClick={handleRebuildIndex}
          disabled={rebuilding}
        >
          {rebuilding ? 'Rebuilding…' : 'Rebuild doc index'}
        </button>
        {rebuildResult && (
          <span className="settings__rebuild-result">{rebuildResult}</span>
        )}
      </div>
    </div>
  )
}
