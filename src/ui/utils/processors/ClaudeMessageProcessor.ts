/**
 * Claude Message Processor - Claude Code-specific message processing
 *
 * Handles Claude-specific conventions like ExitPlanMode, TodoWrite,
 * thinking blocks, image content, file-history snapshots, and other
 * special Claude Code features.
 */

import { BaseMessageProcessor } from './BaseMessageProcessor.js'
import { BaseSessionMessage } from '../sessionTypes.js'
import { createDisplayMetadata, ContentBlock, createContentBlock } from '../timelineTypes.js'
import {
  MapIcon,
  ListBulletIcon,
  LightBulbIcon,
  DocumentTextIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline'

export class ClaudeMessageProcessor extends BaseMessageProcessor {
  name = 'claude-code'

  /**
   * Override to handle Claude-specific message types
   */
  protected normalizeMessage(message: BaseSessionMessage) {
    // Handle file-history-snapshot messages
    if ((message as any).type === 'file-history-snapshot' || message.content?.type === 'file-history-snapshot') {
      return {
        ...super.normalizeMessage(message),
        type: 'meta' as const,
      }
    }

    // Handle summary messages
    if ((message as any).type === 'summary' || message.content?.type === 'summary') {
      return {
        ...super.normalizeMessage(message),
        type: 'meta' as const,
      }
    }

    return super.normalizeMessage(message)
  }

  /**
   * Override display metadata to handle Claude-specific messages
   */
  protected getDisplayMetadata(message: BaseSessionMessage) {
    // Handle special Claude tools with custom icons/titles
    if (message.type === 'tool_use') {
      const toolName = this.getToolName(message)

      if (toolName === 'ExitPlanMode') {
        return createDisplayMetadata({
          icon: 'PLN',
          IconComponent: MapIcon,
          iconColor: 'text-accent',
          title: 'Exit Plan Mode',
          borderColor: 'border-l-accent',
          badge: {
            text: 'PLANNING',
            color: 'badge-accent',
          },
        })
      }

      if (toolName === 'TodoWrite') {
        return createDisplayMetadata({
          icon: 'TODO',
          IconComponent: ListBulletIcon,
          iconColor: 'text-accent',
          title: 'Todo Tracking',
          borderColor: 'border-l-accent',
          badge: {
            text: 'TRACKING',
            color: 'badge-accent',
          },
        })
      }

      // Other tool uses get standard treatment from base class
      return super.getDisplayMetadata(message)
    }

    // Handle file-history-snapshot
    if ((message as any).type === 'file-history-snapshot' || message.content?.type === 'file-history-snapshot') {
      return createDisplayMetadata({
        icon: 'FILE',
        IconComponent: DocumentIcon,
        iconColor: 'text-base-content/60',
        title: 'File History',
        borderColor: 'border-l-neutral',
        badge: {
          text: 'SNAPSHOT',
          color: 'badge-neutral',
        },
      })
    }

    // Handle summary
    if ((message as any).type === 'summary' || message.content?.type === 'summary') {
      return createDisplayMetadata({
        icon: 'SUM',
        IconComponent: DocumentTextIcon,
        iconColor: 'text-accent',
        title: 'Session Summary',
        borderColor: 'border-l-accent',
        badge: {
          text: 'SUMMARY',
          color: 'badge-accent',
        },
      })
    }

    // Handle thinking in assistant responses
    if (message.type === 'assistant_response' && this.hasThinkingContent(message)) {
      return createDisplayMetadata({
        icon: 'THK',
        IconComponent: LightBulbIcon,
        iconColor: 'text-secondary',
        title: 'Assistant (with reasoning)',
        borderColor: 'border-l-primary',
        badge: {
          text: 'THINKING',
          color: 'badge-secondary',
        },
      })
    }

    // Delegate to base class for non-tool messages
    return super.getDisplayMetadata(message)
  }

  /**
   * Override content block extraction for Claude-specific content types
   */
  protected getContentBlocks(message: BaseSessionMessage): ContentBlock[] {
    // Handle file-history-snapshot
    if ((message as any).type === 'file-history-snapshot' || message.content?.type === 'file-history-snapshot') {
      return this.getFileHistoryBlocks(message)
    }

    // Handle summary
    if ((message as any).type === 'summary' || message.content?.type === 'summary') {
      return this.getSummaryBlocks(message)
    }

    // Handle conversation blocks with thinking, images, etc.
    if (message.type === 'user_input' || message.type === 'assistant_response') {
      return this.getClaudeConversationBlocks(message)
    }

    // Default to base implementation
    return super.getContentBlocks(message)
  }

  /**
   * Extract conversation blocks with Claude-specific content types
   */
  protected getClaudeConversationBlocks(message: BaseSessionMessage): ContentBlock[] {
    const blocks: ContentBlock[] = []

    // Try to get content array from message
    const contentArray = this.extractClaudeContentArray(message)

    if (contentArray && Array.isArray(contentArray)) {
      for (const item of contentArray) {
        // Text content
        if (item.type === 'text' && item.text) {
          blocks.push(createContentBlock('text', item.text))
        }

        // Thinking content (encrypted or plain)
        else if (item.type === 'thinking') {
          if (item.thinking) {
            // Plain thinking text
            blocks.push(
              createContentBlock('text', `_Reasoning: ${item.thinking}_`)
            )
          } else if (item.signature) {
            // Encrypted thinking - just show indicator
            blocks.push(
              createContentBlock('text', '_[Encrypted reasoning - not displayed]_')
            )
          }
        }

        // Image content
        else if (item.type === 'image' && item.source) {
          const imageData = this.extractImageFromPart(item)
          if (imageData) {
            blocks.push(
              createContentBlock('image', imageData.data, {
                format: imageData.type,
              })
            )
          }
        }

        // Tool use
        else if (item.type === 'tool_use') {
          blocks.push(
            createContentBlock(
              'tool_use',
              { name: item.name, input: item.input },
              {
                toolName: item.name,
                collapsed: true,
              }
            )
          )
        }

        // Tool result
        else if (item.type === 'tool_result') {
          blocks.push(
            createContentBlock('tool_result', item.content, {
              toolUseId: item.tool_use_id,
              collapsed: true,
            })
          )
        }

        // Unknown type - show as JSON
        else {
          blocks.push(createContentBlock('json', item, { collapsed: true }))
        }
      }
    }

    // Fallback to base implementation if no blocks extracted
    return blocks.length > 0 ? blocks : super.getConversationBlocks(message)
  }

  /**
   * Extract Claude content array from various message structures
   */
  private extractClaudeContentArray(message: BaseSessionMessage): any[] | null {
    // Direct content array
    if (Array.isArray(message.content)) {
      return message.content
    }

    // Nested in message.content
    if (message.content?.content && Array.isArray(message.content.content)) {
      return message.content.content
    }

    // Nested in message.message.content
    if (message.content?.message?.content && Array.isArray(message.content.message.content)) {
      return message.content.message.content
    }

    return null
  }

  /**
   * Check if message has thinking content
   */
  private hasThinkingContent(message: BaseSessionMessage): boolean {
    const contentArray = this.extractClaudeContentArray(message)
    if (!contentArray) return false

    return contentArray.some((item) => item.type === 'thinking')
  }

  /**
   * Extract file history snapshot blocks
   */
  private getFileHistoryBlocks(message: BaseSessionMessage): ContentBlock[] {
    const blocks: ContentBlock[] = []

    // Try to extract file history data
    const fileHistory = message.content?.fileHistory || message.content

    if (Array.isArray(fileHistory)) {
      for (const file of fileHistory.slice(0, 10)) {
        // Limit to first 10 files
        const fileName = file.path || file.name || 'unknown'
        const action = file.action || file.type || 'modified'
        blocks.push(createContentBlock('text', `${action}: ${fileName}`))
      }

      if (fileHistory.length > 10) {
        blocks.push(
          createContentBlock('text', `... and ${fileHistory.length - 10} more files`)
        )
      }
    } else {
      // Show as JSON if structure is unexpected
      blocks.push(createContentBlock('json', fileHistory, { collapsed: true }))
    }

    return blocks
  }

  /**
   * Extract summary blocks
   */
  private getSummaryBlocks(message: BaseSessionMessage): ContentBlock[] {
    const summary = message.content?.summary || message.content?.text || message.content

    if (typeof summary === 'string') {
      return [createContentBlock('text', summary)]
    }

    if (summary?.text) {
      return [createContentBlock('text', summary.text)]
    }

    return [createContentBlock('json', summary, { collapsed: true })]
  }

  /**
   * Override tool name extraction to handle Claude's message structure
   */
  protected getToolName(message: BaseSessionMessage): string | null {
    // Try Claude-specific locations
    if (message.content?.name) {
      return message.content.name
    }

    // Check content array for tool_use
    const contentArray = this.extractClaudeContentArray(message)
    if (contentArray) {
      const toolUse = contentArray.find((item) => item.type === 'tool_use')
      if (toolUse?.name) {
        return toolUse.name
      }
    }

    return super.getToolName(message)
  }

  /**
   * Override tool use ID extraction for Claude
   */
  protected extractToolUseId(message: BaseSessionMessage): string | null {
    // Check content array for tool_use
    const contentArray = this.extractClaudeContentArray(message)
    if (contentArray) {
      const toolUse = contentArray.find((item) => item.type === 'tool_use')
      if (toolUse?.id) {
        return toolUse.id
      }
    }

    return super.extractToolUseId(message)
  }

  /**
   * Override tool result ID extraction for Claude
   */
  protected extractToolResultId(message: BaseSessionMessage): string | null {
    // Check content array for tool_result
    const contentArray = this.extractClaudeContentArray(message)
    if (contentArray) {
      const toolResult = contentArray.find((item) => item.type === 'tool_result')
      if (toolResult?.tool_use_id) {
        return toolResult.tool_use_id
      }
    }

    return super.extractToolResultId(message)
  }
}
