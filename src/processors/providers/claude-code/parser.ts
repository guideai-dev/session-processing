import type { ParsedSession, ParsedMessage } from '../../base/types.js'

export interface ClaudeMessage {
  uuid: string
  timestamp: string
  type: 'user' | 'assistant' | 'summary'
  message: {
    role: string
    content: string | Array<{ type: string; text?: string; tool_use_id?: string; content?: any }>
  }
  content?: string | Array<{ type: string; text?: string; tool_use_id?: string; content?: any }>
  parentUuid?: string
  isMeta?: boolean
  sessionId: string
  userType?: string
  requestId?: string
  subtype?: string
  level?: string
}

export interface ToolUseContent {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, any>
}

export interface ToolResultContent {
  type: 'tool_result'
  tool_use_id: string
  content: any
}

export interface TextContent {
  type: 'text'
  text: string
}

export class ClaudeCodeParser {
  parseSession(jsonlContent: string): ParsedSession {
    const lines = jsonlContent.split('\n').filter(line => line.trim())
    const messages: ParsedMessage[] = []
    let sessionId = ''
    let startTime: Date | null = null
    let endTime: Date | null = null

    for (let i = 0; i < lines.length; i++) {
      try {
        const rawMessage: ClaudeMessage = JSON.parse(lines[i])

        // Skip all lines that don't have a timestamp
        // This handles summary lines, file-history-snapshot, and any other metadata
        if (!rawMessage.timestamp) {
          continue
        }

        // Set session ID from first message
        if (!sessionId && rawMessage.sessionId) {
          sessionId = rawMessage.sessionId
        }

        const timestamp = new Date(rawMessage.timestamp)

        // Validate timestamp is valid
        if (isNaN(timestamp.getTime())) {
          console.warn(`Skipping line ${i + 1}: invalid timestamp ${rawMessage.timestamp}`)
          continue
        }

        // Track start and end times
        if (!startTime || timestamp < startTime) {
          startTime = timestamp
        }
        if (!endTime || timestamp > endTime) {
          endTime = timestamp
        }

        // Skip meta messages unless they contain important information
        if (rawMessage.isMeta) {
          continue
        }

        const parsedMessage = this.parseMessage(rawMessage)
        if (parsedMessage) {
          messages.push(parsedMessage)
        }
      } catch (error) {
        console.warn(`Failed to parse line ${i + 1}:`, error)
        continue
      }
    }

    if (!sessionId) {
      sessionId = `session_${Date.now()}`
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
      provider: 'claude-code',
      messages,
      startTime,
      endTime,
      duration,
      metadata: {
        messageCount: messages.length,
        lineCount: lines.length
      }
    }
  }

  private parseMessage(rawMessage: ClaudeMessage): ParsedMessage | null {
    const timestamp = new Date(rawMessage.timestamp)

    // Determine message type
    let messageType: ParsedMessage['type']
    if (rawMessage.type === 'user') {
      messageType = 'user'
    } else if (rawMessage.type === 'assistant') {
      messageType = 'assistant'
    } else {
      messageType = 'system'
    }

    // Parse content based on format
    let content: any
    let toolUses: ToolUseContent[] = []
    let toolResults: ToolResultContent[] = []

    // Handle different message formats
    const messageContent = rawMessage.message?.content ?? rawMessage.content

    if (typeof messageContent === 'string') {
      content = messageContent
    } else if (Array.isArray(messageContent)) {
      // Handle structured content with tool uses
      const textParts: string[] = []

      for (const part of messageContent) {
        if (part.type === 'text' && part.text) {
          textParts.push(part.text)
        } else if (part.type === 'tool_use') {
          toolUses.push(part as ToolUseContent)
        } else if (part.type === 'tool_result') {
          toolResults.push(part as ToolResultContent)
        }
      }

      content = {
        text: textParts.join('\n'),
        toolUses,
        toolResults,
        structured: messageContent
      }
    } else {
      content = messageContent
    }

    return {
      id: rawMessage.uuid,
      timestamp,
      type: messageType,
      content,
      metadata: {
        role: rawMessage.message?.role || messageType,
        parentUuid: rawMessage.parentUuid,
        requestId: rawMessage.requestId,
        userType: rawMessage.userType,
        hasToolUses: toolUses.length > 0,
        hasToolResults: toolResults.length > 0,
        toolCount: toolUses.length,
        resultCount: toolResults.length,
        subtype: rawMessage.subtype,
        level: rawMessage.level
      },
      parentId: rawMessage.parentUuid
    }
  }

  /**
   * Extract all tool uses from the session
   */
  extractToolUses(session: ParsedSession): ToolUseContent[] {
    const toolUses: ToolUseContent[] = []

    for (const message of session.messages) {
      if (message.content?.toolUses) {
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
      if (message.content?.toolResults) {
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
      if (current.type === 'assistant' && next.type === 'user' && !this.isInterruptionMessage(next)) {
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
    return content.includes('[Request interrupted by user for tool use]') ||
           content.includes('[Request interrupted by user]') ||
           content.includes('Request interrupted by user')
  }

  /**
   * Extract text content from a message regardless of its structure
   */
  private extractTextContent(message: ParsedMessage): string {
    if (typeof message.content === 'string') {
      return message.content
    }

    if (message.content?.text) {
      return message.content.text
    }

    if (Array.isArray(message.content?.structured)) {
      const textParts: string[] = []
      for (const part of message.content.structured) {
        if (part.type === 'text' && part.text) {
          textParts.push(part.text)
        }
      }
      return textParts.join(' ')
    }

    return ''
  }

  /**
   * Calculate response times between user inputs and assistant responses
   */
  calculateResponseTimes(session: ParsedSession): Array<{ userMessage: ParsedMessage; assistantMessage: ParsedMessage; responseTime: number }> {
    const responseTimes: Array<{ userMessage: ParsedMessage; assistantMessage: ParsedMessage; responseTime: number }> = []

    for (let i = 0; i < session.messages.length - 1; i++) {
      const current = session.messages[i]
      const next = session.messages[i + 1]

      if (current.type === 'user' && next.type === 'assistant') {
        const responseTime = next.timestamp.getTime() - current.timestamp.getTime()
        responseTimes.push({
          userMessage: current,
          assistantMessage: next,
          responseTime
        })
      }
    }

    return responseTimes
  }
}
