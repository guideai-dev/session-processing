import type { ParsedSession, ParsedMessage } from '../../base/types.js'

// Timeline entry types from Copilot
export interface TimelineEntry {
  id?: string
  timestamp?: string
  type: string
  text?: string
  // User message fields
  mentions?: any[]
  expandedText?: string
  imageAttachments?: any[]
  // Tool call fields
  callId?: string
  name?: string
  toolTitle?: string
  intentionSummary?: string
  arguments?: any
  result?: {
    type: string
    log?: string
  }
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

export class GitHubCopilotParser {
  parseSession(jsonlContent: string): ParsedSession {
    const lines = jsonlContent.split('\n').filter(line => line.trim())
    const messages: ParsedMessage[] = []
    let sessionId = ''
    let startTime: Date | null = null
    let endTime: Date | null = null

    for (let i = 0; i < lines.length; i++) {
      try {
        const entry: TimelineEntry = JSON.parse(lines[i])

        // Skip entries without timestamps
        if (!entry.timestamp) {
          continue
        }

        const timestamp = new Date(entry.timestamp)

        // Validate timestamp is valid
        if (isNaN(timestamp.getTime())) {
          console.warn(`Skipping line ${i + 1}: invalid timestamp ${entry.timestamp}`)
          continue
        }

        // Track start and end times
        if (!startTime || timestamp < startTime) {
          startTime = timestamp
        }
        if (!endTime || timestamp > endTime) {
          endTime = timestamp
        }

        // Generate a session ID if not set (use timestamp of first message)
        if (!sessionId) {
          sessionId = `copilot-${startTime.getTime()}`
        }

        // Parse different timeline entry types
        let message: ParsedMessage | null = null

        switch (entry.type) {
          case 'user':
            // User message
            if (entry.text) {
              message = {
                id: entry.id || `msg-${timestamp.getTime()}-${i}`,
                type: 'user',
                timestamp,
                content: {
                  text: entry.text,
                  structured: [{
                    type: 'text',
                    text: entry.text
                  }],
                  toolUses: [],
                  toolResults: []
                }
              }
            }
            break

          case 'copilot':
            // Assistant message
            if (entry.text) {
              message = {
                id: entry.id || `msg-${timestamp.getTime()}-${i}`,
                type: 'assistant',
                timestamp,
                content: {
                  text: entry.text,
                  structured: [{
                    type: 'text',
                    text: entry.text
                  }],
                  toolUses: [],
                  toolResults: []
                }
              }
            }
            break

          case 'tool_call_requested':
            // Tool use - convert to tool_use format
            if (entry.name && entry.callId) {
              const toolUse = {
                type: 'tool_use' as const,
                id: entry.callId,
                name: entry.name,
                input: entry.arguments || {}
              }

              message = {
                id: `tool-${entry.callId}`,
                type: 'assistant',
                timestamp,
                content: {
                  text: entry.intentionSummary || `Using ${entry.toolTitle || entry.name}`,
                  structured: [toolUse],
                  toolUses: [toolUse],
                  toolResults: []
                },
                metadata: {
                  toolTitle: entry.toolTitle,
                  intentionSummary: entry.intentionSummary
                }
              }
            }
            break

          case 'tool_call_completed':
            // Tool result
            if (entry.callId && entry.result) {
              const toolResult = {
                type: 'tool_result' as const,
                tool_use_id: entry.callId,
                content: entry.result.log || entry.result
              }

              message = {
                id: `tool-result-${entry.callId}`,
                type: 'assistant',
                timestamp,
                content: {
                  text: undefined,
                  structured: [toolResult],
                  toolUses: [],
                  toolResults: [toolResult]
                },
                metadata: {
                  toolName: entry.name,
                  resultType: entry.result.type
                }
              }
            }
            break

          case 'info':
            // Info messages - can be treated as assistant messages
            if (entry.text) {
              message = {
                id: entry.id || `info-${timestamp.getTime()}-${i}`,
                type: 'assistant',
                timestamp,
                content: {
                  text: entry.text,
                  structured: [{
                    type: 'text',
                    text: entry.text
                  }],
                  toolUses: [],
                  toolResults: []
                },
                metadata: {
                  isInfo: true
                }
              }
            }
            break
        }

        if (message) {
          messages.push(message)
        }
      } catch (error) {
        console.warn(`Failed to parse line ${i + 1}:`, error)
        continue
      }
    }

    // Calculate duration
    const durationMs = startTime && endTime ? endTime.getTime() - startTime.getTime() : 0

    return {
      sessionId,
      provider: 'github-copilot',
      messages,
      startTime: startTime || new Date(),
      endTime: endTime || new Date(),
      duration: durationMs,
      metadata: {
        messageCount: messages.length
      }
    }
  }

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

  extractToolUses(session: ParsedSession): ToolUseContent[] {
    const toolUses: ToolUseContent[] = []

    for (const message of session.messages) {
      if (message.content?.toolUses) {
        toolUses.push(...message.content.toolUses)
      }
    }

    return toolUses
  }

  extractToolResults(session: ParsedSession): ToolResultContent[] {
    const toolResults: ToolResultContent[] = []

    for (const message of session.messages) {
      if (message.content?.toolResults) {
        toolResults.push(...message.content.toolResults)
      }
    }

    return toolResults
  }

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

  private isInterruptionMessage(message: ParsedMessage): boolean {
    const content = this.extractTextContent(message)
    return content.includes('[Request interrupted by user for tool use]') ||
           content.includes('[Request interrupted by user]') ||
           content.includes('Request interrupted by user')
  }

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
      return textParts.join('\n')
    }

    return ''
  }
}
