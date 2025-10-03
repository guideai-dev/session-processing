/**
 * ToolBlock - Renders tool use information
 */

import { useState } from 'react'

interface ToolBlockProps {
  content: {
    name: string
    input: any
  }
  collapsed?: boolean
}

export function ToolBlock({ content, collapsed: initialCollapsed = true }: ToolBlockProps) {
  const [showDetails, setShowDetails] = useState(!initialCollapsed)
  const { name, input } = content

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="font-medium">{name}</span>
        {input && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-secondary hover:text-primary"
          >
            {showDetails ? '▲' : '▼'}
          </button>
        )}
      </div>
      {showDetails && input && (
        <div className="mt-2 p-2 bg-base-200 rounded text-xs">
          <pre className="overflow-auto max-h-32">
            <code>{JSON.stringify(input, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
