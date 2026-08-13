import type { ReactNode } from 'react'
import './states.css'

interface EmptyStateProps {
  /** Short headline describing the empty condition. */
  title: string
  /** Optional supporting description. */
  description?: string
  /** Optional icon or illustration. */
  icon?: ReactNode
  /** Optional call-to-action (e.g. a button). */
  action?: ReactNode
}

/** Reusable empty-state placeholder for lists and panels with no content yet. */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="state state--empty">
      {icon ? (
        <div className="state__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="state__title">{title}</p>
      {description ? <p className="state__hint">{description}</p> : null}
      {action ? <div className="state__action">{action}</div> : null}
    </div>
  )
}
