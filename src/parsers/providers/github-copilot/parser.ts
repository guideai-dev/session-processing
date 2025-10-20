/**
 * GitHub Copilot Parser
 *
 * Handles Copilot-specific message formats including tool calls and timeline entries.
 */

import type {
  StructuredMessageContent,
  ToolResultContent,
  ToolUseContent,
} from '@guideai-dev/types'
import { BaseParser } from '../../base/BaseParser.js'
import type { ParsedMessage, RawLogMessage } from '../../base/index.js'
import type { CopilotRawMessage } from './types.js'

export class CopilotParser extends BaseParser {
  readonly name = 'github-copilot'
  readonly providerName = 'github-copilot'

  canParse(jsonlContent: string): boolean {
    try {
      const lines = jsonlContent.split('\n').filter(line => line.trim())
      if (lines.length === 0) return false

      for (const line of lines.slice(0, 5)) {
        try {
          const parsed = JSON.parse(line) as Partial<CopilotRawMessage>

          // Copilot messages have specific type values
          if (
            parsed.type &&
            ['user', 'copilot', 'info', 'tool_call_requested', 'tool_call_completed'].includes(
              parsed.type
            )
          ) {
            return true
          }
        } catch {}
      }

      return false
    } catch {
      return false
    }
  }

  parseMessage(rawMessage: RawLogMessage): ParsedMessage[] {
    const copilotMessage = rawMessage as CopilotRawMessage

    const timestamp = this.parseTimestamp(copilotMessage.timestamp)
    if (!timestamp) {
      return []
    }

    const messageType = this.getMessageType(copilotMessage)

    // Handle tool_call_requested - creates tool_use message
    if (copilotMessage.type === 'tool_call_requested') {
      const toolUse: ToolUseContent = {
        type: 'tool_use',
        id: copilotMessage.callId || `tool-${timestamp.getTime()}`,
        name: copilotMessage.name || 'unknown',
        input: copilotMessage.arguments || {},
      }

      const structuredContent: StructuredMessageContent = {
        text: '',
        toolUses: [toolUse],
        toolResults: [],
        structured: [toolUse],
      }

      return [
        {
          id: copilotMessage.callId || `tool-${timestamp.getTime()}`,
          timestamp,
          type: 'tool_use',
          content: structuredContent,
          metadata: {
            toolTitle: copilotMessage.toolTitle,
            intentionSummary: copilotMessage.intentionSummary,
            hasToolUses: true,
            toolCount: 1,
          },
        },
      ]
    }

    // Handle tool_call_completed - creates both tool_use and tool_result
    // (GitHub Copilot sends a single event with both request and result data)
    if (copilotMessage.type === 'tool_call_completed') {
      const toolUseId = copilotMessage.callId || `tool-${timestamp.getTime()}`

      const toolUse: ToolUseContent = {
        type: 'tool_use',
        id: toolUseId,
        name: copilotMessage.name || 'unknown',
        input: copilotMessage.arguments || {},
      }

      const toolResult: ToolResultContent = {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content:
          copilotMessage.result &&
          typeof copilotMessage.result === 'object' &&
          'log' in copilotMessage.result
            ? (copilotMessage.result.log as string)
            : copilotMessage.result,
      }

      const toolUseContent: StructuredMessageContent = {
        text: '',
        toolUses: [toolUse],
        toolResults: [],
        structured: [toolUse],
      }

      const toolResultContent: StructuredMessageContent = {
        text: '',
        toolUses: [],
        toolResults: [toolResult],
        structured: [toolResult],
      }

      return [
        // Tool use message
        {
          id: toolUseId,
          timestamp,
          type: 'tool_use',
          content: toolUseContent,
          metadata: {
            toolTitle: copilotMessage.toolTitle,
            intentionSummary: copilotMessage.intentionSummary,
            hasToolUses: true,
            toolCount: 1,
          },
        },
        // Tool result message
        {
          id: `result-${toolUseId}`,
          timestamp,
          type: 'tool_result',
          content: toolResultContent,
          metadata: {
            toolName: copilotMessage.name,
            resultType:
              copilotMessage.result &&
              typeof copilotMessage.result === 'object' &&
              'type' in copilotMessage.result
                ? (copilotMessage.result.type as string)
                : undefined,
            hasToolResults: true,
            resultCount: 1,
          },
          linkedTo: toolUseId,
        },
      ]
    }

    // Handle regular messages (user, copilot, info)
    const content = copilotMessage.text || ''

    return [
      {
        id: copilotMessage.id || `msg-${timestamp.getTime()}`,
        timestamp,
        type: messageType,
        content,
        metadata: {
          entryType: copilotMessage.type,
        },
      },
    ]
  }

  /**
   * Extract all tool uses from the session
   */
  extractToolUses(session: import('../../base/types.js').ParsedSession): ToolUseContent[] {
    const toolUses: ToolUseContent[] = []

    for (const message of session.messages) {
      if (
        typeof message.content !== 'string' &&
        message.content.toolUses &&
        message.content.toolUses.length > 0
      ) {
        toolUses.push(...message.content.toolUses)
      }
    }

    return toolUses
  }

  /**
   * Extract all tool results from the session
   */
  extractToolResults(session: import('../../base/types.js').ParsedSession): ToolResultContent[] {
    const toolResults: ToolResultContent[] = []

    for (const message of session.messages) {
      if (
        typeof message.content !== 'string' &&
        message.content.toolResults &&
        message.content.toolResults.length > 0
      ) {
        toolResults.push(...message.content.toolResults)
      }
    }

    return toolResults
  }

  /**
   * Generate session ID with copilot- prefix for GitHub Copilot sessions
   */
  protected extractSessionId(_rawMessage: RawLogMessage): string | null {
    // GitHub Copilot doesn't include session IDs in messages
    // Generate one with copilot- prefix
    return `copilot-${Date.now()}`
  }

  private getMessageType(message: CopilotRawMessage): ParsedMessage['type'] {
    switch (message.type) {
      case 'user':
        return 'user_input'
      case 'copilot':
      case 'info':
        return 'assistant_response'
      case 'tool_call_requested':
        return 'tool_use'
      case 'tool_call_completed':
        return 'tool_result'
      default:
        return 'meta'
    }
  }
}
