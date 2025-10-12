/**
 * ContentRenderer - Routes content blocks to appropriate renderer components
 */

import { ContentBlock } from '../../utils/timelineTypes.js'
import {
  TextBlock,
  CodeBlock,
  ImageBlock,
  JsonBlock,
  ToolBlock,
  ToolResultBlock,
  ThinkingBlock,
} from './blocks/index.js'

interface ContentRendererProps {
  blocks: ContentBlock[]
}

export function ContentRenderer({ blocks }: ContentRendererProps) {
  if (blocks.length === 0) {
    return <div className="text-sm text-base-content/50">No content</div>
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'text':
            return <TextBlock key={index} content={block.content} />

          case 'code':
            return (
              <CodeBlock
                key={index}
                content={block.content}
                language={block.metadata?.language}
              />
            )

          case 'image':
            return (
              <ImageBlock
                key={index}
                content={block.content}
                format={block.metadata?.format}
              />
            )

          case 'json':
            return (
              <JsonBlock
                key={index}
                content={block.content}
                collapsed={block.metadata?.collapsed}
              />
            )

          case 'tool_use':
            return (
              <ToolBlock
                key={index}
                content={block.content}
                collapsed={block.metadata?.collapsed}
              />
            )

          case 'tool_result':
            return (
              <ToolResultBlock
                key={index}
                content={block.content}
                collapsed={block.metadata?.collapsed}
              />
            )

          case 'thinking':
            return (
              <ThinkingBlock
                key={index}
                content={block.content}
                collapsed={block.metadata?.collapsed}
              />
            )

          default:
            return (
              <div key={index} className="text-sm text-base-content/50">
                Unknown content type: {(block as any).type}
              </div>
            )
        }
      })}
    </div>
  )
}
