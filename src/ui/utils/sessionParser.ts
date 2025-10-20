import { isTextContent, isToolResultContent, isToolUseContent } from '@guideai-dev/types'
import { getArray, getObject, getString, hasProperty, isObject } from '../../utils/safe-access.js'
import {
  type BaseSessionMessage,
  type ClaudeMessage,
  type ConversationTurn,
  type ProviderAdapter,
  type SessionParser,
  TextContent,
  ToolResultContent,
  ToolUseContent,
} from './sessionTypes.js'

// Helper types for content parsing
interface ContentPart {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: unknown
}

interface PartsContent {
  parts: ContentPart[]
}

type RawMessageContent = string | PartsContent | Record<string, unknown> | unknown[]

// Base type for raw messages from different providers
interface RawMessage {
  timestamp: string
  sessionId?: string
  type?: string
  content?: RawMessageContent
  message?: {
    role?: string
    content?: RawMessageContent
  }
  // Provider-specific fields
  uuid?: string
  id?: string
  role?: string
  text?: string
  callId?: string
  name?: string
  arguments?: Record<string, unknown>
  result?: unknown | { log?: string; type?: string }
  toolTitle?: string
  intentionSummary?: string
  userType?: string
  requestId?: string
  isMeta?: boolean
  parentUuid?: string
  gemini_model?: string
  gemini_thoughts?: unknown
  gemini_tokens?: unknown
  cwd?: string
  payload?: Record<string, unknown>
  messageID?: unknown
  sessionID?: unknown
}

class ClaudeAdapter implements ProviderAdapter {
  name = 'claude'

  transform(rawMessage: ClaudeMessage): BaseSessionMessage[] {
    const messageType = this.getMessageType(rawMessage)
    const processedContent = this.processContent(rawMessage)

    // For assistant messages with tool uses, split into separate messages
    if (messageType === 'assistant_response' && processedContent.parts) {
      const messages: BaseSessionMessage[] = []

      // Create assistant response message for text content
      const textParts = processedContent.parts.filter(
        (p: { type: string; text?: string }) => p.type === 'text'
      )
      if (textParts.length > 0) {
        messages.push({
          id: rawMessage.uuid,
          timestamp: rawMessage.timestamp,
          type: 'assistant_response',
          content: { text: textParts.map((p: { text?: string }) => p.text || '').join('\n') },
          metadata: {
            sessionId: rawMessage.sessionId,
            userType: rawMessage.userType,
            requestId: rawMessage.requestId,
            isMeta: rawMessage.isMeta,
          },
          parentId: rawMessage.parentUuid,
        })
      }

      // Create separate tool use messages
      const toolUses = processedContent.parts.filter((p: ContentPart) => p.type === 'tool_use')
      for (const toolUse of toolUses) {
        messages.push({
          id: `${rawMessage.uuid}-tool-${toolUse.id || ''}`,
          timestamp: rawMessage.timestamp,
          type: 'tool_use',
          content: toolUse,
          metadata: {
            sessionId: rawMessage.sessionId,
            toolUseId: toolUse.id,
          },
          parentId: rawMessage.uuid,
        })
      }

      return messages
    }

    // For tool results, link to their tool use
    if (messageType === 'tool_result' && processedContent.parts) {
      const toolResults = processedContent.parts.filter(
        (p: ContentPart) => p.type === 'tool_result'
      )
      return toolResults.map((result: ContentPart) => ({
        id: `${rawMessage.uuid}-result-${result.tool_use_id}`,
        timestamp: rawMessage.timestamp,
        type: 'tool_result' as const,
        content: result,
        metadata: {
          sessionId: rawMessage.sessionId,
        },
        parentId: rawMessage.parentUuid,
        linkedTo: result.tool_use_id,
      }))
    }

    // Default single message
    return [
      {
        id: rawMessage.uuid,
        timestamp: rawMessage.timestamp,
        type: messageType,
        content: processedContent,
        metadata: {
          sessionId: rawMessage.sessionId,
          userType: rawMessage.userType,
          requestId: rawMessage.requestId,
          isMeta: rawMessage.isMeta,
        },
        parentId: rawMessage.parentUuid,
      },
    ]
  }

  private getMessageType(message: ClaudeMessage): BaseSessionMessage['type'] {
    if (message.isMeta) return 'meta'

    if (message.type === 'user') {
      // Skip messages without message.content (e.g., file-history-snapshot)
      if (!message.message?.content) {
        return 'meta'
      }

      // Check if this is a tool result vs real user input
      const content = message.message.content
      if (Array.isArray(content) && content.some(item => item.type === 'tool_result')) {
        return 'tool_result'
      }

      // Parse JSON parts structure if it exists
      const parsedContent = this.parsePartsContent(content)
      if (parsedContent) {
        // Check for interruption in parts structure - ONLY if it's specifically about interruption
        const hasInterruptionText = parsedContent.parts?.some(
          part =>
            part.type === 'text' &&
            (part.text?.includes('[Request interrupted by user]') ||
              part.text?.includes('Request interrupted by user'))
        )
        const hasOnlyInterruptionText = parsedContent.parts?.every(
          part =>
            part.type === 'text' &&
            (part.text?.includes('[Request interrupted by user]') ||
              part.text?.includes('Request interrupted by user') ||
              !part.text?.trim())
        )

        if (hasInterruptionText && hasOnlyInterruptionText) {
          return 'interruption'
        }

        // Check for commands in parts structure - ONLY if it's specifically a command
        const hasCommandText = parsedContent.parts?.some(
          part =>
            part.type === 'text' &&
            (part.text?.startsWith('/') || part.text?.includes('<command-name>'))
        )
        const hasOnlyCommandText = parsedContent.parts?.every(
          part =>
            part.type === 'text' &&
            (part.text?.startsWith('/') ||
              part.text?.includes('<command-name>') ||
              !part.text?.trim())
        )

        if (hasCommandText && hasOnlyCommandText) {
          return 'command'
        }

        // Everything else with parts structure is user_input (including images)
        return 'user_input'
      }

      // Fallback to string-based checks
      if (typeof content === 'string') {
        if (content.startsWith('/') || content.includes('<command-name>')) {
          return 'command'
        }

        if (
          content.includes('Request interrupted by user') ||
          content.includes('[Request interrupted by user]')
        ) {
          return 'interruption'
        }
      }

      // Check if this is a simple interruption message (array with only interruption text)
      if (Array.isArray(content)) {
        const hasInterruptionText = content.some(
          item =>
            item.type === 'text' &&
            (item.text?.includes('[Request interrupted by user]') ||
              item.text?.includes('Request interrupted by user'))
        )
        const hasOnlyInterruptionText = content.every(
          item =>
            item.type === 'text' &&
            (item.text?.includes('[Request interrupted by user]') ||
              item.text?.includes('Request interrupted by user') ||
              !item.text?.trim())
        )

        if (hasInterruptionText && hasOnlyInterruptionText) {
          return 'interruption'
        }
      }

      return 'user_input'
    }

    if (message.type === 'assistant') {
      return 'assistant_response'
    }

    return 'meta'
  }

  private parsePartsContent(content: RawMessageContent): PartsContent | null {
    // Try to parse the content as a parts structure
    try {
      if (typeof content === 'string') {
        const parsed = JSON.parse(content)
        if (parsed?.parts && Array.isArray(parsed.parts)) {
          return parsed
        }
      } else if (
        typeof content === 'object' &&
        content !== null &&
        'parts' in content &&
        Array.isArray((content as { parts: unknown }).parts)
      ) {
        return content as PartsContent
      }
    } catch (_error) {
      // Not valid JSON or not a parts structure
    }
    return null
  }

  private processContent(message: ClaudeMessage) {
    // Skip messages without content (e.g., file-history-snapshot)
    if (!message.message?.content) {
      return null
    }

    const content = message.message.content

    // First check if it's a parts structure
    const parsedParts = this.parsePartsContent(content)
    if (parsedParts) {
      return parsedParts
    }

    if (typeof content === 'string') {
      // Try to parse as JSON first to check for parts structure
      try {
        const parsed = JSON.parse(content)
        if (parsed?.parts && Array.isArray(parsed.parts)) {
          return parsed
        }
        // If it's JSON but not parts structure, keep it as parsed object
        return parsed
      } catch {
        // Not JSON, treat as plain text
        return { text: content }
      }
    }

    if (Array.isArray(content)) {
      const processed = content.map(item => {
        if (!isObject(item)) return item

        if (item.type === 'text') {
          return { type: 'text', text: getString(item, 'text') || '' }
        }
        if (item.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: getString(item, 'id') || getString(item, 'tool_use_id') || '',
            name: getString(item, 'name') || '',
            input: getObject(item, 'input') || {},
          }
        }
        if (item.type === 'tool_result') {
          return {
            type: 'tool_result',
            tool_use_id: getString(item, 'tool_use_id') || '',
            content: item.content,
          }
        }
        return item
      })
      return { parts: processed }
    }

    return content
  }
}

class CodexAdapter implements ProviderAdapter {
  name = 'codex'

  transform(rawMessage: Record<string, unknown>): BaseSessionMessage[] {
    return [
      {
        id: getString(rawMessage, 'id') || Math.random().toString(36).substr(2, 9),
        timestamp: getString(rawMessage, 'timestamp') || new Date().toISOString(),
        type: this.inferType(rawMessage),
        content: rawMessage,
        metadata: {
          messageID: rawMessage.messageID,
          sessionID: rawMessage.sessionID,
        },
      },
    ]
  }

  private inferType(message: Record<string, unknown>): BaseSessionMessage['type'] {
    // Map Codex message types to standard types
    const payload = getObject(message, 'payload')
    const payloadType = payload ? getString(payload, 'type') : getString(message, 'type')

    if (payloadType === 'user_message') return 'user_input'
    if (payloadType === 'agent_message' || payloadType === 'agent_reasoning')
      return 'assistant_response'
    if (payloadType === 'function_call') return 'tool_use'
    if (payloadType === 'function_call_output') return 'tool_result'
    if (payloadType === 'turn_aborted') return 'interruption'

    return 'meta'
  }
}

class OpenCodeAdapter implements ProviderAdapter {
  name = 'opencode'

  transform(rawMessage: RawMessage): BaseSessionMessage[] {
    const messageType = this.getMessageType(rawMessage)
    const processedContent = this.processContent(rawMessage)

    // Handle direct tool_use messages (from new format)
    if (messageType === 'tool_use') {
      // Extract the tool use from content array
      const content =
        processedContent &&
        typeof processedContent === 'object' &&
        'parts' in processedContent &&
        Array.isArray(processedContent.parts)
          ? processedContent.parts[0]
          : processedContent
      const toolUseId =
        content && typeof content === 'object' && 'id' in content
          ? (content.id as string)
          : `tool-${rawMessage.timestamp}`

      return [
        {
          id: `${rawMessage.sessionId}-${rawMessage.timestamp}-tool-${toolUseId}`,
          timestamp: rawMessage.timestamp,
          type: 'tool_use',
          content: content,
          metadata: {
            sessionId: rawMessage.sessionId,
            toolUseId: toolUseId,
          },
        },
      ]
    }

    // Handle direct tool_result messages (from new format)
    if (messageType === 'tool_result') {
      // Extract the tool result from content array
      const content =
        processedContent &&
        typeof processedContent === 'object' &&
        'parts' in processedContent &&
        Array.isArray(processedContent.parts)
          ? processedContent.parts[0]
          : processedContent
      const toolUseId =
        content && typeof content === 'object' && 'tool_use_id' in content
          ? (content.tool_use_id as string)
          : 'unknown'

      return [
        {
          id: `${rawMessage.sessionId}-${rawMessage.timestamp}-result-${toolUseId}`,
          timestamp: rawMessage.timestamp,
          type: 'tool_result',
          content: content,
          metadata: {
            sessionId: rawMessage.sessionId,
          },
          linkedTo: toolUseId,
        },
      ]
    }

    // For assistant messages with tool uses, split into separate messages (legacy format)
    if (
      messageType === 'assistant_response' &&
      processedContent &&
      typeof processedContent === 'object' &&
      'parts' in processedContent &&
      Array.isArray(processedContent.parts)
    ) {
      const messages: BaseSessionMessage[] = []

      // Create assistant response message for text content
      const textParts = processedContent.parts.filter((p: ContentPart) => p.type === 'text')
      if (textParts.length > 0) {
        messages.push({
          id: `${rawMessage.sessionId}-${rawMessage.timestamp}`,
          timestamp: rawMessage.timestamp,
          type: 'assistant_response',
          content: { text: textParts.map((p: ContentPart) => p.text || '').join('\n') },
          metadata: {
            sessionId: rawMessage.sessionId,
          },
        })
      }

      // Create separate tool use messages
      const toolUses = processedContent.parts.filter((p: ContentPart) => p.type === 'tool_use')
      for (const toolUse of toolUses) {
        messages.push({
          id: `${rawMessage.sessionId}-${rawMessage.timestamp}-tool-${toolUse.id || ''}`,
          timestamp: rawMessage.timestamp,
          type: 'tool_use',
          content: toolUse,
          metadata: {
            sessionId: rawMessage.sessionId,
            toolUseId: toolUse.id,
          },
        })
      }

      return messages
    }

    // Default single message
    return [
      {
        id: `${rawMessage.sessionId}-${rawMessage.timestamp}`,
        timestamp: rawMessage.timestamp,
        type: messageType,
        content: processedContent,
        metadata: {
          sessionId: rawMessage.sessionId,
        },
      },
    ]
  }

  private getMessageType(message: RawMessage): BaseSessionMessage['type'] {
    // Handle direct type specification from new format
    const msgType = getString(message, 'type')

    if (msgType === 'tool_use') {
      return 'tool_use'
    }

    if (msgType === 'tool_result') {
      return 'tool_result'
    }

    if (msgType === 'user') {
      // Check if this is a tool result vs real user input
      const messageObj = getObject(message, 'message')
      const content = messageObj ? messageObj.content : undefined
      if (
        Array.isArray(content) &&
        content.some(item => isObject(item) && item.type === 'tool_result')
      ) {
        return 'tool_result'
      }
      return 'user_input'
    }

    if (msgType === 'assistant') {
      return 'assistant_response'
    }

    return 'meta'
  }

  private processContent(
    message: RawMessage
  ): PartsContent | { text: string } | null | Record<string, unknown> {
    const messageObj = getObject(message, 'message')
    const content = messageObj ? messageObj.content : undefined

    if (typeof content === 'string') {
      return { text: content }
    }

    if (Array.isArray(content)) {
      const processed = content.map(item => {
        if (!isObject(item)) return item

        if (item.type === 'text') {
          return { type: 'text', text: getString(item, 'text') || '' }
        }
        if (item.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: getString(item, 'id') || getString(item, 'tool_use_id') || '',
            name: getString(item, 'name') || '',
            input: getObject(item, 'input') || {},
          }
        }
        if (item.type === 'tool_result') {
          return {
            type: 'tool_result',
            tool_use_id: getString(item, 'tool_use_id') || '',
            content: item.content,
          }
        }
        return item
      })
      return { parts: processed }
    }

    // Type-safe fallback for unknown content
    if (content !== null && typeof content === 'object' && !Array.isArray(content)) {
      return content as Record<string, unknown>
    }

    return null
  }
}

class CopilotAdapter implements ProviderAdapter {
  name = 'github-copilot'

  transform(rawMessage: RawMessage): BaseSessionMessage[] {
    const messageType = this.getMessageType(rawMessage)
    const processedContent = this.processContent(rawMessage)

    // Handle tool call requested (tool use only, no result yet)
    if (rawMessage.type === 'tool_call_requested') {
      return [
        {
          id: rawMessage.callId || `tool-${rawMessage.timestamp}`,
          timestamp: rawMessage.timestamp,
          type: 'tool_use',
          content: {
            type: 'tool_use',
            id: rawMessage.callId,
            name: rawMessage.name,
            input: rawMessage.arguments || {},
            parts: [
              {
                type: 'tool_use',
                id: rawMessage.callId,
                name: rawMessage.name,
                input: rawMessage.arguments || {},
              },
            ],
          },
          metadata: {
            toolTitle: rawMessage.toolTitle,
            intentionSummary: rawMessage.intentionSummary,
          },
        },
      ]
    }

    // Handle tool call completed - create BOTH tool_use and tool_result messages
    // from the single timeline entry so they can be grouped for side-by-side display
    if (rawMessage.type === 'tool_call_completed') {
      const toolUseId = rawMessage.callId || `tool-${rawMessage.timestamp}`

      return [
        // Tool use message (left side of group)
        {
          id: toolUseId,
          timestamp: rawMessage.timestamp,
          type: 'tool_use',
          content: {
            type: 'tool_use',
            id: rawMessage.callId,
            name: rawMessage.name,
            input: rawMessage.arguments || {},
            parts: [
              {
                type: 'tool_use',
                id: rawMessage.callId,
                name: rawMessage.name,
                input: rawMessage.arguments || {},
              },
            ],
          },
          metadata: {
            toolTitle: rawMessage.toolTitle,
            intentionSummary: rawMessage.intentionSummary,
          },
        },
        // Tool result message (right side of group)
        {
          id: `result-${toolUseId}`,
          timestamp: rawMessage.timestamp,
          type: 'tool_result',
          content: {
            type: 'tool_result',
            tool_use_id: rawMessage.callId,
            content:
              rawMessage.result &&
              typeof rawMessage.result === 'object' &&
              'log' in rawMessage.result
                ? (rawMessage.result.log as string)
                : rawMessage.result,
            parts: [
              {
                type: 'tool_result',
                tool_use_id: rawMessage.callId,
                content:
                  rawMessage.result &&
                  typeof rawMessage.result === 'object' &&
                  'log' in rawMessage.result
                    ? (rawMessage.result.log as string)
                    : rawMessage.result,
              },
            ],
          },
          metadata: {
            toolName: rawMessage.name,
            resultType:
              rawMessage.result &&
              typeof rawMessage.result === 'object' &&
              'type' in rawMessage.result
                ? (rawMessage.result.type as string)
                : undefined,
          },
          linkedTo: toolUseId,
        },
      ]
    }

    // Handle regular messages (user, copilot, info)
    return [
      {
        id: rawMessage.id || `msg-${rawMessage.timestamp}`,
        timestamp: rawMessage.timestamp,
        type: messageType,
        content: processedContent,
        metadata: {
          entryType: rawMessage.type,
        },
      },
    ]
  }

  private getMessageType(message: RawMessage): BaseSessionMessage['type'] {
    // Map timeline types to message types
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

  private processContent(message: RawMessage): PartsContent | { text: string } {
    // For timeline entries, text is directly on the object
    const text = getString(message, 'text')
    if (text) {
      return {
        text,
        parts: [
          {
            type: 'text',
            text,
          },
        ],
      }
    }

    const msgType = getString(message, 'type')

    // For tool calls, create appropriate structure
    if (msgType === 'tool_call_requested') {
      return {
        parts: [
          {
            type: 'tool_use',
            id: getString(message, 'callId'),
            name: getString(message, 'name'),
            input: getObject(message, 'arguments') || {},
          },
        ],
      }
    }

    if (msgType === 'tool_call_completed') {
      const result = getObject(message, 'result')
      const resultContent = result ? getString(result, 'log') || result : message.result

      return {
        parts: [
          {
            type: 'tool_result',
            tool_use_id: getString(message, 'callId'),
            content: resultContent,
          },
        ],
      }
    }

    return { text: '' }
  }
}

class GeminiAdapter implements ProviderAdapter {
  name = 'gemini-code'

  transform(rawMessage: RawMessage): BaseSessionMessage[] {
    // In the new format, message content is at rawMessage.message
    // and Gemini metadata is at the top level (gemini_thoughts, gemini_tokens, gemini_model)
    const messageObj = getObject(rawMessage, 'message')
    const messageType = getString(rawMessage, 'type') // 'user' or 'gemini' or 'tool_use' or 'tool_result'

    if (!messageObj) {
      return []
    }

    const messageContent = messageObj.content

    // Handle tool_use messages from the new format
    if (messageType === 'assistant' && Array.isArray(messageContent)) {
      // Check if this is a tool use message (content has tool_use type)
      const toolUse = messageContent.find(
        (part: unknown) => isObject(part) && part.type === 'tool_use'
      )
      if (toolUse && isObject(toolUse)) {
        return [
          {
            id: getString(rawMessage, 'uuid') || '',
            timestamp: rawMessage.timestamp,
            type: 'tool_use',
            content: toolUse,
            metadata: {
              sessionId: rawMessage.sessionId,
              toolUseId: getString(toolUse, 'id'),
            },
          },
        ]
      }
    }

    // Handle tool_result messages from the new format
    if (
      messageType === 'tool_result' ||
      (messageType === 'user' && Array.isArray(messageContent))
    ) {
      const toolResult = Array.isArray(messageContent)
        ? messageContent.find((part: unknown) => isObject(part) && part.type === 'tool_result')
        : null

      if (toolResult && isObject(toolResult)) {
        return [
          {
            id: getString(rawMessage, 'uuid') || '',
            timestamp: rawMessage.timestamp,
            type: 'tool_result',
            content: toolResult,
            metadata: {
              sessionId: rawMessage.sessionId,
            },
            linkedTo: getString(toolResult, 'tool_use_id'),
          },
        ]
      }
    }

    // Get message type from the rawMessage.type field
    const baseType = this.getMessageType(messageType)
    const processedContent = this.processContent(messageContent)

    // Default single message with Gemini-specific metadata
    return [
      {
        id: getString(rawMessage, 'uuid') || '',
        timestamp: rawMessage.timestamp,
        type: baseType,
        content: processedContent,
        metadata: {
          sessionId: rawMessage.sessionId,
          model: getString(rawMessage, 'gemini_model'),
          thoughts: rawMessage.gemini_thoughts,
          tokens: rawMessage.gemini_tokens,
          cwd: getString(rawMessage, 'cwd'),
        },
      },
    ]
  }

  private getMessageType(messageType: string | undefined): BaseSessionMessage['type'] {
    if (messageType === 'user') {
      return 'user_input'
    }

    if (messageType === 'gemini' || messageType === 'assistant') {
      return 'assistant_response'
    }

    return 'meta'
  }

  private processContent(content: unknown) {
    // For text content (string), return simple structure
    if (typeof content === 'string') {
      return {
        text: content,
        parts: [
          {
            type: 'text',
            text: content,
          },
        ],
      }
    }

    // For array content, process parts
    if (Array.isArray(content)) {
      const textParts = content
        .filter((part: unknown) => isObject(part) && part.type === 'text')
        .map((part: unknown) => (isObject(part) ? getString(part, 'text') || '' : ''))

      return {
        text: textParts.join('\n'),
        parts: content,
      }
    }

    return { text: '' }
  }
}

class GenericJSONLParser implements SessionParser {
  name = 'generic-jsonl'
  private adapters = new Map<string, ProviderAdapter>([
    ['claude', new ClaudeAdapter()],
    ['claude-code', new ClaudeAdapter()],
    ['github-copilot', new CopilotAdapter()],
    ['copilot', new CopilotAdapter()],
    ['codex', new CodexAdapter()],
    ['opencode', new OpenCodeAdapter()],
    ['gemini-code', new GeminiAdapter()],
    ['gemini', new GeminiAdapter()],
  ])

  canParse(content: string): boolean {
    const lines = content.split('\n').filter(line => line.trim())
    if (lines.length === 0) return false

    try {
      JSON.parse(lines[0])
      return true
    } catch {
      return false
    }
  }

  parse(content: string, provider: string): BaseSessionMessage[] {
    const lines = content.split('\n').filter(line => line.trim())
    const messages: BaseSessionMessage[] = []

    // Get the adapter for the known provider
    const adapter = this.getAdapter(provider)
    if (!adapter) {
      throw new Error(`No adapter found for provider: ${provider}`)
    }

    for (const line of lines) {
      try {
        const rawMessage = JSON.parse(line)
        const transformedMessages = adapter.transform(rawMessage)
        messages.push(...transformedMessages)
      } catch (error) {
        console.warn('Failed to parse line:', line, error)
      }
    }

    return messages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }

  private getAdapter(provider: string): ProviderAdapter | null {
    const normalized = provider.toLowerCase().trim()
    return this.adapters.get(normalized) || null
  }

  private inferType(message: RawMessage): BaseSessionMessage['type'] {
    if (message.type === 'user' || message.role === 'user') {
      // Check for command or interruption patterns
      const content = message.content || message.message?.content || message.text || ''

      // Parse parts structure if it exists
      const parsedContent = this.parsePartsContent(content)
      if (parsedContent) {
        // Check for interruption in parts structure - ONLY if it's specifically about interruption
        const hasInterruptionText = parsedContent.parts?.some(
          part =>
            part.type === 'text' &&
            (part.text?.includes('[Request interrupted by user]') ||
              part.text?.includes('Request interrupted by user'))
        )
        const hasOnlyInterruptionText = parsedContent.parts?.every(
          part =>
            part.type === 'text' &&
            (part.text?.includes('[Request interrupted by user]') ||
              part.text?.includes('Request interrupted by user') ||
              !part.text?.trim())
        )

        if (hasInterruptionText && hasOnlyInterruptionText) {
          return 'interruption'
        }

        // Check for commands in parts structure - ONLY if it's specifically a command
        const hasCommandText = parsedContent.parts?.some(
          part =>
            part.type === 'text' &&
            (part.text?.startsWith('/') || part.text?.includes('<command-name>'))
        )
        const hasOnlyCommandText = parsedContent.parts?.every(
          part =>
            part.type === 'text' &&
            (part.text?.startsWith('/') ||
              part.text?.includes('<command-name>') ||
              !part.text?.trim())
        )

        if (hasCommandText && hasOnlyCommandText) {
          return 'command'
        }

        // Everything else with parts structure is user_input (including images)
        return 'user_input'
      }

      // Fallback to string-based checks
      if (typeof content === 'string') {
        if (content.startsWith('/') || content.includes('<command-name>')) {
          return 'command'
        }

        if (
          content.includes('Request interrupted by user') ||
          content.includes('[Request interrupted by user]')
        ) {
          return 'interruption'
        }
      }

      // Check if this is a simple interruption message (array with only interruption text)
      if (Array.isArray(content)) {
        const hasInterruptionText = content.some(
          (item: unknown) =>
            typeof item === 'object' &&
            item !== null &&
            'type' in item &&
            item.type === 'text' &&
            'text' in item &&
            typeof item.text === 'string' &&
            (item.text.includes('[Request interrupted by user]') ||
              item.text.includes('Request interrupted by user'))
        )
        const hasOnlyInterruptionText = content.every(
          (item: unknown) =>
            typeof item === 'object' &&
            item !== null &&
            'type' in item &&
            item.type === 'text' &&
            (!('text' in item) ||
              typeof item.text !== 'string' ||
              item.text.includes('[Request interrupted by user]') ||
              item.text.includes('Request interrupted by user') ||
              !item.text.trim())
        )

        if (hasInterruptionText && hasOnlyInterruptionText) {
          return 'interruption'
        }
      }

      return 'user_input'
    }
    if (message.type === 'assistant' || message.role === 'assistant') return 'assistant_response'
    if (message.type === 'tool_use') return 'tool_use'
    if (message.type === 'tool_result') return 'tool_result'
    if (message.type === 'command') return 'command'
    if (message.type === 'command_output') return 'command_output'
    if (message.type === 'interruption') return 'interruption'
    return 'meta'
  }

  private parsePartsContent(content: RawMessageContent): PartsContent | null {
    // Try to parse the content as a parts structure
    try {
      if (typeof content === 'string') {
        const parsed = JSON.parse(content)
        if (parsed?.parts && Array.isArray(parsed.parts)) {
          return parsed
        }
      } else if (
        typeof content === 'object' &&
        content !== null &&
        'parts' in content &&
        Array.isArray((content as { parts: unknown }).parts)
      ) {
        return content as PartsContent
      }
    } catch (_error) {
      // Not valid JSON or not a parts structure
    }
    return null
  }
}

class SessionParserRegistry {
  private parsers: SessionParser[] = [new GenericJSONLParser()]

  findParser(content: string): SessionParser | null {
    return this.parsers.find(parser => parser.canParse(content)) || null
  }

  parseSession(content: string, provider: string): BaseSessionMessage[] {
    const parser = this.findParser(content)
    if (!parser) {
      throw new Error('No suitable parser found for content')
    }
    return parser.parse(content, provider)
  }

  registerParser(parser: SessionParser): void {
    this.parsers.unshift(parser)
  }
}

export const sessionRegistry = new SessionParserRegistry()

// Helper functions for conversation parsing
function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    const textParts = content
      .filter(
        (part): part is { type: string; text: string } =>
          typeof part === 'object' && part !== null && 'type' in part && part.type === 'text'
      )
      .map(part => part.text)
      .join('\n')
    return textParts || ''
  }

  return ''
}

function extractToolUses(
  content: unknown
): Array<{ name: string; input: Record<string, unknown>; result?: unknown }> {
  if (!Array.isArray(content)) return []

  return content
    .filter(
      (part): part is { type: string; name: string; input: Record<string, unknown> } =>
        typeof part === 'object' && part !== null && 'type' in part && part.type === 'tool_use'
    )
    .map(part => ({
      name: part.name,
      input: part.input,
      // Tool results come in separate messages, would need to match by ID
      // For now, just show the tool use
    }))
}

// Conversation-based parser for better Input/Output display
export function parseConversation(content: string): ConversationTurn[] {
  const lines = content.split('\n').filter(line => line.trim())
  const rawMessages: ClaudeMessage[] = []

  // Parse all messages first
  for (const line of lines) {
    try {
      const message = JSON.parse(line)
      // Only include actual conversation messages, skip meta/system
      if (message.type === 'user' || message.type === 'assistant') {
        rawMessages.push(message)
      }
    } catch (_error) {
      console.warn('Failed to parse line:', line)
    }
  }

  // Group into conversation turns
  const turns: ConversationTurn[] = []
  let currentTurn: Partial<ConversationTurn> | null = null

  for (const message of rawMessages) {
    if (message.type === 'user') {
      // Skip messages without content (e.g., file-history-snapshot)
      if (!message.message?.content) {
        continue
      }

      // Start new turn with user input
      if (currentTurn && (currentTurn.userInput || currentTurn.assistantResponse)) {
        turns.push(currentTurn as ConversationTurn)
      }

      currentTurn = {
        id: message.uuid,
        timestamp: message.timestamp,
        userInput: {
          content:
            typeof message.message.content === 'string'
              ? message.message.content
              : JSON.stringify(message.message.content),
          timestamp: message.timestamp,
        },
      }
    } else if (message.type === 'assistant' && currentTurn) {
      // Skip messages without content
      if (!message.message?.content) {
        continue
      }

      // Add assistant response to current turn
      const toolUses = extractToolUses(message.message.content)

      currentTurn.assistantResponse = {
        content: extractTextContent(message.message.content),
        timestamp: message.timestamp,
        toolUses: toolUses.length > 0 ? toolUses : undefined,
      }
    }
  }

  // Add final turn if exists
  if (currentTurn && (currentTurn.userInput || currentTurn.assistantResponse)) {
    turns.push(currentTurn as ConversationTurn)
  }

  return turns
}

export {
  ClaudeAdapter,
  CopilotAdapter,
  CodexAdapter,
  OpenCodeAdapter,
  GeminiAdapter,
  GenericJSONLParser,
}
