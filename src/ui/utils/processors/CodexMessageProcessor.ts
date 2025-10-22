/**
 * Codex Message Processor - Codex-specific message processing
 *
 * Handles Codex message format with payload wrappers, event_msg, response_item,
 * session_meta, and turn_context types.
 */

import {
  Cog6ToothIcon,
  CpuChipIcon,
  HashtagIcon,
  InformationCircleIcon,
  LightBulbIcon,
  StopCircleIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import type { BaseSessionMessage } from '../sessionTypes.js'
import { type ContentBlock, createContentBlock, createDisplayMetadata } from '../timelineTypes.js'
import { BaseMessageProcessor, type MessageContent } from './BaseMessageProcessor.js'

// Type for Codex payload structure (stored as content, cast to string for ParsedMessage type)
interface CodexPayload {
  type?: string
  info?: {
    total_token_usage?: {
      input_tokens?: number
      output_tokens?: number
    }
  }
  rate_limits?: unknown
  text?: string
  message?: string
  reason?: string
  summary?: Array<{ type?: string; text?: string }>
  encrypted_content?: unknown
  name?: string
  arguments?: string | Record<string, unknown>
  call_id?: string
  output?: string
  content?: Array<{ type?: string; text?: string; content?: string }> | string
  originator?: string
  model?: string
  [key: string]: unknown
}

interface CodexMessage {
  payload?: CodexPayload
  [key: string]: unknown
}

export class CodexMessageProcessor extends BaseMessageProcessor {
  name = 'codex'

  /**
   * Type guard to check if content is a Codex message structure
   */
  private isCodexMessage(content: unknown): content is CodexMessage {
    return typeof content === 'object' && content !== null
  }

  /**
   * Extract payload from content (handles type casting from ParsedMessage)
   */
  private getPayload(content: unknown): CodexPayload {
    if (!this.isCodexMessage(content)) {
      return {}
    }
    return content.payload || (content as CodexPayload)
  }

  /**
   * Override to handle Codex-specific message structure
   */
  protected normalizeMessage(message: BaseSessionMessage) {
    // Content is stored as object (cast to string in ParsedMessage for type compat)
    const payload = this.getPayload(message.content)
    const payloadType = payload.type || message.type

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
  private mapCodexType(payloadType: string, payload: MessageContent): BaseSessionMessage['type'] {
    // Handle event_msg types
    if (payloadType === 'token_count') return 'meta'
    if (payloadType === 'agent_reasoning') return 'assistant_response' // event_msg reasoning
    if (payloadType === 'agent_message') return 'assistant_response' // event_msg message
    if (payloadType === 'user_message') return 'user_input'
    if (payloadType === 'turn_aborted') return 'interruption'

    // Handle response_item types
    if (payloadType === 'reasoning') return 'assistant_response'
    if (payloadType === 'function_call') return 'tool_use'
    if (payloadType === 'function_call_output') return 'tool_result'
    if (
      payloadType === 'message' &&
      typeof payload === 'object' &&
      payload !== null &&
      'role' in payload &&
      (payload as Record<string, unknown>).role === 'user'
    )
      return 'user_input'
    if (
      payloadType === 'message' &&
      typeof payload === 'object' &&
      payload !== null &&
      'role' in payload &&
      (payload as Record<string, unknown>).role === 'assistant'
    )
      return 'assistant_response'

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
    const payload = this.getPayload(message.content)
    const payloadType = payload.type

    // Token count
    if (payloadType === 'token_count') {
      const tokens = payload.info?.total_token_usage
      const badge = tokens ? `${tokens.input_tokens}↓ ${tokens.output_tokens}↑` : 'TOKENS'

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

    // Agent reasoning (event_msg format - simpler than reasoning response_item)
    if (payloadType === 'agent_reasoning') {
      return createDisplayMetadata({
        icon: 'THK',
        IconComponent: LightBulbIcon,
        iconColor: 'text-secondary',
        title: 'Reasoning',
        borderColor: 'border-l-secondary',
      })
    }

    // Agent message (event_msg format - simpler than message response_item)
    if (payloadType === 'agent_message') {
      return createDisplayMetadata({
        icon: 'AST',
        IconComponent: CpuChipIcon,
        iconColor: 'text-success',
        title: 'Assistant',
        borderColor: 'border-l-success',
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
      const hasSummary = payload.summary !== undefined && payload.summary.length > 0
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
      const _toolName = payload?.name || 'Unknown Tool'
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
    const payload = this.getPayload(message.content)
    const payloadType = payload.type

    // Token count
    if (payloadType === 'token_count') {
      const content: Record<string, unknown> = {}
      if (payload.info) content.token_usage = payload.info
      if (payload.rate_limits) content.rate_limits = payload.rate_limits

      return [createContentBlock('json', content, { collapsed: true })]
    }

    // Agent reasoning (event_msg format)
    if (payloadType === 'agent_reasoning') {
      const text = payload.text || ''
      return [createContentBlock('text', text)]
    }

    // Agent message (event_msg format)
    if (payloadType === 'agent_message') {
      const text = payload.message || payload.text || ''
      return [createContentBlock('text', text)]
    }

    // User message
    if (payloadType === 'user_message') {
      const text = payload.message || ''
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
        blocks.push(createContentBlock('text', '_[Encrypted reasoning content not displayed]_'))
      }

      return blocks.length > 0 ? blocks : [createContentBlock('json', payload, { collapsed: true })]
    }

    // Function call (tool use)
    if (payloadType === 'function_call') {
      const toolName = payload.name || 'unknown'
      let input: Record<string, unknown> = {}

      // Try to parse JSON arguments
      if (typeof payload.arguments === 'string') {
        try {
          input = JSON.parse(payload.arguments) as Record<string, unknown>
        } catch {
          // Keep empty object if parse fails
        }
      } else if (typeof payload.arguments === 'object' && payload.arguments !== null) {
        input = payload.arguments as Record<string, unknown>
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
    if (payloadType === 'message' && payload.content) {
      const blocks: ContentBlock[] = []

      if (Array.isArray(payload.content)) {
        for (const item of payload.content) {
          if (item.type === 'input_text' || item.type === 'text' || item.type === 'output_text') {
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
    const payload = this.getPayload(message.content)
    return payload.call_id || super.extractToolUseId(message)
  }

  /**
   * Override tool result ID extraction for Codex
   */
  protected extractToolResultId(message: BaseSessionMessage): string | null {
    const payload = this.getPayload(message.content)
    return payload.call_id || super.extractToolResultId(message)
  }

  /**
   * Override tool name extraction for Codex
   */
  protected getToolName(message: BaseSessionMessage): string | null {
    const payload = this.getPayload(message.content)
    return payload.name || super.getToolName(message)
  }
}
