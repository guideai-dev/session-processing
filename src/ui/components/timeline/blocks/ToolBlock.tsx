/**
 * ToolBlock - Renders tool use information
 */

import { useState } from 'react'

interface ToolBlockProps {
  content: {
    name: string
    input: Record<string, unknown>
  }
  collapsed?: boolean
}

/**
 * Extract key property to display based on tool name
 */
function getToolDisplayProperty(name: string, input: Record<string, unknown>): string | null {
  if (!input) return null

  const toolName = name.toLowerCase()

  // Bash/Shell: show command
  if (toolName === 'bash' || toolName === 'shell') {
    return typeof input.command === 'string' ? input.command : null
  }

  // Read/Edit/Write: show file_path or filePath
  if (toolName === 'read' || toolName === 'edit' || toolName === 'write') {
    const filePath = input.file_path || input.filePath
    return typeof filePath === 'string' ? filePath : null
  }

  // str_replace_editor: show command and path
  if (toolName === 'str_replace_editor') {
    const command = typeof input.command === 'string' ? input.command : ''
    const path = typeof input.path === 'string' ? input.path : ''
    if (command && path) {
      return `${command}: ${path}`
    }
    return path || command || null
  }

  // MultiEdit: show file_path
  if (toolName === 'multiedit') {
    return typeof input.file_path === 'string' ? input.file_path : null
  }

  // Grep/Glob: show pattern
  if (toolName === 'grep' || toolName === 'glob') {
    return typeof input.pattern === 'string' ? input.pattern : null
  }

  // Task or fetch
  if (toolName === 'task' || toolName === 'webfetch') {
    return typeof input.prompt === 'string' ? input.prompt : null
  }

  return null
}

export function ToolBlock({ content, collapsed: initialCollapsed = true }: ToolBlockProps) {
  const [showDetails, setShowDetails] = useState(!initialCollapsed)
  const { name, input } = content
  const displayProperty = getToolDisplayProperty(name, input)

  return (
    <div>
      {input && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-secondary hover:text-primary flex items-center gap-1 mb-1"
        >
          <span>{showDetails ? 'Hide' : 'Show'}</span>
          <span>{showDetails ? '▲' : '▼'}</span>
        </button>
      )}
      {displayProperty && (
        <div className="mt-1 p-3 bg-base-200 rounded-md overflow-x-auto">
          <code className="font-mono text-xs text-primary whitespace-nowrap">
            {displayProperty}
          </code>
        </div>
      )}
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
