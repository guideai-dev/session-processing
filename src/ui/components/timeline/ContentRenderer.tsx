/**
 * ContentRenderer - Routes content blocks to appropriate renderer components
 */

import type { ContentBlock } from '../../utils/timelineTypes.js'
import {
  CodeBlock,
  ImageBlock,
  JsonBlock,
  TextBlock,
  ThinkingBlock,
  ToolBlock,
  ToolResultBlock,
} from './blocks/index.js'

interface ContentRendererProps {
  blocks: ContentBlock[]
}

// Helper function to generate stable keys for content blocks
function getBlockKey(block: ContentBlock, index: number): string {
  // Generate a stable key based on block type and content
  let contentHash = ''

  switch (block.type) {
    case 'text':
    case 'code':
    case 'image':
      // These are guaranteed to be strings by the ContentBlock type
      contentHash = block.content.substring(0, 50)
      break
    case 'tool_result':
      // Should be string, but handle cases where it might not be
      contentHash =
        typeof block.content === 'string'
          ? block.content.substring(0, 50)
          : JSON.stringify(block.content).substring(0, 50)
      break
    case 'json':
      contentHash =
        typeof block.content === 'string'
          ? block.content.substring(0, 50)
          : JSON.stringify(block.content).substring(0, 50)
      break
    case 'tool_use':
      contentHash = block.content.name
      break
    case 'thinking':
      contentHash = block.content.length > 0 ? block.content[0].subject : ''
      break
  }

  return `${block.type}-${index}-${contentHash.replace(/\s/g, '')}`
}

export function ContentRenderer({ blocks }: ContentRendererProps) {
  if (blocks.length === 0) {
    return <div className="text-sm text-base-content/50">No content</div>
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const key = getBlockKey(block, index)

        // Type narrowing through switch - no type assertions needed!
        switch (block.type) {
          case 'text':
            // TypeScript knows block.content is string here
            return <TextBlock key={key} content={block.content} />

          case 'code':
            // TypeScript knows block.content is string and metadata has language
            return (
              <CodeBlock key={key} content={block.content} language={block.metadata?.language} />
            )

          case 'image':
            // TypeScript knows block.content is string and metadata has format
            return <ImageBlock key={key} content={block.content} format={block.metadata?.format} />

          case 'json':
            // TypeScript knows block.content is string | unknown
            return (
              <JsonBlock
                key={key}
                content={
                  typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
                }
                collapsed={block.metadata?.collapsed}
              />
            )

          case 'tool_use':
            // TypeScript knows block.content is { name: string; input: Record<string, unknown> }
            return (
              <ToolBlock key={key} content={block.content} collapsed={block.metadata?.collapsed} />
            )

          case 'tool_result':
            // TypeScript knows block.content can be string, array, or object
            return (
              <ToolResultBlock
                key={key}
                content={block.content}
                collapsed={block.metadata?.collapsed}
                toolName={block.metadata?.toolName}
              />
            )

          case 'thinking':
            // TypeScript knows block.content is Array<{ subject, description, timestamp }>
            return (
              <ThinkingBlock
                key={key}
                content={block.content}
                collapsed={block.metadata?.collapsed}
              />
            )

          default: {
            // Exhaustiveness check - TypeScript will error if we miss a case
            const _exhaustive: never = block
            return (
              <div key={key} className="text-sm text-base-content/50">
                Unknown content type
              </div>
            )
          }
        }
      })}
    </div>
  )
}
