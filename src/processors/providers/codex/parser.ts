import type {
  ContentBlock,
  StructuredMessageContent,
  TextContent,
  ToolResultContent,
  ToolUseContent,
} from '@guideai-dev/types'
import { isStructuredMessageContent, isTextContent } from '@guideai-dev/types'
import { getString, isObject } from '../../../utils/safe-access.js'
import type { ParsedMessage, ParsedSession } from '../../base/types.js'

// Codex message types from JSONL format
export interface CodexEntry {
  timestamp: string
  type: 'session_meta' | 'response_item' | 'event_msg' | 'turn_context'
  payload: unknown
}

export interface CodexSessionMeta {
  id: string
  timestamp: string
  cwd: string
  originator: string
  cli_version: string
  source: string
  git?: {
    commit_hash: string
    branch: string
    repository_url: string
  }
}

export interface CodexResponseItem {
  type: 'message' | 'function_call' | 'function_call_output' | 'reasoning'
  role?: 'user' | 'assistant'
  content?: ContentBlock[]
  // Function call fields
  name?: string
  arguments?: string
  call_id?: string
  // Function output fields
  output?: string
}

export class CodexParser {
  parseSession(jsonlContent: string, provider: string): ParsedSession {
    const lines = jsonlContent.split('\n').filter(line => line.trim())
    const messages: ParsedMessage[] = []
    let sessionId = ''
    let startTime: Date | null = null
    let endTime: Date | null = null

    for (let i = 0; i < lines.length; i++) {
      try {
        const entry: CodexEntry = JSON.parse(lines[i])

        // Skip entries without timestamps
        if (!entry.timestamp) {
          continue
        }

        const timestamp = new Date(entry.timestamp)

        // Validate timestamp is valid
        if (Number.isNaN(timestamp.getTime())) {
          continue
        }

        // Track start and end times
        if (!startTime || timestamp < startTime) {
          startTime = timestamp
        }
        if (!endTime || timestamp > endTime) {
          endTime = timestamp
        }

        // Extract session ID from session_meta
        if (entry.type === 'session_meta' && isObject(entry.payload)) {
          const id = getString(entry.payload, 'id')
          if (id) sessionId = id
        }

        // Parse response_item entries
        if (entry.type === 'response_item') {
          const parsedMessage = this.parseResponseItem(entry, timestamp, i)
          if (parsedMessage) {
            messages.push(parsedMessage)
          }
        }
      } catch (_error) {}
    }

    if (!sessionId) {
      sessionId = `codex_${Date.now()}`
    }
    if (!startTime) {
      startTime = new Date()
    }
    if (!endTime) {
      endTime = startTime
    }

    const duration = endTime.getTime() - startTime.getTime()

    return {
      sessionId,
      provider: 'codex',
      messages,
      startTime,
      endTime,
      duration,
      metadata: {
        messageCount: messages.length,
        lineCount: lines.length,
      },
    }
  }

  private isCodexResponseItem(payload: unknown): payload is CodexResponseItem {
    if (!isObject(payload)) return false
    if (!('type' in payload) || typeof payload.type !== 'string') return false
    const validTypes = ['message', 'function_call', 'function_call_output', 'reasoning']
    return validTypes.includes(payload.type)
  }

  private parseResponseItem(
    entry: CodexEntry,
    timestamp: Date,
    index: number
  ): ParsedMessage | null {
    if (!this.isCodexResponseItem(entry.payload)) return null

    const payload = entry.payload

    // Handle different payload types
    switch (payload.type) {
      case 'message':
        return this.parseMessage(payload, timestamp, index)
      case 'function_call':
        return this.parseFunctionCall(payload, timestamp, index)
      case 'function_call_output':
        return this.parseFunctionCallOutput(payload, timestamp, index)
      case 'reasoning':
        // Skip reasoning blocks as they're not user-facing
        return null
      default:
        return null
    }
  }

  private parseMessage(
    payload: CodexResponseItem,
    timestamp: Date,
    index: number
  ): ParsedMessage | null {
    if (!payload.role) return null

    let messageType: ParsedMessage['type']
    if (payload.role === 'user') {
      messageType = 'user'
    } else if (payload.role === 'assistant') {
      messageType = 'assistant'
    } else {
      messageType = 'system'
    }

    // Extract text from content array
    let text = ''
    if (Array.isArray(payload.content)) {
      const textParts: string[] = []
      for (const part of payload.content) {
        if (isObject(part) && part.type === 'input_text') {
          const partText = getString(part, 'text')
          if (partText) textParts.push(partText)
        }
      }
      text = textParts.join('\n')
    }

    return {
      id: `msg_${timestamp.getTime()}_${index}`,
      timestamp,
      type: messageType,
      content: {
        text,
        structured: payload.content || [],
        toolUses: [],
        toolResults: [],
      },
      metadata: {
        role: payload.role,
      },
    }
  }

  private parseFunctionCall(
    payload: CodexResponseItem,
    timestamp: Date,
    _index: number
  ): ParsedMessage | null {
    if (!payload.name || !payload.call_id) return null

    // Parse arguments from JSON string
    let parsedArgs = {}
    if (payload.arguments) {
      try {
        parsedArgs = JSON.parse(payload.arguments)
      } catch {
        parsedArgs = {}
      }
    }

    const toolUse: ToolUseContent = {
      type: 'tool_use',
      id: payload.call_id,
      name: payload.name,
      input: parsedArgs,
    }

    return {
      id: `tool_${payload.call_id}`,
      timestamp,
      type: 'assistant',
      content: {
        text: `Using ${payload.name}`,
        structured: [toolUse],
        toolUses: [toolUse],
        toolResults: [],
      },
      metadata: {
        toolName: payload.name,
        hasToolUses: true,
        toolCount: 1,
        resultCount: 0,
      },
    }
  }

  private parseFunctionCallOutput(
    payload: CodexResponseItem,
    timestamp: Date,
    _index: number
  ): ParsedMessage | null {
    if (!payload.call_id) return null

    // Parse output - it might be JSON string or already parsed
    let outputContent = payload.output
    if (typeof payload.output === 'string') {
      try {
        outputContent = JSON.parse(payload.output)
      } catch {
        outputContent = payload.output
      }
    }

    const toolResult: ToolResultContent = {
      type: 'tool_result',
      tool_use_id: payload.call_id,
      content: outputContent,
    }

    return {
      id: `tool_result_${payload.call_id}`,
      timestamp,
      type: 'assistant',
      content: {
        text: undefined,
        structured: [toolResult],
        toolUses: [],
        toolResults: [toolResult],
      },
      metadata: {
        hasToolResults: true,
        toolCount: 0,
        resultCount: 1,
      },
    }
  }

  /**
   * Extract all tool uses from the session
   */
  extractToolUses(session: ParsedSession): ToolUseContent[] {
    const toolUses: ToolUseContent[] = []

    for (const message of session.messages) {
      if (isStructuredMessageContent(message.content)) {
        toolUses.push(...message.content.toolUses)
      }
    }

    return toolUses
  }

  /**
   * Extract all tool results from the session
   */
  extractToolResults(session: ParsedSession): ToolResultContent[] {
    const toolResults: ToolResultContent[] = []

    for (const message of session.messages) {
      if (isStructuredMessageContent(message.content)) {
        toolResults.push(...message.content.toolResults)
      }
    }

    return toolResults
  }

  /**
   * Find messages that indicate real interruptions (not just quick follow-ups)
   */
  findInterruptions(session: ParsedSession): ParsedMessage[] {
    const interruptions: ParsedMessage[] = []

    for (const message of session.messages) {
      if (message.type === 'user') {
        // Check for the specific interruption message pattern
        if (this.isInterruptionMessage(message)) {
          interruptions.push(message)
        }
      }
    }

    return interruptions
  }

  /**
   * Find messages where the agent stopped/asked for input/confirmation
   */
  findAgentStops(session: ParsedSession): ParsedMessage[] {
    const stops: ParsedMessage[] = []

    for (let i = 0; i < session.messages.length - 1; i++) {
      const current = session.messages[i]
      const next = session.messages[i + 1]

      // Look for assistant messages followed by user messages (not interruptions)
      if (
        current.type === 'assistant' &&
        next.type === 'user' &&
        !this.isInterruptionMessage(next)
      ) {
        // This indicates the agent stopped and waited for user input
        stops.push(current)
      }
    }

    return stops
  }

  /**
   * Check if a message is an interruption message
   */
  private isInterruptionMessage(message: ParsedMessage): boolean {
    const content = this.extractTextContent(message)
    return (
      content.includes('[Request interrupted by user for tool use]') ||
      content.includes('[Request interrupted by user]') ||
      content.includes('Request interrupted by user')
    )
  }

  /**
   * Extract text content from a message regardless of its structure
   */
  private extractTextContent(message: ParsedMessage): string {
    if (typeof message.content === 'string') {
      return message.content
    }

    if (isStructuredMessageContent(message.content)) {
      const textParts: string[] = []

      if (message.content.text) {
        textParts.push(message.content.text)
      }

      if (Array.isArray(message.content.structured)) {
        for (const part of message.content.structured) {
          if (isTextContent(part)) {
            textParts.push(part.text)
          }
        }
      }

      return textParts.join(' ')
    }

    return ''
  }

  /**
   * Calculate response times between user inputs and assistant responses
   */
  calculateResponseTimes(
    session: ParsedSession
  ): Array<{ userMessage: ParsedMessage; assistantMessage: ParsedMessage; responseTime: number }> {
    const responseTimes: Array<{
      userMessage: ParsedMessage
      assistantMessage: ParsedMessage
      responseTime: number
    }> = []

    for (let i = 0; i < session.messages.length - 1; i++) {
      const current = session.messages[i]
      const next = session.messages[i + 1]

      if (current.type === 'user' && next.type === 'assistant') {
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
}
