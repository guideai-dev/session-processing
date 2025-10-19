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

/**
 * Extract key property to display based on tool name
 */
function getToolDisplayProperty(name: string, input: any): string | null {
  if (!input) return null

  const toolName = name.toLowerCase()

  // Bash/Shell: show command
  if (toolName === 'bash' || toolName === 'shell') {
    return input.command
  }

  // Read/Edit/Write: show file_path or filePath
  if (toolName === 'read' || toolName === 'edit' || toolName === 'write') {
    return input.file_path || input.filePath
  }

  // str_replace_editor: show path
  if (toolName === 'str_replace_editor') {
    return input.path
  }

  // MultiEdit: show file_path
  if (toolName === 'multiedit') {
    return input.file_path
  }

  // Grep/Glob: show pattern
  if (toolName === 'grep' || toolName === 'glob') {
    return input.pattern
  }

  return null
}

export function ToolBlock({ content, collapsed: initialCollapsed = true }: ToolBlockProps) {
  const [showDetails, setShowDetails] = useState(!initialCollapsed)
  const { name, input } = content
  const displayProperty = getToolDisplayProperty(name, input)

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
      {displayProperty && (
        <div className="mt-1 p-3 bg-base-200 rounded-md overflow-x-auto">
          <code className="font-mono text-xs text-primary whitespace-nowrap">{displayProperty}</code>
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
