/**
 * JsonBlock - Renders JSON content with expand/collapse
 */

import { useState } from 'react'

interface JsonBlockProps {
  content: unknown
  collapsed?: boolean
}

export function JsonBlock({ content, collapsed: initialCollapsed = true }: JsonBlockProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  const jsonString = JSON.stringify(content, null, 2)

  return (
    <div className="text-sm">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="text-xs text-secondary hover:text-primary mb-2"
      >
        {collapsed ? '▼ Expand JSON' : '▲ Collapse JSON'}
      </button>
      {!collapsed && (
        <pre className="whitespace-pre-wrap overflow-auto max-h-64 bg-base-200 p-3 rounded-md">
          <code>{jsonString}</code>
        </pre>
      )}
    </div>
  )
}
