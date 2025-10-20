/**
 * OpenCode Parser
 *
 * Handles OpenCode-specific message formats.
 */

import {
  type ContentBlock,
  type StructuredMessageContent,
  type ToolResultContent,
  type ToolUseContent,
  isTextContent,
  isToolResultContent,
  isToolUseContent,
} from '@guideai-dev/types'
import { BaseParser } from '../../base/BaseParser.js'
import type { ParsedMessage, RawLogMessage } from '../../base/index.js'
import type { OpenCodeRawMessage } from './types.js'

export class OpenCodeParser extends BaseParser {
  readonly name = 'opencode'
  readonly providerName = 'opencode'

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

  canParse(jsonlContent: string): boolean {
    try {
      const lines = jsonlContent.split('\n').filter(line => line.trim())
      if (lines.length === 0) return false

      // OpenCode format is similar to Claude but with different metadata
      // It should have sessionId and message structure
      for (const line of lines.slice(0, 5)) {
        try {
          const parsed = JSON.parse(line) as Partial<OpenCodeRawMessage>

          if (
            parsed.sessionId &&
            parsed.timestamp &&
            parsed.message &&
            (parsed.type === 'user' ||
              parsed.type === 'assistant' ||
              parsed.type === 'tool_use' ||
              parsed.type === 'tool_result')
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
    const openCodeMessage = rawMessage as OpenCodeRawMessage

    const timestamp = this.parseTimestamp(openCodeMessage.timestamp)
    if (!timestamp) {
      return []
    }

    const messageType = this.getMessageType(openCodeMessage)
    const messageContent = openCodeMessage.message?.content

    // Handle direct tool_use messages
    if (messageType === 'tool_use') {
      const content = this.extractContentFromArray(messageContent)
      if (content && isToolUseContent(content)) {
        const structuredContent: StructuredMessageContent = {
          text: '',
          toolUses: [content],
          toolResults: [],
          structured: [content],
        }

        return [
          {
            id: `${openCodeMessage.sessionId}-${timestamp.getTime()}-tool-${content.id}`,
            timestamp,
            type: 'tool_use',
            content: structuredContent,
            metadata: {
              sessionId: openCodeMessage.sessionId,
              toolUseId: content.id,
              hasToolUses: true,
              toolCount: 1,
            },
          },
        ]
      }
    }

    // Handle direct tool_result messages
    if (messageType === 'tool_result') {
      const content = this.extractContentFromArray(messageContent)
      if (content && isToolResultContent(content)) {
        const structuredContent: StructuredMessageContent = {
          text: '',
          toolUses: [],
          toolResults: [content],
          structured: [content],
        }

        return [
          {
            id: `${openCodeMessage.sessionId}-${timestamp.getTime()}-result-${content.tool_use_id}`,
            timestamp,
            type: 'tool_result',
            content: structuredContent,
            metadata: {
              sessionId: openCodeMessage.sessionId,
              hasToolResults: true,
              resultCount: 1,
            },
            linkedTo: content.tool_use_id,
          },
        ]
      }
    }

    // Handle assistant messages with tool uses (legacy format)
    if (
      messageType === 'assistant_response' &&
      Array.isArray(messageContent) &&
      messageContent.some(part => isToolUseContent(part))
    ) {
      return this.splitAssistantWithTools(openCodeMessage, messageContent, timestamp)
    }

    // Handle regular messages
    const content = this.processContent(messageContent)

    return [
      {
        id: `${openCodeMessage.sessionId}-${timestamp.getTime()}`,
        timestamp,
        type: messageType,
        content,
        metadata: {
          sessionId: openCodeMessage.sessionId,
          role: openCodeMessage.message?.role,
        },
      },
    ]
  }

  private getMessageType(message: OpenCodeRawMessage): ParsedMessage['type'] {
    if (message.type === 'tool_use') return 'tool_use'
    if (message.type === 'tool_result') return 'tool_result'
    if (message.type === 'user') return 'user_input'
    if (message.type === 'assistant') return 'assistant_response'
    return 'meta'
  }

  private extractContentFromArray(content: unknown): ContentBlock | null {
    if (Array.isArray(content) && content.length > 0) {
      return content[0]
    }
    return null
  }

  private splitAssistantWithTools(
    message: OpenCodeRawMessage,
    content: ContentBlock[],
    timestamp: Date
  ): ParsedMessage[] {
    const messages: ParsedMessage[] = []

    // Extract text parts
    const textParts = content.filter(part => isTextContent(part))
    if (textParts.length > 0) {
      const textContent = textParts.map(part => (isTextContent(part) ? part.text : '')).join('\n')
      messages.push({
        id: `${message.sessionId}-${timestamp.getTime()}`,
        timestamp,
        type: 'assistant_response',
        content: textContent,
        metadata: {
          sessionId: message.sessionId,
          role: message.message?.role,
        },
      })
    }

    // Extract tool uses
    const toolUses = content.filter(part => isToolUseContent(part))
    for (const toolUse of toolUses) {
      if (isToolUseContent(toolUse)) {
        const structuredContent: StructuredMessageContent = {
          text: '',
          toolUses: [toolUse],
          toolResults: [],
          structured: [toolUse],
        }

        messages.push({
          id: `${message.sessionId}-${timestamp.getTime()}-tool-${toolUse.id}`,
          timestamp,
          type: 'tool_use',
          content: structuredContent,
          metadata: {
            sessionId: message.sessionId,
            toolUseId: toolUse.id,
            hasToolUses: true,
            toolCount: 1,
          },
        })
      }
    }

    return messages
  }

  private processContent(content: unknown): string | StructuredMessageContent {
    if (typeof content === 'string') {
      return content
    }

    if (Array.isArray(content)) {
      const textParts = content.filter(part => isTextContent(part))
      const toolUses = content.filter(part => isToolUseContent(part))
      const toolResults = content.filter(part => isToolResultContent(part))

      const structuredContent: StructuredMessageContent = {
        text: textParts.map(part => (isTextContent(part) ? part.text : '')).join('\n'),
        toolUses: toolUses.filter(isToolUseContent),
        toolResults: toolResults.filter(isToolResultContent),
        structured: content,
      }

      return structuredContent
    }

    return ''
  }
}
