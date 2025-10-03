/**
 * ToolResultBlock - Renders tool result content
 */

import { useState } from 'react'

interface ToolResultBlockProps {
  content: any
  collapsed?: boolean
}

export function ToolResultBlock({
  content,
  collapsed: initialCollapsed = true,
}: ToolResultBlockProps) {
  const [showDetails, setShowDetails] = useState(!initialCollapsed)

  const renderContent = () => {
    if (typeof content === 'string') {
      return <div className="whitespace-pre-wrap">{content}</div>
    }

    if (Array.isArray(content)) {
      return (
        <div className="space-y-1">
          {content.map((item, index) => (
            <div key={index} className="p-2 bg-base-200 rounded text-sm">
              {typeof item === 'string' ? (
                <div className="whitespace-pre-wrap">{item}</div>
              ) : (
                <pre className="text-xs overflow-auto">
                  <code>{JSON.stringify(item, null, 2)}</code>
                </pre>
              )}
            </div>
          ))}
        </div>
      )
    }

    return (
      <pre className="text-sm overflow-auto max-h-48 bg-base-200 p-2 rounded font-mono">
        <code>{JSON.stringify(content, null, 2)}</code>
      </pre>
    )
  }

  const getSummary = () => {
    if (typeof content === 'string') {
      if (content.length <= 100) return content
      return `${content.substring(0, 100)}...`
    }

    if (Array.isArray(content)) {
      return `Array with ${content.length} items`
    }

    if (typeof content === 'object') {
      const keys = Object.keys(content)
      return `Object with ${keys.length} properties: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`
    }

    return String(content)
  }

  return (
    <div>
      {showDetails ? (
        renderContent()
      ) : (
        <div className="text-sm text-base-content/70">{getSummary()}</div>
      )}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="ml-2 text-xs text-secondary hover:text-primary"
      >
        {showDetails ? '▲' : '▼'}
      </button>
    </div>
  )
}
