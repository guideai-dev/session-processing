/**
 * Generic Message Processor - Default processor for unknown providers
 *
 * Uses the base processor logic with enhanced heuristics for detecting
 * common message patterns from unknown providers. Provides intelligent
 * fallback rendering for any session format.
 */

import { BaseMessageProcessor } from './BaseMessageProcessor.js'
import { BaseSessionMessage } from '../sessionTypes.js'
import { createDisplayMetadata, ContentBlock, createContentBlock } from '../timelineTypes.js'

export class GenericMessageProcessor extends BaseMessageProcessor {
  name = 'generic'

  /**
   * Override to provide smarter type detection for unknown formats
   */
  protected getMessageRole(message: BaseSessionMessage): any {
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
  private looksLikeText(content: any): boolean {
    if (typeof content === 'string') return true
    if (content?.text && typeof content.text === 'string') return true
    if (content?.message && typeof content.message === 'string') return true
    if (content?.content && typeof content.content === 'string') return true
    return false
  }

  /**
   * Extract text from content
   */
  private extractText(content: any): string | null {
    if (typeof content === 'string') return content
    if (content?.text && typeof content.text === 'string') return content.text
    if (content?.message && typeof content.message === 'string') return content.message
    if (content?.content && typeof content.content === 'string') return content.content
    return null
  }

  /**
   * Check if content looks like a tool use
   */
  private looksLikeToolUse(content: any): boolean {
    if (!content || typeof content !== 'object') return false

    // Has tool/function/name AND input/arguments/params
    const hasName = content.tool || content.function || content.name
    const hasInput = content.input || content.arguments || content.params

    return Boolean(hasName && hasInput)
  }

  /**
   * Check if content looks like a tool result
   */
  private looksLikeToolResult(content: any): boolean {
    if (!content || typeof content !== 'object') return false

    // Has output/result/response fields
    return Boolean(content.output || content.result || content.response)
  }
}
