/**
 * ToolResultBlock - Renders tool result content
 */

import { DocumentTextIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { extractClaudeMdFromToolResult } from '../../../utils/systemReminderParser.js'

type ToolResultContent = string | Array<string | Record<string, unknown>> | Record<string, unknown>

interface ToolResultBlockProps {
  content: ToolResultContent
  collapsed?: boolean
}

export function ToolResultBlock({
  content,
  collapsed: initialCollapsed = true,
}: ToolResultBlockProps) {
  const [showDetails, setShowDetails] = useState(!initialCollapsed)

  const renderContent = () => {
    if (typeof content === 'string') {
      // Check if this is a file listing with CLAUDE.md
      const claudeMdFiles = extractClaudeMdFromToolResult(content)

      if (claudeMdFiles.length > 0) {
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs bg-warning/10 border border-warning/20 rounded p-2">
              <DocumentTextIcon className="w-4 h-4 text-warning flex-shrink-0" />
              <span className="text-warning font-semibold">
                Found {claudeMdFiles.length} CLAUDE.md file{claudeMdFiles.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="whitespace-pre-wrap font-mono text-xs">
              {highlightClaudeMd(content)}
            </div>
          </div>
        )
      }

      return <div className="whitespace-pre-wrap">{content}</div>
    }

    if (Array.isArray(content)) {
      return (
        <div className="space-y-1">
          {content.map((item, index) => {
            // Generate stable key from content
            const itemKey =
              typeof item === 'string'
                ? `item-${index}-${item.substring(0, 30).replace(/\s/g, '')}`
                : `item-${index}-${JSON.stringify(item).substring(0, 30)}`

            return (
              <div key={itemKey} className="p-2 bg-base-200 rounded text-sm">
                {typeof item === 'string' ? (
                  <div className="whitespace-pre-wrap">{item}</div>
                ) : (
                  <pre className="text-xs overflow-auto">
                    <code>{JSON.stringify(item, null, 2)}</code>
                  </pre>
                )}
              </div>
            )
          })}
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

/**
 * Highlight lines containing CLAUDE.md
 */
function highlightClaudeMd(text: string) {
  const lines = text.split('\n')

  return (
    <div>
      {lines.map((line, i) => {
        const lineKey = `line-${i}-${line.substring(0, 20).replace(/\s/g, '')}`

        if (line.includes('CLAUDE.md')) {
          return (
            <div key={lineKey} className="bg-warning/10 border-l-2 border-warning pl-2 py-0.5">
              {highlightClaudeMdInLine(line)}
            </div>
          )
        }
        return <div key={lineKey}>{line}</div>
      })}
    </div>
  )
}

/**
 * Highlight CLAUDE.md mentions within a line
 */
function highlightClaudeMdInLine(line: string) {
  const parts = line.split(/(CLAUDE\.md)/gi)

  return (
    <>
      {parts.map((part, i) => {
        const partKey = `part-${i}-${part.substring(0, 10)}`

        if (part.match(/CLAUDE\.md/i)) {
          return (
            <span key={partKey} className="text-warning font-bold bg-warning/20 px-1 rounded">
              {part}
            </span>
          )
        }
        return <span key={partKey}>{part}</span>
      })}
    </>
  )
}
