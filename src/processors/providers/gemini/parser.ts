import type { ParsedSession, ParsedMessage } from '../../base/types.js'

export interface GeminiSession {
  sessionId: string
  projectHash: string
  startTime: string
  lastUpdated: string
  messages: GeminiMessage[]
}

export interface ToolCall {
  name: string
  args?: Record<string, any>
  result?: any
  [key: string]: any // Allow additional Gemini-specific tool fields
}

export interface GeminiMessage {
  id: string
  timestamp: string
  type: 'user' | 'gemini'
  content: string
  thoughts?: Thought[]
  tokens?: TokenUsage
  model?: string
  tools?: ToolCall[] // Tool calls made in this message
  [key: string]: any // Allow additional fields for forward compatibility
}

export interface Thought {
  subject: string
  description: string
  timestamp: string
}

export interface TokenUsage {
  input: number
  output: number
  cached: number
  thoughts: number
  tool: number
  total: number
}

interface JSONLLine {
  uuid: string
  sessionId: string
  timestamp: string
  provider?: string
  projectHash?: string
  cwd?: string
  gemini_raw?: GeminiMessage // New format with full Gemini message
}

export class GeminiParser {
  parseSession(jsonContent: string): ParsedSession {
    // Check if content is JSONL (newline-separated) or single JSON object
    const isJSONL = jsonContent.includes('\n')

    if (isJSONL) {
      return this.parseJSONL(jsonContent)
    } else {
      return this.parseJSON(jsonContent)
    }
  }

  /**
   * Parse JSONL format (one message per line with gemini_raw field)
   */
  private parseJSONL(jsonlContent: string): ParsedSession {
    const lines = jsonlContent.trim().split('\n').filter(line => line.trim())

    if (lines.length === 0) {
      throw new Error('Empty JSONL content')
    }

    const messages: ParsedMessage[] = []
    let sessionId: string | null = null
    let projectHash: string | null = null
    let startTime: Date | null = null
    let endTime: Date | null = null

    for (const line of lines) {
      try {
        const jsonlLine: JSONLLine = JSON.parse(line)

        // Extract session metadata from first line
        if (!sessionId) {
          sessionId = jsonlLine.sessionId
        }
        if (!projectHash && jsonlLine.projectHash) {
          projectHash = jsonlLine.projectHash
        }

        // Parse the raw Gemini message
        if (jsonlLine.gemini_raw) {
          const rawMessage = jsonlLine.gemini_raw
          const timestamp = new Date(rawMessage.timestamp)

          // Validate timestamp
          if (isNaN(timestamp.getTime())) {
            console.warn(`Skipping message with invalid timestamp: ${rawMessage.timestamp}`)
            continue
          }

          // Track start and end times
          if (!startTime || timestamp < startTime) {
            startTime = timestamp
          }
          if (!endTime || timestamp > endTime) {
            endTime = timestamp
          }

          // Parse message - may return multiple messages if it contains tool calls
          const parsedMessages = this.parseMessage(rawMessage)
          if (parsedMessages) {
            // parseMessage now returns an array
            if (Array.isArray(parsedMessages)) {
              messages.push(...parsedMessages)
            } else {
              messages.push(parsedMessages)
            }
          }
        }
      } catch (error) {
        console.warn(`Skipping invalid JSONL line: ${error}`)
      }
    }

    if (!sessionId) {
      throw new Error('Could not determine session ID from JSONL')
    }

    if (!startTime || !endTime) {
      throw new Error('Could not determine session timestamps')
    }

    const duration = endTime.getTime() - startTime.getTime()

    return {
      sessionId,
      provider: 'gemini-code',
      messages,
      startTime,
      endTime,
      duration,
      metadata: {
        messageCount: messages.length,
        projectHash: projectHash || 'unknown',
        hasThoughts: messages.some(m => m.metadata?.thoughts !== undefined),
        hasCachedTokens: messages.some(m => m.metadata?.tokens?.cached > 0),
        hasTools: messages.some(m => m.metadata?.tools !== undefined)
      }
    }
  }

  /**
   * Parse original JSON format (for backward compatibility)
   */
  private parseJSON(jsonContent: string): ParsedSession {
    let rawSession: GeminiSession

    try {
      rawSession = JSON.parse(jsonContent)
    } catch (error) {
      throw new Error(`Failed to parse Gemini session JSON: ${error}`)
    }

    if (!rawSession.sessionId || !rawSession.messages) {
      throw new Error('Invalid Gemini session: missing sessionId or messages')
    }

    const messages: ParsedMessage[] = []
    let startTime: Date | null = null
    let endTime: Date | null = null

    for (const rawMessage of rawSession.messages) {
      const timestamp = new Date(rawMessage.timestamp)

      // Validate timestamp
      if (isNaN(timestamp.getTime())) {
        console.warn(`Skipping message with invalid timestamp: ${rawMessage.timestamp}`)
        continue
      }

      // Track start and end times
      if (!startTime || timestamp < startTime) {
        startTime = timestamp
      }
      if (!endTime || timestamp > endTime) {
        endTime = timestamp
      }

      const parsedMessages = this.parseMessage(rawMessage)
      if (parsedMessages) {
        // parseMessage now returns an array or single message
        if (Array.isArray(parsedMessages)) {
          messages.push(...parsedMessages)
        } else {
          messages.push(parsedMessages)
        }
      }
    }

    if (!startTime) {
      startTime = rawSession.startTime ? new Date(rawSession.startTime) : new Date()
    }
    if (!endTime) {
      endTime = rawSession.lastUpdated ? new Date(rawSession.lastUpdated) : startTime
    }

    const duration = endTime.getTime() - startTime.getTime()

    return {
      sessionId: rawSession.sessionId,
      provider: 'gemini-code',
      messages,
      startTime,
      endTime,
      duration,
      metadata: {
        messageCount: messages.length,
        projectHash: rawSession.projectHash,
        hasThoughts: messages.some(m => m.metadata?.thoughts !== undefined),
        hasCachedTokens: messages.some(m => m.metadata?.tokens?.cached > 0),
        hasTools: messages.some(m => m.metadata?.tools !== undefined)
      }
    }
  }

  private parseMessage(rawMessage: GeminiMessage): ParsedMessage[] | ParsedMessage | null {
    const timestamp = new Date(rawMessage.timestamp)

    // Check if this is a user message with [Function Response:]
    if (rawMessage.type === 'user' && rawMessage.content && rawMessage.content.startsWith('[Function Response:')) {
      // Extract tool name from [Function Response: tool_name]
      const toolNameMatch = rawMessage.content.match(/\[Function Response: ([^\]]+)\]/)
      const toolName = toolNameMatch ? toolNameMatch[1] : 'unknown'

      const toolUseId = `tool-${rawMessage.id}-${toolName}`

      // Return BOTH tool_use and tool_result messages
      return [
        // Tool use (implicit request)
        {
          id: toolUseId,
          timestamp,
          type: 'tool_use',
          content: {
            text: `Tool: ${toolName}`,
            structured: { type: 'tool_use', name: toolName, input: {} }
          },
          metadata: {
            role: 'tool_use',
            toolName,
          }
        },
        // Tool result (explicit response)
        {
          id: rawMessage.id,
          timestamp,
          type: 'tool_result',
          content: {
            text: rawMessage.content,
            structured: rawMessage
          },
          metadata: {
            role: 'tool_result',
            toolName,
            linkedTo: toolUseId
          }
        }
      ]
    }

    // Convert Gemini type to standard type
    let messageType: ParsedMessage['type']
    if (rawMessage.type === 'user') {
      messageType = 'user'
    } else if (rawMessage.type === 'gemini') {
      messageType = 'assistant'
    } else {
      messageType = 'system'
    }

    // Build content object
    const content = {
      text: rawMessage.content,
      structured: rawMessage
    }

    // Build metadata
    const metadata: any = {
      role: rawMessage.type,
      model: rawMessage.model,
      hasThoughts: rawMessage.thoughts !== undefined && rawMessage.thoughts.length > 0,
      hasTokens: rawMessage.tokens !== undefined,
      hasTools: rawMessage.tools !== undefined && rawMessage.tools.length > 0
    }

    // Add thoughts if present
    if (rawMessage.thoughts && rawMessage.thoughts.length > 0) {
      metadata.thoughts = rawMessage.thoughts
      metadata.thoughtCount = rawMessage.thoughts.length
    }

    // Add token usage if present
    if (rawMessage.tokens) {
      metadata.tokens = rawMessage.tokens
      metadata.hasCachedTokens = rawMessage.tokens.cached > 0
      metadata.hasThinkingTokens = rawMessage.tokens.thoughts > 0

      // Calculate cache efficiency
      if (rawMessage.tokens.input + rawMessage.tokens.cached > 0) {
        metadata.cacheHitRate = rawMessage.tokens.cached / (rawMessage.tokens.input + rawMessage.tokens.cached)
      }

      // Calculate thinking overhead
      if (rawMessage.tokens.output > 0) {
        metadata.thinkingOverhead = rawMessage.tokens.thoughts / rawMessage.tokens.output
      }
    }

    // Add tool calls if present
    if (rawMessage.tools && rawMessage.tools.length > 0) {
      metadata.tools = rawMessage.tools
      metadata.toolCount = rawMessage.tools.length
      metadata.toolNames = rawMessage.tools.map(t => t.name)
    }

    return {
      id: rawMessage.id,
      timestamp,
      type: messageType,
      content,
      metadata
    }
  }

  /**
   * Extract all thoughts from the session
   */
  extractThoughts(session: ParsedSession): Thought[] {
    const allThoughts: Thought[] = []

    for (const message of session.messages) {
      if (message.metadata?.thoughts) {
        allThoughts.push(...message.metadata.thoughts)
      }
    }

    return allThoughts
  }

  /**
   * Calculate total token usage across session
   */
  calculateTotalTokens(session: ParsedSession): {
    totalInput: number
    totalOutput: number
    totalCached: number
    totalThoughts: number
    totalTool: number
    total: number
    cacheHitRate: number
    thinkingOverhead: number
  } {
    let totalInput = 0
    let totalOutput = 0
    let totalCached = 0
    let totalThoughts = 0
    let totalTool = 0
    let total = 0

    for (const message of session.messages) {
      if (message.metadata?.tokens) {
        const tokens = message.metadata.tokens
        totalInput += tokens.input || 0
        totalOutput += tokens.output || 0
        totalCached += tokens.cached || 0
        totalThoughts += tokens.thoughts || 0
        totalTool += tokens.tool || 0
        total += tokens.total || 0
      }
    }

    const cacheHitRate = totalInput + totalCached > 0
      ? totalCached / (totalInput + totalCached)
      : 0

    const thinkingOverhead = totalOutput > 0
      ? totalThoughts / totalOutput
      : 0

    return {
      totalInput,
      totalOutput,
      totalCached,
      totalThoughts,
      totalTool,
      total,
      cacheHitRate,
      thinkingOverhead
    }
  }

  /**
   * Calculate response times between user inputs and gemini responses
   */
  calculateResponseTimes(session: ParsedSession): Array<{
    userMessage: ParsedMessage
    assistantMessage: ParsedMessage
    responseTime: number
  }> {
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
          responseTime
        })
      }
    }

    return responseTimes
  }

  /**
   * Analyze thinking patterns across session
   */
  analyzeThinking(session: ParsedSession): {
    totalThoughts: number
    avgThoughtsPerMessage: number
    maxThinkingDepth: number
    thinkingMessages: number
    thinkingMessagePercentage: number
  } {
    let totalThoughts = 0
    let thinkingMessages = 0
    let maxThinkingDepth = 0

    for (const message of session.messages) {
      if (message.metadata?.thoughts) {
        const thoughtCount = message.metadata.thoughts.length
        totalThoughts += thoughtCount
        thinkingMessages++
        if (thoughtCount > maxThinkingDepth) {
          maxThinkingDepth = thoughtCount
        }
      }
    }

    const assistantMessages = session.messages.filter(m => m.type === 'assistant').length

    return {
      totalThoughts,
      avgThoughtsPerMessage: assistantMessages > 0 ? totalThoughts / assistantMessages : 0,
      maxThinkingDepth,
      thinkingMessages,
      thinkingMessagePercentage: assistantMessages > 0 ? (thinkingMessages / assistantMessages) * 100 : 0
    }
  }
}
