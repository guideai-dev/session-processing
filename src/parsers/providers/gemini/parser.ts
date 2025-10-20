/**
 * Gemini Code Parser
 *
 * Handles Gemini-specific message formats including thoughts, tokens, and model metadata.
 */

import {
  type StructuredMessageContent,
  isTextContent,
  isToolResultContent,
  isToolUseContent,
} from '@guideai-dev/types'
import { BaseParser } from '../../base/BaseParser.js'
import type { ContentPart, ParsedMessage, RawLogMessage } from '../../base/index.js'
import type { GeminiRawMessage } from './types.js'

export class GeminiParser extends BaseParser {
  readonly name = 'gemini-code'
  readonly providerName = 'gemini-code'

  canParse(jsonlContent: string): boolean {
    try {
      const lines = jsonlContent.split('\n').filter(line => line.trim())
      if (lines.length === 0) return false

      for (const line of lines.slice(0, 5)) {
        try {
          const parsed = JSON.parse(line) as Partial<GeminiRawMessage>

          // Gemini messages have gemini_model, gemini_thoughts, or type 'gemini'
          if (
            parsed.gemini_model ||
            parsed.gemini_thoughts !== undefined ||
            parsed.type === 'gemini'
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
    const geminiMessage = rawMessage as GeminiRawMessage

    const timestamp = this.parseTimestamp(geminiMessage.timestamp)
    if (!timestamp) {
      return []
    }

    const messageType = this.getMessageType(geminiMessage)
    const messageContent = geminiMessage.message?.content

    // Handle tool_use messages
    if (
      messageType === 'tool_use' ||
      (Array.isArray(messageContent) &&
        messageContent.some((part: unknown) => this.isObjectWithType(part, 'tool_use')))
    ) {
      const toolUse = Array.isArray(messageContent)
        ? messageContent.find((part: unknown) => this.isObjectWithType(part, 'tool_use'))
        : null

      if (toolUse && isToolUseContent(toolUse)) {
        const structuredContent: StructuredMessageContent = {
          text: '',
          toolUses: [toolUse],
          toolResults: [],
          structured: [toolUse],
        }

        return [
          {
            id: geminiMessage.uuid || this.generateMessageId(0, timestamp),
            timestamp,
            type: 'tool_use',
            content: structuredContent,
            metadata: {
              sessionId: geminiMessage.sessionId,
              toolUseId: toolUse.id,
              hasToolUses: true,
              toolCount: 1,
            },
          },
        ]
      }
    }

    // Handle tool_result messages
    if (
      messageType === 'tool_result' ||
      (Array.isArray(messageContent) &&
        messageContent.some((part: unknown) => this.isObjectWithType(part, 'tool_result')))
    ) {
      const toolResult = Array.isArray(messageContent)
        ? messageContent.find((part: unknown) => this.isObjectWithType(part, 'tool_result'))
        : null

      if (toolResult && isToolResultContent(toolResult)) {
        const structuredContent: StructuredMessageContent = {
          text: '',
          toolUses: [],
          toolResults: [toolResult],
          structured: [toolResult],
        }

        return [
          {
            id: geminiMessage.uuid || this.generateMessageId(0, timestamp),
            timestamp,
            type: 'tool_result',
            content: structuredContent,
            metadata: {
              sessionId: geminiMessage.sessionId,
              hasToolResults: true,
              resultCount: 1,
            },
            linkedTo: toolResult.tool_use_id,
          },
        ]
      }
    }

    // Handle regular messages
    const content = this.processContent(messageContent)

    return [
      {
        id: geminiMessage.uuid || this.generateMessageId(0, timestamp),
        timestamp,
        type: messageType,
        content,
        metadata: {
          sessionId: geminiMessage.sessionId,
          model: geminiMessage.gemini_model,
          thoughts: geminiMessage.gemini_thoughts,
          tokens: geminiMessage.gemini_tokens,
          cwd: geminiMessage.cwd,
          role: geminiMessage.message?.role || messageType,
        },
      },
    ]
  }

  private getMessageType(message: GeminiRawMessage): ParsedMessage['type'] {
    if (message.type === 'user') return 'user_input'
    if (message.type === 'gemini' || message.type === 'assistant') return 'assistant_response'
    if (message.type === 'tool_use') return 'tool_use'
    if (message.type === 'tool_result') return 'tool_result'
    return 'meta'
  }

  private processContent(content: unknown): string | StructuredMessageContent {
    // Handle string content
    if (typeof content === 'string') {
      return content
    }

    // Handle array content
    if (Array.isArray(content)) {
      // Cast to ContentBlock[] since we're parsing raw JSONL data
      // The type system can't validate runtime data, so we use a type assertion
      const contentBlocks = content as import('@guideai-dev/types').ContentBlock[]

      const textParts = contentBlocks.filter(part => isTextContent(part)).map(part => part.text)

      const structuredContent: StructuredMessageContent = {
        text: textParts.join('\n'),
        toolUses: [],
        toolResults: [],
        structured: contentBlocks,
      }

      return structuredContent
    }

    return ''
  }

  private isObjectWithType(obj: unknown, type: string): boolean {
    return typeof obj === 'object' && obj !== null && 'type' in obj && obj.type === type
  }
}
