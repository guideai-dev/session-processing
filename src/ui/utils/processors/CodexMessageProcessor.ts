/**
 * Codex Message Processor - Codex-specific message processing
 *
 * Handles Codex message format with payload wrappers, event_msg, response_item,
 * session_meta, and turn_context types.
 */

import { BaseMessageProcessor } from './BaseMessageProcessor.js'
import { BaseSessionMessage } from '../sessionTypes.js'
import { createDisplayMetadata, ContentBlock, createContentBlock } from '../timelineTypes.js'
import {
  HashtagIcon,
  LightBulbIcon,
  UserIcon,
  CpuChipIcon,
  StopCircleIcon,
  InformationCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'

export class CodexMessageProcessor extends BaseMessageProcessor {
  name = 'codex'

  /**
   * Override to handle Codex-specific message structure
   */
  protected normalizeMessage(message: BaseSessionMessage) {
    // Codex wraps everything in payload
    const payload = message.content?.payload || message.content

    // Determine the actual message type from payload
    const payloadType = payload?.type || message.type

    // Create a normalized message structure
    const normalizedMessage = {
      ...message,
      type: this.mapCodexType(payloadType, payload),
      content: payload,
    }

    return super.normalizeMessage(normalizedMessage)
  }

  /**
   * Map Codex payload types to standard message types
   */
  private mapCodexType(payloadType: string, payload: any): BaseSessionMessage['type'] {
    // Handle event_msg types
    if (payloadType === 'token_count') return 'meta'
    if (payloadType === 'agent_reasoning') return 'assistant_response'
    if (payloadType === 'user_message') return 'user_input'
    if (payloadType === 'agent_message') return 'assistant_response'
    if (payloadType === 'turn_aborted') return 'interruption'

    // Handle response_item types
    if (payloadType === 'reasoning') return 'assistant_response'
    if (payloadType === 'function_call') return 'tool_use'
    if (payloadType === 'function_call_output') return 'tool_result'
    if (payloadType === 'message' && payload?.role === 'user') return 'user_input'
    if (payloadType === 'message' && payload?.role === 'assistant') return 'assistant_response'

    // Meta types
    if (payloadType === 'session_meta') return 'meta'
    if (payloadType === 'turn_context') return 'meta'

    // Default
    return 'meta'
  }

  /**
   * Override display metadata for Codex-specific types
   */
  protected getDisplayMetadata(message: BaseSessionMessage) {
    const payload = message.content?.payload || message.content
    const payloadType = payload?.type

    // Token count
    if (payloadType === 'token_count') {
      const tokens = payload?.info?.total_token_usage
      const badge = tokens
        ? `${tokens.input_tokens}↓ ${tokens.output_tokens}↑`
        : 'TOKENS'

      return createDisplayMetadata({
        icon: 'TOK',
        IconComponent: HashtagIcon,
        iconColor: 'text-accent',
        title: 'Token Usage',
        borderColor: 'border-l-accent',
        badge: {
          text: badge,
          color: 'badge-info',
        },
      })
    }

    // Agent reasoning
    if (payloadType === 'agent_reasoning') {
      return createDisplayMetadata({
        icon: 'THK',
        IconComponent: LightBulbIcon,
        iconColor: 'text-secondary',
        title: 'Agent Reasoning',
        borderColor: 'border-l-secondary',
        badge: {
          text: 'THINKING',
          color: 'badge-secondary',
        },
      })
    }

    // User message
    if (payloadType === 'user_message') {
      return createDisplayMetadata({
        icon: 'USR',
        IconComponent: UserIcon,
        iconColor: 'text-info',
        title: 'User',
        borderColor: 'border-l-info',
      })
    }

    // Agent message
    if (payloadType === 'agent_message') {
      return createDisplayMetadata({
        icon: 'AST',
        IconComponent: CpuChipIcon,
        iconColor: 'text-primary',
        title: 'Assistant',
        borderColor: 'border-l-primary',
      })
    }

    // Turn aborted
    if (payloadType === 'turn_aborted') {
      return createDisplayMetadata({
        icon: 'INT',
        IconComponent: StopCircleIcon,
        iconColor: 'text-error',
        title: 'Interrupted',
        borderColor: 'border-l-error',
        badge: {
          text: payload?.reason?.toUpperCase() || 'ABORTED',
          color: 'badge-error',
        },
      })
    }

    // Reasoning (encrypted)
    if (payloadType === 'reasoning') {
      const hasSummary = payload?.summary?.length > 0
      return createDisplayMetadata({
        icon: 'THK',
        IconComponent: LightBulbIcon,
        iconColor: 'text-secondary',
        title: 'Reasoning',
        borderColor: 'border-l-secondary',
        badge: hasSummary
          ? {
              text: 'SUMMARY',
              color: 'badge-secondary',
            }
          : undefined,
      })
    }

    // Function call (tool use)
    if (payloadType === 'function_call') {
      const toolName = payload?.name || 'Unknown Tool'
      // Use base class getDisplayMetadata for consistent tool icon
      return super.getDisplayMetadata({ ...message, type: 'tool_use' } as BaseSessionMessage)
    }

    // Function call output (tool result)
    if (payloadType === 'function_call_output') {
      // Use base class getDisplayMetadata for consistent result icon
      return super.getDisplayMetadata({ ...message, type: 'tool_result' } as BaseSessionMessage)
    }

    // Session meta
    if (payloadType === 'session_meta') {
      return createDisplayMetadata({
        icon: 'META',
        IconComponent: InformationCircleIcon,
        iconColor: 'text-accent',
        title: 'Session Info',
        borderColor: 'border-l-accent',
        badge: {
          text: payload?.originator || 'CODEX',
          color: 'badge-accent',
        },
      })
    }

    // Turn context
    if (payloadType === 'turn_context') {
      return createDisplayMetadata({
        icon: 'CTX',
        IconComponent: Cog6ToothIcon,
        iconColor: 'text-base-content/60',
        title: 'Turn Context',
        borderColor: 'border-l-neutral',
        badge: {
          text: payload?.model || 'CONTEXT',
          color: 'badge-neutral',
        },
      })
    }

    // Default to base implementation
    return super.getDisplayMetadata(message)
  }

  /**
   * Extract content blocks from Codex payload
   */
  protected getContentBlocks(message: BaseSessionMessage): ContentBlock[] {
    const payload = message.content?.payload || message.content
    const payloadType = payload?.type

    // Token count
    if (payloadType === 'token_count') {
      const info = payload?.info
      const rateLimits = payload?.rate_limits

      const content: any = {}
      if (info) content.token_usage = info
      if (rateLimits) content.rate_limits = rateLimits

      return [createContentBlock('json', content, { collapsed: true })]
    }

    // Agent reasoning
    if (payloadType === 'agent_reasoning') {
      const text = payload?.text || ''
      return [createContentBlock('text', text)]
    }

    // User message
    if (payloadType === 'user_message') {
      const text = payload?.message || ''
      return [createContentBlock('text', text)]
    }

    // Agent message
    if (payloadType === 'agent_message') {
      const text = payload?.message || ''
      return [createContentBlock('text', text)]
    }

    // Turn aborted
    if (payloadType === 'turn_aborted') {
      const text = `Turn aborted: ${payload?.reason || 'unknown reason'}`
      return [createContentBlock('text', text)]
    }

    // Reasoning (encrypted)
    if (payloadType === 'reasoning') {
      const blocks: ContentBlock[] = []

      // Show summary if available
      if (payload?.summary && Array.isArray(payload.summary)) {
        for (const item of payload.summary) {
          if (item.type === 'summary_text' && item.text) {
            blocks.push(createContentBlock('text', item.text))
          }
        }
      }

      // Note about encrypted content
      if (payload?.encrypted_content && blocks.length === 0) {
        blocks.push(
          createContentBlock('text', '_[Encrypted reasoning content not displayed]_')
        )
      }

      return blocks.length > 0 ? blocks : [createContentBlock('json', payload, { collapsed: true })]
    }

    // Function call (tool use)
    if (payloadType === 'function_call') {
      const toolName = payload?.name || 'unknown'
      let input = payload?.arguments

      // Try to parse JSON arguments
      if (typeof input === 'string') {
        try {
          input = JSON.parse(input)
        } catch {
          // Keep as string
        }
      }

      return [
        createContentBlock(
          'tool_use',
          { name: toolName, input },
          {
            toolName,
            collapsed: true,
          }
        ),
      ]
    }

    // Function call output (tool result)
    if (payloadType === 'function_call_output') {
      const output = payload?.output || ''
      return [
        createContentBlock('tool_result', output, {
          toolUseId: payload?.call_id,
          collapsed: true,
        }),
      ]
    }

    // Session meta
    if (payloadType === 'session_meta') {
      return [createContentBlock('json', payload, { collapsed: true })]
    }

    // Turn context
    if (payloadType === 'turn_context') {
      return [createContentBlock('json', payload, { collapsed: true })]
    }

    // Message type (user/assistant with content array)
    if (payloadType === 'message' && payload?.content) {
      const blocks: ContentBlock[] = []

      if (Array.isArray(payload.content)) {
        for (const item of payload.content) {
          if (item.type === 'input_text' || item.type === 'text') {
            blocks.push(createContentBlock('text', item.text || item.content || ''))
          } else {
            blocks.push(createContentBlock('json', item, { collapsed: true }))
          }
        }
      } else if (typeof payload.content === 'string') {
        blocks.push(createContentBlock('text', payload.content))
      }

      return blocks.length > 0 ? blocks : [createContentBlock('json', payload, { collapsed: true })]
    }

    // Default: show as JSON
    return [createContentBlock('json', payload || message.content, { collapsed: true })]
  }

  /**
   * Override tool use ID extraction for Codex
   */
  protected extractToolUseId(message: BaseSessionMessage): string | null {
    const payload = message.content?.payload || message.content
    return payload?.call_id || super.extractToolUseId(message)
  }

  /**
   * Override tool result ID extraction for Codex
   */
  protected extractToolResultId(message: BaseSessionMessage): string | null {
    const payload = message.content?.payload || message.content
    return payload?.call_id || super.extractToolResultId(message)
  }

  /**
   * Override tool name extraction for Codex
   */
  protected getToolName(message: BaseSessionMessage): string | null {
    const payload = message.content?.payload || message.content
    return payload?.name || super.getToolName(message)
  }
}
