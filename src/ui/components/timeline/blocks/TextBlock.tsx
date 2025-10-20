/**
 * TextBlock - Renders text content with optional markdown rendering
 * Now uses marked + DOMPurify for 10-50x faster performance
 */

import { CodeBracketIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import type { TruncationThreshold } from '../../../utils/markdown'
import {
  DEFAULT_TRUNCATION_THRESHOLD,
  parseMarkdown,
  smartTruncate,
} from '../../../utils/markdown'

interface TextBlockProps {
  content: string
  showRawToggle?: boolean
  truncateThreshold?: TruncationThreshold
}

/**
 * Simple heuristic to detect if text contains markdown
 */
function looksLikeMarkdown(text: string): boolean {
  if (!text || text.length < 10) return false

  // Check for common markdown patterns
  const patterns = [
    /\*\*[^*]+\*\*/, // Bold **text**
    /\*[^*]+\*/, // Italic *text*
    /`[^`]+`/, // Inline code `code`
    /^#{1,6}\s/m, // Headers # Header
    /^\s*[-*+]\s/m, // Unordered lists
    /^\s*\d+\.\s/m, // Ordered lists
    /\[[^\]]+\]\([^)]+\)/, // Links [text](url)
    /```/, // Code blocks
  ]

  return patterns.some(pattern => pattern.test(text))
}

export function TextBlock({
  content,
  showRawToggle = true,
  truncateThreshold = DEFAULT_TRUNCATION_THRESHOLD,
}: TextBlockProps) {
  const [showRaw, setShowRaw] = useState(false)
  const [showExpanded, setShowExpanded] = useState(false)
  const [renderedHtml, setRenderedHtml] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const isMarkdown = looksLikeMarkdown(content)

  // Handle content truncation
  const truncationResult = smartTruncate(content, truncateThreshold)
  const displayContent = showExpanded ? truncationResult.original : truncationResult.truncated
  const shouldShowMore = truncationResult.isTruncated && !showExpanded

  // Parse markdown when content or display mode changes
  useEffect(() => {
    if (!isMarkdown || showRaw) {
      setRenderedHtml('')
      return
    }

    setIsLoading(true)
    parseMarkdown(displayContent, true, true) // Enable syntax highlighting
      .then(html => {
        setRenderedHtml(html)
        setIsLoading(false)
      })
      .catch(err => {
        console.error('Failed to parse markdown:', err)
        setRenderedHtml('')
        setIsLoading(false)
      })
  }, [displayContent, isMarkdown, showRaw])

  // Show raw text view
  if (showRaw || !isMarkdown) {
    return (
      <div className="relative group">
        <div className="whitespace-pre-wrap text-sm text-base-content">{displayContent}</div>

        {/* Show More/Less button for truncated content */}
        {truncationResult.isTruncated && (
          <button
            type="button"
            onClick={() => setShowExpanded(!showExpanded)}
            className="mt-2 text-xs text-primary hover:text-primary-focus underline"
          >
            {shouldShowMore
              ? `Show More (${truncationResult.originalLines - truncationResult.truncatedLines} more lines)`
              : 'Show Less'}
          </button>
        )}

        {/* Raw/Rendered toggle */}
        {showRawToggle && isMarkdown && (
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost"
            title="Show rendered markdown"
          >
            <DocumentTextIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  // Show loading state
  if (isLoading || !renderedHtml) {
    return (
      <div className="relative group">
        <div className="whitespace-pre-wrap text-sm text-base-content opacity-50">
          Loading markdown...
        </div>
      </div>
    )
  }

  // Render parsed markdown with Prism syntax highlighting
  return (
    <div className="relative group">
      <style>{`
        /* Custom markdown styles */
        .markdown-rendered {
          font-size: 0.875rem;
          line-height: 1.5;
        }
        .markdown-rendered h1 {
          font-size: 1.125rem;
          font-weight: 700;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .markdown-rendered h2 {
          font-size: 1rem;
          font-weight: 700;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .markdown-rendered h3 {
          font-size: 0.875rem;
          font-weight: 600;
          margin-top: 0.5rem;
          margin-bottom: 0.25rem;
        }
        .markdown-rendered h4,
        .markdown-rendered h5,
        .markdown-rendered h6 {
          font-size: 0.875rem;
          font-weight: 500;
          margin-top: 0.5rem;
          margin-bottom: 0.25rem;
        }
        .markdown-rendered p {
          margin-bottom: 0.5rem;
        }
        .markdown-rendered ul,
        .markdown-rendered ol {
          margin-bottom: 0.5rem;
          padding-left: 1.5rem;
        }
        .markdown-rendered ul {
          list-style-type: disc;
        }
        .markdown-rendered ol {
          list-style-type: decimal;
        }
        .markdown-rendered li {
          margin-bottom: 0.25rem;
          display: list-item;
        }
        .markdown-rendered li > p {
          display: inline;
          margin: 0;
        }
        .markdown-rendered li > p:not(:only-child) {
          margin-bottom: 0.25rem;
        }
        .markdown-rendered li > ul,
        .markdown-rendered li > ol {
          display: block;
          margin-top: 0.25rem;
        }
        .markdown-rendered code:not([class*="language-"]) {
          background-color: hsl(var(--b2));
          color: hsl(var(--p));
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-family: monospace;
        }
        .markdown-rendered pre {
          padding: 0.75rem;
          border-radius: 0.375rem;
          overflow-x: auto;
          margin: 0.5rem 0;
        }
        .markdown-rendered pre code {
          background-color: transparent;
          padding: 0;
          font-size: 0.8125rem;
        }
        .markdown-rendered a {
          color: hsl(var(--p));
          text-decoration: underline;
        }
        .markdown-rendered a:hover {
          color: hsl(var(--pf));
        }
        .markdown-rendered blockquote {
          border-left: 4px solid hsl(var(--b3));
          padding-left: 0.75rem;
          padding-top: 0.25rem;
          padding-bottom: 0.25rem;
          margin: 0.5rem 0;
          font-style: italic;
          opacity: 0.8;
        }
        .markdown-rendered hr {
          border: none;
          border-top: 1px solid hsl(var(--b3));
          margin: 0.75rem 0;
        }
        .markdown-rendered table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.5rem 0;
        }
        .markdown-rendered th,
        .markdown-rendered td {
          border: 1px solid hsl(var(--b3));
          padding: 0.375rem;
          text-align: left;
        }
        .markdown-rendered th {
          background-color: hsl(var(--b2));
          font-weight: 600;
        }
      `}</style>

      <div
        className="markdown-rendered text-base-content"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

      {/* Show More/Less button for truncated content */}
      {truncationResult.isTruncated && (
        <button
          type="button"
          onClick={() => setShowExpanded(!showExpanded)}
          className="mt-2 text-xs text-primary hover:text-primary-focus underline"
        >
          {shouldShowMore
            ? `Show More (${truncationResult.originalLines - truncationResult.truncatedLines} more lines)`
            : 'Show Less'}
        </button>
      )}

      {/* Raw/Rendered toggle - only visible on hover */}
      {showRawToggle && (
        <button
          type="button"
          onClick={() => setShowRaw(!showRaw)}
          className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost"
          title="Show raw text"
        >
          <CodeBracketIcon className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
