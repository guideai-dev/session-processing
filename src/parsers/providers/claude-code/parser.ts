/**
 * Claude Code Parser
 *
 * Consolidates parsing logic for Claude Code sessions from both UI and backend.
 * Handles Claude-specific message formats, tool uses, thinking blocks, and content types.
 */

import {
  type ContentBlock,
  type StructuredMessageContent,
  isStructuredMessageContent,
  isTextContent,
  isToolResultContent,
  isToolUseContent,
} from '@guideai-dev/types'
import { BaseParser } from '../../base/BaseParser.js'
import type { ContentPart, ParsedMessage, RawLogMessage } from '../../base/index.js'
import type { ClaudeRawMessage } from './types.js'

export class ClaudeCodeParser extends BaseParser {
  readonly name = 'claude-code'
  readonly providerName = 'claude-code'

  /**
   * Extract all tool uses from the session
   */
  extractToolUses(
    session: import('../../base/types.js').ParsedSession
  ): import('@guideai-dev/types').ToolUseContent[] {
    const toolUses: import('@guideai-dev/types').ToolUseContent[] = []

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
  extractToolResults(
    session: import('../../base/types.js').ParsedSession
  ): import('@guideai-dev/types').ToolResultContent[] {
    const toolResults: import('@guideai-dev/types').ToolResultContent[] = []

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
   * Find interruptions in the session
   */
  findInterruptions(
    session: import('../../base/types.js').ParsedSession
  ): import('../../base/types.js').ParsedMessage[] {
    return session.messages.filter(
      message =>
        message.type === 'user_input' &&
        typeof message.content === 'string' &&
        (message.content.includes('[Request interrupted by user]') ||
          message.content.includes('Request interrupted by user'))
    )
  }

  /**
   * Calculate response times between user inputs and assistant responses
   */
  calculateResponseTimes(session: import('../../base/types.js').ParsedSession): Array<{
    userMessage: import('../../base/types.js').ParsedMessage
    assistantMessage: import('../../base/types.js').ParsedMessage
    responseTime: number
  }> {
    const responseTimes: Array<{
      userMessage: import('../../base/types.js').ParsedMessage
      assistantMessage: import('../../base/types.js').ParsedMessage
      responseTime: number
    }> = []

    for (let i = 0; i < session.messages.length - 1; i++) {
      const current = session.messages[i]
      const next = session.messages[i + 1]

      if (
        current.type === 'user_input' &&
        next.type === 'assistant_response' &&
        current.timestamp &&
        next.timestamp
      ) {
        const responseTime = next.timestamp.getTime() - current.timestamp.getTime()
        responseTimes.push({
          userMessage: current,
          assistantMessage: next,
          responseTime,
        })
      }
    }

    return responseTimes
  }

  /**
   * Check if content looks like Claude Code format
   */
  canParse(jsonlContent: string): boolean {
    try {
      const lines = jsonlContent.split('\n').filter(line => line.trim())
      if (lines.length === 0) return false

      // Check first few lines for Claude Code structure
      for (const line of lines.slice(0, 5)) {
        try {
          const parsed = JSON.parse(line) as Partial<ClaudeRawMessage>

          // Claude Code messages have these distinct fields
          if (
            parsed.uuid &&
            parsed.timestamp &&
            parsed.type &&
            parsed.message &&
            (parsed.type === 'user' || parsed.type === 'assistant')
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

  /**
   * Parse a Claude Code message into one or more parsed messages
   * May split messages containing both text and tool uses
   */
  parseMessage(rawMessage: RawLogMessage): ParsedMessage[] {
    const claudeMessage = rawMessage as ClaudeRawMessage

    // Skip meta messages
    if (claudeMessage.isMeta) {
      return []
    }

    const timestamp = this.parseTimestamp(claudeMessage.timestamp)
    if (!timestamp) {
      return []
    }

    const messageType = this.getMessageType(claudeMessage)
    const messageContent = claudeMessage.message?.content ?? claudeMessage.content

    // Handle assistant messages with tool uses - split into separate messages
    if (
      messageType === 'assistant_response' &&
      Array.isArray(messageContent) &&
      messageContent.some(part => isToolUseContent(part))
    ) {
      return this.splitAssistantWithTools(claudeMessage, messageContent, timestamp)
    }

    // Handle user messages with tool results
    if (
      messageType === 'user_input' &&
      Array.isArray(messageContent) &&
      messageContent.some(part => isToolResultContent(part))
    ) {
      return this.parseToolResultsFromMessage(claudeMessage, messageContent, timestamp)
    }

    // Single message
    return [this.createParsedMessage(claudeMessage, messageType, messageContent, timestamp)]
  }

  /**
   * Determine message type from Claude message
   *
   * Transforms raw Claude JSONL message types into unified internal types:
   * - Raw "user" → 'user_input' (or 'tool_result', 'interruption', 'command' for special cases)
   * - Raw "assistant" → 'assistant_response'
   * - Raw "system" → 'meta'
   *
   * Note: The raw JSONL format uses "user"/"assistant"/"system" as documented in
   * provider-docs/claude/claude-jsonl.md, but we transform these into unified types
   * defined in ParsedMessage['type'] for consistency across all providers.
   */
  private getMessageType(message: ClaudeRawMessage): ParsedMessage['type'] {
    if (message.type === 'user') {
      const content = message.message?.content

      // Check if it's a tool result (array with tool_result type)
      if (
        Array.isArray(content) &&
        content.some(
          item => typeof item === 'object' && item !== null && item.type === 'tool_result'
        )
      ) {
        return 'tool_result'
      }

      // Check for interruption in parts structure
      const parsedParts = this.parsePartsContent(content)
      if (parsedParts) {
        const hasInterruption = parsedParts.parts.some(
          part =>
            part.type === 'text' &&
            (part.text?.includes('[Request interrupted by user]') ||
              part.text?.includes('Request interrupted by user'))
        )
        const onlyInterruption = parsedParts.parts.every(
          part =>
            part.type === 'text' &&
            (part.text?.includes('[Request interrupted by user]') ||
              part.text?.includes('Request interrupted by user') ||
              !part.text?.trim())
        )

        if (hasInterruption && onlyInterruption) {
          return 'interruption'
        }

        // Check for command in parts structure
        const hasCommand = parsedParts.parts.some(
          part =>
            part.type === 'text' &&
            (part.text?.startsWith('/') || part.text?.includes('<command-name>'))
        )
        const onlyCommand = parsedParts.parts.every(
          part =>
            part.type === 'text' &&
            (part.text?.startsWith('/') ||
              part.text?.includes('<command-name>') ||
              !part.text?.trim())
        )

        if (hasCommand && onlyCommand) {
          return 'command'
        }
      }

      // Check string content for interruption/command
      if (typeof content === 'string') {
        if (this.isInterruptionContent(content)) return 'interruption'
        if (this.isCommandContent(content)) return 'command'
      }

      return 'user_input'
    }

    if (message.type === 'assistant') {
      return 'assistant_response'
    }

    return 'meta'
  }

  /**
   * Split assistant message with tools into separate text and tool_use messages
   */
  private splitAssistantWithTools(
    message: ClaudeRawMessage,
    content: ContentBlock[],
    timestamp: Date
  ): ParsedMessage[] {
    const messages: ParsedMessage[] = []

    // Extract text parts
    const textParts = content.filter(part => isTextContent(part))
    if (textParts.length > 0) {
      const textContent = textParts.map(part => (isTextContent(part) ? part.text : '')).join('\n')
      messages.push({
        id: message.uuid,
        timestamp,
        type: 'assistant_response',
        content: textContent,
        metadata: {
          role: message.message?.role || 'assistant',
          sessionId: message.sessionId,
          userType: message.userType,
          requestId: message.requestId,
        },
        parentId: message.parentUuid,
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
          id: `${message.uuid}-tool-${toolUse.id}`,
          timestamp,
          type: 'tool_use',
          content: structuredContent,
          metadata: {
            role: 'tool',
            sessionId: message.sessionId,
            toolUseId: toolUse.id,
            hasToolUses: true,
            toolCount: 1,
          },
          parentId: message.uuid,
        })
      }
    }

    return messages
  }

  /**
   * Parse tool results from user message during message parsing
   */
  private parseToolResultsFromMessage(
    message: ClaudeRawMessage,
    content: ContentBlock[],
    timestamp: Date
  ): ParsedMessage[] {
    const toolResults = content.filter(part => isToolResultContent(part))

    return toolResults.map(toolResult => {
      if (!isToolResultContent(toolResult)) {
        throw new Error('Expected tool result content')
      }

      const structuredContent: StructuredMessageContent = {
        text: '',
        toolUses: [],
        toolResults: [toolResult],
        structured: [toolResult],
      }

      return {
        id: `${message.uuid}-result-${toolResult.tool_use_id}`,
        timestamp,
        type: 'tool_result',
        content: structuredContent,
        metadata: {
          role: 'tool',
          sessionId: message.sessionId,
          hasToolResults: true,
          resultCount: 1,
        },
        parentId: message.parentUuid,
        linkedTo: toolResult.tool_use_id,
      }
    })
  }

  /**
   * Create a single parsed message
   */
  private createParsedMessage(
    message: ClaudeRawMessage,
    type: ParsedMessage['type'],
    messageContent: string | ContentBlock[] | undefined,
    timestamp: Date
  ): ParsedMessage {
    let content: string | StructuredMessageContent

    // Parse content based on type
    if (typeof messageContent === 'string') {
      content = messageContent
    } else if (Array.isArray(messageContent)) {
      // Handle structured content
      const textParts: string[] = []
      const toolUses = messageContent.filter(part => isToolUseContent(part))
      const toolResults = messageContent.filter(part => isToolResultContent(part))

      for (const part of messageContent) {
        if (isTextContent(part)) {
          textParts.push(part.text)
        }
      }

      content = {
        text: textParts.join('\n'),
        toolUses: toolUses.filter(isToolUseContent),
        toolResults: toolResults.filter(isToolResultContent),
        structured: messageContent,
      }
    } else {
      content = ''
    }

    return {
      id: message.uuid,
      timestamp,
      type,
      content,
      metadata: {
        role: message.message?.role || type,
        parentUuid: message.parentUuid,
        requestId: message.requestId,
        userType: message.userType,
        sessionId: message.sessionId,
        subtype: message.subtype,
        level: message.level,
        hasToolUses: typeof content !== 'string' && content.toolUses.length > 0,
        hasToolResults: typeof content !== 'string' && content.toolResults.length > 0,
        toolCount: typeof content !== 'string' ? content.toolUses.length : 0,
        resultCount: typeof content !== 'string' ? content.toolResults.length : 0,
      },
      parentId: message.parentUuid,
    }
  }
}
