/**
 * SystemReminderBlock - Renders system-reminder content with CLAUDE.md highlighting
 *
 * System reminders contain important context that Claude Code reads during sessions,
 * including project documentation (CLAUDE.md), instructions, and other contextual information.
 */

import { useState } from 'react'
import { DocumentTextIcon, BookOpenIcon } from '@heroicons/react/24/outline'

interface SystemReminderBlockProps {
  content: string
  collapsed?: boolean
  hasClaudeMd?: boolean
  claudeMdPaths?: string[]
  reminderType?: 'context' | 'instruction' | 'other'
}

export function SystemReminderBlock({
  content,
  collapsed: initialCollapsed = true,
  hasClaudeMd = false,
  claudeMdPaths = [],
  reminderType = 'other',
}: SystemReminderBlockProps) {
  const [expanded, setExpanded] = useState(!initialCollapsed)

  // Determine visual style based on reminder type
  const borderColor = hasClaudeMd
    ? 'border-warning'
    : reminderType === 'instruction'
      ? 'border-info'
      : 'border-base-300'

  const bgColor = hasClaudeMd
    ? 'bg-warning/5'
    : reminderType === 'instruction'
      ? 'bg-info/5'
      : 'bg-base-200/30'

  const iconColor = hasClaudeMd
    ? 'text-warning'
    : reminderType === 'instruction'
      ? 'text-info'
      : 'text-base-content/60'

  const badgeColor = hasClaudeMd
    ? 'badge-warning'
    : reminderType === 'instruction'
      ? 'badge-info'
      : 'badge-neutral'

  const getTitle = () => {
    if (hasClaudeMd) return 'Project Context'
    if (reminderType === 'instruction') return 'System Instruction'
    return 'Context Reminder'
  }

  const getSummary = () => {
    if (hasClaudeMd && claudeMdPaths.length > 0) {
      return `${claudeMdPaths.length} CLAUDE.md file${claudeMdPaths.length > 1 ? 's' : ''}`
    }
    if (content.length <= 100) return content
    return `${content.substring(0, 100)}...`
  }

  return (
    <div className={`border ${borderColor} ${bgColor} rounded p-3`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {hasClaudeMd ? (
            <BookOpenIcon className={`w-4 h-4 ${iconColor}`} />
          ) : (
            <DocumentTextIcon className={`w-4 h-4 ${iconColor}`} />
          )}
          <span className={`text-xs font-semibold ${iconColor} uppercase`}>{getTitle()}</span>
          {hasClaudeMd && <span className={`badge ${badgeColor} badge-xs`}>CLAUDE.md</span>}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`text-xs ${iconColor} hover:opacity-80 transition-opacity`}
        >
          {expanded ? '▼ Hide' : `▶ Show ${hasClaudeMd ? 'Context' : 'Details'}`}
        </button>
      </div>

      {/* Collapsed summary */}
      {!expanded && <div className="text-xs text-base-content/60 font-mono">{getSummary()}</div>}

      {/* Expanded content */}
      {expanded && (
        <div className="space-y-2">
          {/* Show CLAUDE.md paths if present */}
          {claudeMdPaths.length > 0 && (
            <div className="text-xs bg-base-200 p-2 rounded border border-warning/20">
              <div className="font-semibold mb-1 text-warning">📄 Project Instructions:</div>
              {claudeMdPaths.map((path, i) => (
                <div key={i} className="font-mono text-xs text-secondary pl-4">
                  {path}
                </div>
              ))}
            </div>
          )}

          {/* Show reminder content */}
          <div className="text-xs font-mono text-base-content/70 max-h-96 overflow-auto bg-base-100/50 p-2 rounded">
            {renderHighlightedContent(content, hasClaudeMd)}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Render content with CLAUDE.md highlighting
 */
function renderHighlightedContent(content: string, hasClaudeMd: boolean) {
  if (!hasClaudeMd) {
    return <div className="whitespace-pre-wrap">{content}</div>
  }

  // Split content into lines for better rendering
  const lines = content.split('\n')

  return (
    <div className="space-y-0">
      {lines.map((line, i) => {
        // Highlight lines that contain CLAUDE.md or key markers
        const isClaudeMdLine =
          line.includes('CLAUDE.md') ||
          line.includes('# claudeMd') ||
          line.includes('Codebase and user instructions')

        const isHeaderLine = line.startsWith('# ') || line.startsWith('## ')

        if (isClaudeMdLine) {
          return (
            <div
              key={i}
              className="whitespace-pre-wrap bg-warning/10 border-l-2 border-warning pl-2 py-0.5"
            >
              {highlightClaudeMdInLine(line)}
            </div>
          )
        }

        if (isHeaderLine) {
          return (
            <div key={i} className="whitespace-pre-wrap font-semibold text-warning mt-2">
              {line}
            </div>
          )
        }

        return (
          <div key={i} className="whitespace-pre-wrap">
            {line}
          </div>
        )
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
        if (part.match(/CLAUDE\.md/i)) {
          return (
            <span key={i} className="text-warning font-bold bg-warning/20 px-1 rounded">
              {part}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
