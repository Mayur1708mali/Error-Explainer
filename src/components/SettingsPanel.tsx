import { CHAT_MODELS } from '@shared/types'
import type { ChatModel } from '@shared/types'
import { useErrorBotStore } from '../store/useErrorBotStore'

/** Settings: chat model picker passed through to the /analyze call. */
export function SettingsPanel() {
  const selectedModel = useErrorBotStore((s) => s.selectedModel)
  const setSelectedModel = useErrorBotStore((s) => s.setSelectedModel)

  return (
    <div className="settings">
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
            {model}
          </option>
        ))}
      </select>
    </div>
  )
}
