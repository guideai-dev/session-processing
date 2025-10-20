/**
 * ThinkingBlock - Renders Gemini thinking/reasoning content with expand/collapse
 */

import { LightBulbIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

interface Thought {
  subject: string
  description: string
  timestamp: string
}

interface ThinkingBlockProps {
  content: Thought[]
  collapsed?: boolean
}

export function ThinkingBlock({ content, collapsed: initialCollapsed = true }: ThinkingBlockProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  if (!Array.isArray(content) || content.length === 0) {
    return null
  }

  const thoughtCount = content.length

  return (
    <div className="text-sm border-l-4 border-secondary/30 pl-3 py-2 bg-secondary/5 rounded-r-md">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 text-xs text-secondary hover:text-primary mb-2 font-medium"
      >
        <LightBulbIcon className="w-4 h-4" />
        <span>
          {collapsed ? '▼' : '▲'} Reasoning ({thoughtCount} thought{thoughtCount !== 1 ? 's' : ''})
        </span>
      </button>
      {!collapsed && (
        <div className="space-y-3 mt-2">
          {content.map(thought => (
            <div
              key={`${thought.timestamp}-${thought.subject}`}
              className="bg-base-100 p-3 rounded-md border border-base-300"
            >
              <div className="font-semibold text-sm text-primary mb-1">{thought.subject}</div>
              <div className="text-sm text-base-content/80 whitespace-pre-wrap">
                {thought.description}
              </div>
              {thought.timestamp && (
                <div className="text-xs text-base-content/50 mt-2">
                  {new Date(thought.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
