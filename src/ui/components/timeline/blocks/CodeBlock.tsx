/**
 * CodeBlock - Renders code/command content
 */

interface CodeBlockProps {
  content: string
  language?: string
}

export function CodeBlock({ content, language = 'text' }: CodeBlockProps) {
  const isCommand = language === 'bash' || language === 'sh'
  const isOutput = language === 'text' || language === 'output'

  if (isCommand) {
    return (
      <div className="bg-base-200 p-3 rounded-md">
        <code className="font-mono text-sm text-primary">{content}</code>
      </div>
    )
  }

  if (isOutput) {
    return (
      <div className="bg-base-200 p-3 rounded-md">
        <pre className="font-mono text-xs whitespace-pre-wrap overflow-auto max-h-64">
          <code className="text-base-content/80">{content}</code>
        </pre>
      </div>
    )
  }

  // Generic code block
  return (
    <div className="bg-base-200 p-3 rounded-md">
      <pre className="font-mono text-sm overflow-auto max-h-64">
        <code>{content}</code>
      </pre>
    </div>
  )
}
