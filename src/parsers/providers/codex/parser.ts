/**
 * Codex Parser
 *
 * Handles Codex-specific message formats with payload structure.
 */

import type { ToolResultContent, ToolUseContent } from '@guideai-dev/types'
import { BaseParser } from '../../base/BaseParser.js'
import type { ParsedMessage, RawLogMessage } from '../../base/index.js'
import type { CodexRawMessage } from './types.js'

export class CodexParser extends BaseParser {
  readonly name = 'codex'
  readonly providerName = 'codex'

  canParse(jsonlContent: string): boolean {
    try {
      const lines = jsonlContent.split('\n').filter(line => line.trim())
      if (lines.length === 0) return false

      for (const line of lines.slice(0, 5)) {
        try {
          const parsed = JSON.parse(line) as Partial<CodexRawMessage>

          // Codex messages have payload structure or specific messageID/sessionID fields
          if (
            parsed.payload ||
            (parsed.messageID !== undefined && parsed.sessionID !== undefined)
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
    const codexMessage = rawMessage as CodexRawMessage

    const timestamp = this.parseTimestamp(codexMessage.timestamp)
    if (!timestamp) {
      return []
    }

    const payloadType = codexMessage.payload?.type

    // Skip event_msg duplicates - they're simpler versions of the fuller response_items that follow
    // - agent_reasoning -> followed by 'reasoning' response_item with summary + encrypted content
    // - agent_message -> followed by 'message' response_item with full content array
    if (payloadType === 'agent_reasoning' || payloadType === 'agent_message') {
      return []
    }

    const id =
      typeof codexMessage.id === 'string' ? codexMessage.id : this.generateMessageId(0, timestamp)

    const messageType = this.inferType(codexMessage)

    return [
      {
        id,
        timestamp,
        type: messageType,
        content: codexMessage as unknown as string,
        metadata: {
          messageID: codexMessage.messageID,
          sessionID: codexMessage.sessionID,
          payloadType: codexMessage.payload?.type,
        },
      },
    ]
  }

  /**
   * Extract session ID from session_meta message payload
   */
  protected extractSessionId(rawMessage: RawLogMessage): string | null {
    const codexMessage = rawMessage as CodexRawMessage

    // Check for session_meta type with payload.id
    if (
      codexMessage.type === 'session_meta' &&
      codexMessage.payload &&
      typeof codexMessage.payload === 'object' &&
      'id' in codexMessage.payload &&
      typeof codexMessage.payload.id === 'string'
    ) {
      return codexMessage.payload.id
    }

    // Check for sessionID or sessionId on the message itself
    if (typeof codexMessage.sessionID === 'string') {
      return codexMessage.sessionID
    }
    if (typeof codexMessage.sessionId === 'string') {
      return codexMessage.sessionId
    }

    return null
  }

  /**
   * Extract all tool uses from the session
   */
  extractToolUses(session: import('../../base/types.js').ParsedSession): ToolUseContent[] {
    const toolUses: ToolUseContent[] = []

    for (const message of session.messages) {
      if (message.type === 'tool_use' && typeof message.content !== 'string') {
        const rawMessage = message.content as unknown as CodexRawMessage
        const payload = rawMessage.payload

        if (payload && payload.type === 'function_call') {
          const callId =
            typeof payload.call_id === 'string'
              ? payload.call_id
              : `tool-${message.timestamp?.getTime()}`
          const name = typeof payload.name === 'string' ? payload.name : 'unknown'
          let input: Record<string, unknown> = {}

          if (typeof payload.arguments === 'string') {
            try {
              input = JSON.parse(payload.arguments)
            } catch {
              // Keep empty object if JSON parse fails
            }
          } else if (typeof payload.arguments === 'object' && payload.arguments !== null) {
            input = payload.arguments as Record<string, unknown>
          }

          toolUses.push({
            type: 'tool_use',
            id: callId,
            name,
            input,
          })
        }
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
      if (message.type === 'tool_result' && typeof message.content !== 'string') {
        const rawMessage = message.content as unknown as CodexRawMessage
        const payload = rawMessage.payload

        if (payload && payload.type === 'function_call_output') {
          const callId =
            typeof payload.call_id === 'string'
              ? payload.call_id
              : `tool-${message.timestamp?.getTime()}`
          const output = typeof payload.output === 'string' ? payload.output : ''

          toolResults.push({
            type: 'tool_result',
            tool_use_id: callId,
            content: output,
          })
        }
      }
    }

    return toolResults
  }

  private inferType(message: CodexRawMessage): ParsedMessage['type'] {
    const payload = message.payload
    const payloadType = payload?.type || message.type

    if (payloadType === 'user_message') return 'user_input'
    if (payloadType === 'agent_message' || payloadType === 'agent_reasoning')
      return 'assistant_response'
    if (payloadType === 'function_call') return 'tool_use'
    if (payloadType === 'function_call_output') return 'tool_result'
    if (payloadType === 'turn_aborted') return 'interruption'

    // Handle response_item with type === 'message' and role field
    if (payloadType === 'message' && payload && 'role' in payload) {
      if (payload.role === 'user') return 'user_input'
      if (payload.role === 'assistant') return 'assistant_response'
    }

    return 'meta'
  }
}
