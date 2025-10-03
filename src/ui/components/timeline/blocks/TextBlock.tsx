/**
 * TextBlock - Renders plain text content
 */

interface TextBlockProps {
  content: string
}

export function TextBlock({ content }: TextBlockProps) {
  return <div className="whitespace-pre-wrap text-sm">{content}</div>
}
