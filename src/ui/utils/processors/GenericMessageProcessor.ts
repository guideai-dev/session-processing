/**
 * Generic Message Processor - Default processor for unknown providers
 *
 * Uses the base processor logic with enhanced heuristics for detecting
 * common message patterns from unknown providers. Provides intelligent
 * fallback rendering for any session format.
 */

import type { BaseSessionMessage } from '../sessionTypes.js'
import {
  type ContentBlock,
  type MessageRole,
  createContentBlock,
  createDisplayMetadata,
} from '../timelineTypes.js'
import { BaseMessageProcessor, type MessageContent } from './BaseMessageProcessor.js'

export class GenericMessageProcessor extends BaseMessageProcessor {
  name = 'generic'

  /**
   * Override to provide smarter type detection for unknown formats
   */
  protected getMessageRole(message: BaseSessionMessage): MessageRole {
    // Try to detect role from content hints
    const content = message.content

    // Check for common role indicators
    if (content?.role === 'user' || content?.type === 'user') {
      return 'user'
    }
    if (content?.role === 'assistant' || content?.type === 'assistant') {
      return 'assistant'
    }
    if (content?.role === 'system' || content?.type === 'system') {
      return 'system'
    }

    // Check for tool-like patterns
    if (content?.tool || content?.function || content?.name) {
      return 'tool'
    }

    // Default to base implementation
    return super.getMessageRole(message)
  }

  /**
   * Override to provide better metadata for unknown formats
   */
  protected getDisplayMetadata(message: BaseSessionMessage) {
    // Try to detect special message types
    const content = message.content
    const type = content?.type || message.type

    // Tool-like messages
    if (content?.tool || content?.function || content?.name) {
      const name = content.tool || content.function || content.name
      return createDisplayMetadata({
        icon: 'TOOL',
        title: String(name),
        borderColor: 'border-l-secondary',
        badge: {
          text: 'UNKNOWN',
          color: 'badge-warning',
        },
      })
    }

    // Messages with explicit types
    if (typeof type === 'string' && type !== 'meta') {
      return createDisplayMetadata({
        icon: 'MSG',
        title: this.humanizeType(type),
        borderColor: 'border-l-neutral',
        badge: {
          text: type.toUpperCase(),
          color: 'badge-neutral',
        },
      })
    }

    // Default to base implementation
    return super.getDisplayMetadata(message)
  }

  /**
   * Override to provide smarter content extraction
   */
  protected getContentBlocks(message: BaseSessionMessage): ContentBlock[] {
    const content = message.content
    const blocks: ContentBlock[] = []

    // Try to detect and extract structured content
    if (this.looksLikeText(content)) {
      const text = this.extractText(content)
      if (text) {
        blocks.push(createContentBlock('text', text))
      }
    } else if (this.looksLikeToolUse(content)) {
      blocks.push(
        createContentBlock(
          'tool_use',
          {
            name: content.tool || content.function || content.name || 'unknown',
            input: content.input || content.arguments || content.params,
          },
          { collapsed: true }
        )
      )
    } else if (this.looksLikeToolResult(content)) {
      blocks.push(
        createContentBlock('tool_result', content.output || content.result || content.response, {
          collapsed: true,
        })
      )
    }

    // If we found something, return it
    if (blocks.length > 0) {
      return blocks
    }

    // Fallback to base implementation
    return super.getContentBlocks(message)
  }

  /**
   * Humanize type string for display
   */
  private humanizeType(type: string): string {
    return type
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  /**
   * Check if content looks like text
   */
  private looksLikeText(content: MessageContent): boolean {
    if (typeof content === 'string') return true
    if (typeof content === 'object' && content !== null) {
      if ('text' in content && typeof content.text === 'string') return true
      if ('message' in content && typeof content.message === 'string') return true
      if ('content' in content && typeof content.content === 'string') return true
    }
    return false
  }

  /**
   * Extract text from content
   */
  private extractText(content: MessageContent): string | null {
    if (typeof content === 'string') return content
    if (typeof content === 'object' && content !== null) {
      if ('text' in content && typeof content.text === 'string') return content.text
      if ('message' in content && typeof content.message === 'string') return content.message
      if ('content' in content && typeof content.content === 'string') return content.content
    }
    return null
  }

  /**
   * Check if content looks like a tool use
   */
  private looksLikeToolUse(content: MessageContent): boolean {
    if (!content || typeof content !== 'object') return false

    // Has tool/function/name AND input/arguments/params
    const hasName =
      ('tool' in content && content.tool) ||
      ('function' in content && content.function) ||
      ('name' in content && content.name)
    const hasInput =
      ('input' in content && content.input) ||
      ('arguments' in content && content.arguments) ||
      ('params' in content && content.params)

    return Boolean(hasName && hasInput)
  }

  /**
   * Check if content looks like a tool result
   */
  private looksLikeToolResult(content: MessageContent): boolean {
    if (!content || typeof content !== 'object') return false

    // Has output/result/response fields
    return Boolean(
      ('output' in content && content.output) ||
        ('result' in content && content.result) ||
        ('response' in content && content.response)
    )
  }
}
