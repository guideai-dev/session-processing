/**
 * TextBlock - Renders text content with optional markdown rendering
 */

import { CodeBracketIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import type { ComponentPropsWithoutRef } from 'react'
import { useEffect, useState } from 'react'
import type { Components } from 'react-markdown'

interface TextBlockProps {
  content: string
}

interface MarkdownDeps {
  ReactMarkdown: typeof import('react-markdown').default
  Prism: typeof import('react-syntax-highlighter/dist/esm/prism').default
  oneDark: Record<string, unknown>
  oneLight: Record<string, unknown>
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

/**
 * Load markdown dependencies dynamically (optional peer deps)
 * Uses full Prism build with all languages included
 */
async function loadMarkdownDeps(): Promise<MarkdownDeps | null> {
  try {
    const [markdown, prismModule, oneDarkStyle, oneLightStyle] = await Promise.all([
      import('react-markdown'),
      import('react-syntax-highlighter/dist/esm/prism'),
      import('react-syntax-highlighter/dist/esm/styles/prism/one-dark'),
      import('react-syntax-highlighter/dist/esm/styles/prism/one-light'),
    ])

    return {
      ReactMarkdown: markdown.default,
      Prism: prismModule.default,
      oneDark: oneDarkStyle.default,
      oneLight: oneLightStyle.default,
    }
  } catch (err) {
    // Markdown dependencies not installed - will fall back to plain text
    console.error('Failed to load markdown dependencies:', err)
    return null
  }
}

export function TextBlock({ content }: TextBlockProps) {
  const [showRaw, setShowRaw] = useState(false)
  const [markdownDeps, setMarkdownDeps] = useState<MarkdownDeps | null>(null)
  const [depsChecked, setDepsChecked] = useState(false)

  // Detect current theme for syntax highlighting
  const theme =
    typeof document !== 'undefined'
      ? document.documentElement.dataset.theme || 'guideai-dark'
      : 'guideai-dark'
  const isDark = theme.includes('dark')

  const isMarkdown = looksLikeMarkdown(content)

  // Load markdown dependencies if needed
  useEffect(() => {
    if (isMarkdown && !depsChecked) {
      loadMarkdownDeps().then(deps => {
        setMarkdownDeps(deps)
        setDepsChecked(true)
      })
    }
  }, [isMarkdown, depsChecked])

  // Fall back to plain text if markdown not available, not detected, or loading
  if (!isMarkdown || showRaw || !markdownDeps || !depsChecked) {
    return (
      <div className="relative group">
        <div className="whitespace-pre-wrap text-sm text-base-content">{content}</div>
        {isMarkdown && markdownDeps && !showRaw && (
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost"
            title="Toggle raw view"
          >
            <CodeBracketIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  const { ReactMarkdown, Prism, oneDark, oneLight } = markdownDeps

  // Select theme based on current mode
  const syntaxTheme = isDark ? oneDark : oneLight

  // Define custom components with proper types
  const components: Partial<Components> = {
    // Headings
    h1: props => <h1 className="text-lg font-bold text-base-content mt-4 mb-2" {...props} />,
    h2: props => <h2 className="text-base font-bold text-base-content mt-3 mb-2" {...props} />,
    h3: props => <h3 className="text-sm font-semibold text-base-content mt-2 mb-1" {...props} />,
    h4: props => <h4 className="text-sm font-medium text-base-content mt-2 mb-1" {...props} />,
    h5: props => <h5 className="text-xs font-medium text-base-content mt-1 mb-1" {...props} />,
    h6: props => <h6 className="text-xs font-medium text-base-content/80 mt-1 mb-1" {...props} />,

    // Paragraphs
    p: props => <p className="text-sm text-base-content leading-relaxed" {...props} />,

    // Lists
    ul: props => (
      <ul className="list-disc list-inside text-sm text-base-content mb-2 space-y-1" {...props} />
    ),
    ol: props => (
      <ol
        className="list-decimal list-inside text-sm text-base-content mb-2 space-y-1"
        {...props}
      />
    ),
    li: props => <li className="text-sm text-base-content" {...props} />,

    // Inline code
    code: props => {
      // The 'inline' property is added by react-markdown, not part of standard HTML attributes
      const inline = 'inline' in props ? (props as { inline?: boolean }).inline : false
      const { className, children, ...rest } = props
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : undefined

      if (!inline && Prism && language) {
        // Block code with syntax highlighting
        return (
          <div className="my-2">
            <Prism
              language={language}
              style={syntaxTheme as Record<string, React.CSSProperties>}
              customStyle={{
                margin: 0,
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                padding: '0.75rem',
              }}
            >
              {String(children).replace(/\n$/, '')}
            </Prism>
          </div>
        )
      }

      // Inline code
      return (
        <code
          className="bg-base-200 text-primary px-1.5 py-0.5 rounded text-xs font-mono"
          {...rest}
        >
          {children}
        </code>
      )
    },

    // Links
    a: props => {
      const { href, children, ...rest } = props
      return (
        <a
          href={href}
          className="text-primary hover:text-primary-focus underline"
          target="_blank"
          rel="noopener noreferrer"
          {...rest}
        >
          {children}
        </a>
      )
    },

    // Blockquotes
    blockquote: props => (
      <blockquote
        className="border-l-4 border-base-300 pl-3 py-1 my-2 text-base-content/80 italic"
        {...props}
      />
    ),

    // Horizontal rules
    hr: () => <hr className="border-base-300 my-3" />,

    // Strong/Bold
    strong: props => <strong className="font-semibold text-base-content" {...props} />,

    // Emphasis/Italic
    em: props => <em className="italic text-base-content" {...props} />,
  }

  // Render markdown with custom styling
  return (
    <div className="relative group">
      <style>{`
        /* Regular paragraphs need bottom margin */
        .markdown-content > p {
          margin-bottom: 0.5rem;
        }
        /* Paragraphs in list items should display inline to prevent line breaks */
        .markdown-content li > p {
          display: inline;
          margin: 0;
        }
        /* When a paragraph has a sibling (like a nested list), add margin */
        .markdown-content li > p:not(:only-child) {
          margin-bottom: 0.25rem;
        }
        /* Nested lists */
        .markdown-content li > ul,
        .markdown-content li > ol {
          display: block;
          margin-top: 0.25rem;
        }
      `}</style>
      <div className="prose prose-sm max-w-none text-base-content markdown-content">
        <ReactMarkdown components={components}>{content}</ReactMarkdown>
      </div>

      {/* Toggle button - only visible on hover */}
      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost"
        title="Show raw text"
      >
        <DocumentTextIcon className="w-3 h-3" />
      </button>
    </div>
  )
}
