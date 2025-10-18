import {
  BaseSessionMessage,
  SessionParser,
  ProviderAdapter,
  ClaudeMessage,
  ToolUseContent,
  ToolResultContent,
  TextContent,
  ConversationTurn,
} from './sessionTypes.js'

class ClaudeAdapter implements ProviderAdapter {
  name = 'claude'

  detect(content: any): boolean {
    return !!(
      content &&
      typeof content === 'object' &&
      content.uuid &&
      content.sessionId &&
      content.type &&
      content.message &&
      content.timestamp
    )
  }

  transform(rawMessage: ClaudeMessage): BaseSessionMessage[] {
    const messageType = this.getMessageType(rawMessage)
    const processedContent = this.processContent(rawMessage)

    // For assistant messages with tool uses, split into separate messages
    if (messageType === 'assistant_response' && processedContent.parts) {
      const messages: BaseSessionMessage[] = []

      // Create assistant response message for text content
      const textParts = processedContent.parts.filter((p: any) => p.type === 'text')
      if (textParts.length > 0) {
        messages.push({
          id: rawMessage.uuid,
          timestamp: rawMessage.timestamp,
          type: 'assistant_response',
          content: { text: textParts.map((p: any) => p.text).join('\n') },
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
      const toolUses = processedContent.parts.filter((p: any) => p.type === 'tool_use')
      for (const toolUse of toolUses) {
        messages.push({
          id: `${rawMessage.uuid}-tool-${(toolUse as any).id}`,
          timestamp: rawMessage.timestamp,
          type: 'tool_use',
          content: toolUse,
          metadata: {
            sessionId: rawMessage.sessionId,
            toolUseId: (toolUse as any).id,
          },
          parentId: rawMessage.uuid,
        })
      }

      return messages
    }

    // For tool results, link to their tool use
    if (messageType === 'tool_result' && processedContent.parts) {
      const toolResults = processedContent.parts.filter((p: any) => p.type === 'tool_result')
      return toolResults.map((result: any) => ({
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
          (part: any) =>
            part.type === 'text' &&
            (part.text?.includes('[Request interrupted by user]') ||
              part.text?.includes('Request interrupted by user'))
        )
        const hasOnlyInterruptionText = parsedContent.parts?.every(
          (part: any) =>
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
          (part: any) =>
            part.type === 'text' &&
            (part.text?.startsWith('/') || part.text?.includes('<command-name>'))
        )
        const hasOnlyCommandText = parsedContent.parts?.every(
          (part: any) =>
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

  private parsePartsContent(content: any) {
    // Try to parse the content as a parts structure
    try {
      if (typeof content === 'string') {
        const parsed = JSON.parse(content)
        if (parsed && parsed.parts && Array.isArray(parsed.parts)) {
          return parsed
        }
      } else if (content && content.parts && Array.isArray(content.parts)) {
        return content
      }
    } catch (error) {
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
        if (parsed && parsed.parts && Array.isArray(parsed.parts)) {
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
        if (item.type === 'text') {
          return { type: 'text', text: item.text }
        }
        if (item.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: (item as any).id || item.tool_use_id,
            name: (item as any).name,
            input: (item as any).input,
          }
        }
        if (item.type === 'tool_result') {
          return {
            type: 'tool_result',
            tool_use_id: item.tool_use_id,
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

  detect(content: any): boolean {
    return !!(
      content &&
      typeof content === 'object' &&
      content.type &&
      content.payload &&
      content.timestamp &&
      (content.type === 'event_msg' ||
        content.type === 'response_item' ||
        content.type === 'session_meta' ||
        content.type === 'turn_context')
    )
  }

  transform(rawMessage: any): BaseSessionMessage[] {
    return [
      {
        id: rawMessage.id || Math.random().toString(36).substr(2, 9),
        timestamp: rawMessage.timestamp,
        type: this.inferType(rawMessage),
        content: rawMessage,
        metadata: {
          messageID: rawMessage.messageID,
          sessionID: rawMessage.sessionID,
        },
      },
    ]
  }

  private inferType(message: any): BaseSessionMessage['type'] {
    // Map Codex message types to standard types
    const payloadType = message.payload?.type || message.type

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

  detect(content: any): boolean {
    // OpenCode uses Claude-like format but with sessionId (lowercase)
    return !!(
      content &&
      typeof content === 'object' &&
      content.sessionId &&
      content.timestamp &&
      content.type &&
      content.message &&
      (content.type === 'user' ||
        content.type === 'assistant' ||
        content.type === 'tool_use' ||
        content.type === 'tool_result')
    )
  }

  transform(rawMessage: any): BaseSessionMessage[] {
    const messageType = this.getMessageType(rawMessage)
    const processedContent = this.processContent(rawMessage)

    // Handle direct tool_use messages (from new format)
    if (messageType === 'tool_use') {
      // Extract the tool use from content array
      const content = processedContent.parts?.[0] || processedContent
      const toolUseId = content.id || `tool-${rawMessage.timestamp}`

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
      const content = processedContent.parts?.[0] || processedContent
      const toolUseId = content.tool_use_id || 'unknown'

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
    if (messageType === 'assistant_response' && processedContent.parts) {
      const messages: BaseSessionMessage[] = []

      // Create assistant response message for text content
      const textParts = processedContent.parts.filter((p: any) => p.type === 'text')
      if (textParts.length > 0) {
        messages.push({
          id: `${rawMessage.sessionId}-${rawMessage.timestamp}`,
          timestamp: rawMessage.timestamp,
          type: 'assistant_response',
          content: { text: textParts.map((p: any) => p.text).join('\n') },
          metadata: {
            sessionId: rawMessage.sessionId,
          },
        })
      }

      // Create separate tool use messages
      const toolUses = processedContent.parts.filter((p: any) => p.type === 'tool_use')
      for (const toolUse of toolUses) {
        messages.push({
          id: `${rawMessage.sessionId}-${rawMessage.timestamp}-tool-${(toolUse as any).id}`,
          timestamp: rawMessage.timestamp,
          type: 'tool_use',
          content: toolUse,
          metadata: {
            sessionId: rawMessage.sessionId,
            toolUseId: (toolUse as any).id,
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

  private getMessageType(message: any): BaseSessionMessage['type'] {
    // Handle direct type specification from new format
    if (message.type === 'tool_use') {
      return 'tool_use'
    }

    if (message.type === 'tool_result') {
      return 'tool_result'
    }

    if (message.type === 'user') {
      // Check if this is a tool result vs real user input
      const content = message.message?.content
      if (Array.isArray(content) && content.some(item => item.type === 'tool_result')) {
        return 'tool_result'
      }
      return 'user_input'
    }

    if (message.type === 'assistant') {
      return 'assistant_response'
    }

    return 'meta'
  }

  private processContent(message: any) {
    const content = message.message?.content

    if (typeof content === 'string') {
      return { text: content }
    }

    if (Array.isArray(content)) {
      const processed = content.map(item => {
        if (item.type === 'text') {
          return { type: 'text', text: item.text }
        }
        if (item.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: item.id || item.tool_use_id,
            name: item.name,
            input: item.input,
          }
        }
        if (item.type === 'tool_result') {
          return {
            type: 'tool_result',
            tool_use_id: item.tool_use_id,
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

class CopilotAdapter implements ProviderAdapter {
  name = 'github-copilot'

  detect(content: any): boolean {
    // GitHub Copilot timeline format: has timestamp and type (user/copilot/tool_call_*)
    return !!(
      content &&
      typeof content === 'object' &&
      content.timestamp &&
      content.type &&
      (content.type === 'user' ||
        content.type === 'copilot' ||
        content.type === 'tool_call_requested' ||
        content.type === 'tool_call_completed' ||
        content.type === 'info')
    )
  }

  transform(rawMessage: any): BaseSessionMessage[] {
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
            content: rawMessage.result?.log || rawMessage.result,
            parts: [
              {
                type: 'tool_result',
                tool_use_id: rawMessage.callId,
                content: rawMessage.result?.log || rawMessage.result,
              },
            ],
          },
          metadata: {
            toolName: rawMessage.name,
            resultType: rawMessage.result?.type,
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

  private getMessageType(message: any): BaseSessionMessage['type'] {
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

  private processContent(message: any) {
    // For timeline entries, text is directly on the object
    if (message.text) {
      return {
        text: message.text,
        parts: [
          {
            type: 'text',
            text: message.text,
          },
        ],
      }
    }

    // For tool calls, create appropriate structure
    if (message.type === 'tool_call_requested') {
      return {
        parts: [
          {
            type: 'tool_use',
            id: message.callId,
            name: message.name,
            input: message.arguments || {},
          },
        ],
      }
    }

    if (message.type === 'tool_call_completed') {
      return {
        parts: [
          {
            type: 'tool_result',
            tool_use_id: message.callId,
            content: message.result?.log || message.result,
          },
        ],
      }
    }

    return { text: '' }
  }
}

class GeminiAdapter implements ProviderAdapter {
  name = 'gemini-code'

  detect(content: any): boolean {
    // Gemini JSONL format has gemini_raw field with the full message
    return !!(
      content &&
      typeof content === 'object' &&
      content.provider === 'gemini-code' &&
      content.gemini_raw &&
      content.sessionId
    )
  }

  transform(rawMessage: any): BaseSessionMessage[] {
    // Extract the Gemini message from gemini_raw field
    const geminiMsg = rawMessage.gemini_raw

    if (!geminiMsg) {
      return []
    }

    // Check if this is a tool result message (user message starting with [Function Response:])
    if (
      geminiMsg.type === 'user' &&
      geminiMsg.content &&
      geminiMsg.content.startsWith('[Function Response:')
    ) {
      // Extract tool name from [Function Response: tool_name]
      const toolNameMatch = geminiMsg.content.match(/\[Function Response: ([^\]]+)\]/)
      const toolName = toolNameMatch ? toolNameMatch[1] : 'unknown'
      const toolUseId = `tool-${geminiMsg.id}-${toolName}`

      // Return BOTH tool_use and tool_result messages
      return [
        // Tool use (implicit request)
        {
          id: toolUseId,
          timestamp: geminiMsg.timestamp,
          type: 'tool_use',
          content: {
            type: 'tool_use',
            name: toolName,
            input: {},
          },
          metadata: {
            sessionId: rawMessage.sessionId,
            toolName,
          },
        },
        // Tool result (explicit response)
        {
          id: geminiMsg.id,
          timestamp: geminiMsg.timestamp,
          type: 'tool_result',
          content: {
            type: 'tool_result',
            content: geminiMsg.content,
          },
          metadata: {
            sessionId: rawMessage.sessionId,
            toolName,
          },
          linkedTo: toolUseId,
        },
      ]
    }

    const messageType = this.getMessageType(geminiMsg)
    const processedContent = this.processContent(geminiMsg)

    // Default single message
    return [
      {
        id: geminiMsg.id,
        timestamp: geminiMsg.timestamp,
        type: messageType,
        content: processedContent,
        metadata: {
          sessionId: rawMessage.sessionId,
          model: geminiMsg.model,
          thoughts: geminiMsg.thoughts,
          tokens: geminiMsg.tokens,
          cwd: rawMessage.cwd,
        },
      },
    ]
  }

  private getMessageType(message: any): BaseSessionMessage['type'] {
    if (message.type === 'user') {
      return 'user_input'
    }

    if (message.type === 'gemini') {
      return 'assistant_response'
    }

    return 'meta'
  }

  private processContent(message: any) {
    // For text content, return simple structure
    if (message.content) {
      return {
        text: message.content,
        parts: [
          {
            type: 'text',
            text: message.content,
          },
        ],
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

  parse(content: string, provider?: string): BaseSessionMessage[] {
    const lines = content.split('\n').filter(line => line.trim())
    const messages: BaseSessionMessage[] = []

    // Get the adapter for the known provider (if provided)
    const adapter = provider ? this.getAdapter(provider) : null

    for (const line of lines) {
      try {
        const rawMessage = JSON.parse(line)

        if (adapter) {
          // Use the known adapter
          const transformedMessages = adapter.transform(rawMessage)
          messages.push(...transformedMessages)
        } else {
          // Fallback to auto-detection
          const detectedAdapter = this.findAdapter(rawMessage)
          if (detectedAdapter) {
            const transformedMessages = detectedAdapter.transform(rawMessage)
            messages.push(...transformedMessages)
          } else {
            messages.push(this.createGenericMessage(rawMessage))
          }
        }
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

  private findAdapter(content: any): ProviderAdapter | null {
    // Fallback auto-detection
    for (const adapter of this.adapters.values()) {
      if (adapter.detect(content)) {
        return adapter
      }
    }
    return null
  }

  private createGenericMessage(rawMessage: any): BaseSessionMessage {
    return {
      id: rawMessage.id || rawMessage.uuid || Math.random().toString(36).substr(2, 9),
      timestamp: rawMessage.timestamp || rawMessage.createdAt || new Date().toISOString(),
      type: this.inferType(rawMessage),
      content: rawMessage,
      metadata: {},
    }
  }

  private inferType(message: any): BaseSessionMessage['type'] {
    if (message.type === 'user' || message.role === 'user') {
      // Check for command or interruption patterns
      const content = message.content || message.message?.content || message.text || ''

      // Parse parts structure if it exists
      const parsedContent = this.parsePartsContent(content)
      if (parsedContent) {
        // Check for interruption in parts structure - ONLY if it's specifically about interruption
        const hasInterruptionText = parsedContent.parts?.some(
          (part: any) =>
            part.type === 'text' &&
            (part.text?.includes('[Request interrupted by user]') ||
              part.text?.includes('Request interrupted by user'))
        )
        const hasOnlyInterruptionText = parsedContent.parts?.every(
          (part: any) =>
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
          (part: any) =>
            part.type === 'text' &&
            (part.text?.startsWith('/') || part.text?.includes('<command-name>'))
        )
        const hasOnlyCommandText = parsedContent.parts?.every(
          (part: any) =>
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
          (item: any) =>
            item.type === 'text' &&
            (item.text?.includes('[Request interrupted by user]') ||
              item.text?.includes('Request interrupted by user'))
        )
        const hasOnlyInterruptionText = content.every(
          (item: any) =>
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
    if (message.type === 'assistant' || message.role === 'assistant') return 'assistant_response'
    if (message.type === 'tool_use') return 'tool_use'
    if (message.type === 'tool_result') return 'tool_result'
    if (message.type === 'command') return 'command'
    if (message.type === 'command_output') return 'command_output'
    if (message.type === 'interruption') return 'interruption'
    return 'meta'
  }

  private parsePartsContent(content: any) {
    // Try to parse the content as a parts structure
    try {
      if (typeof content === 'string') {
        const parsed = JSON.parse(content)
        if (parsed && parsed.parts && Array.isArray(parsed.parts)) {
          return parsed
        }
      } else if (content && content.parts && Array.isArray(content.parts)) {
        return content
      }
    } catch (error) {
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

  parseSession(content: string, provider?: string): BaseSessionMessage[] {
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

// Conversation-based parser for better Input/Output display
export class ConversationParser {
  static parseConversation(content: string): ConversationTurn[] {
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
      } catch (error) {
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
        const toolUses = this.extractToolUses(message.message.content)

        currentTurn.assistantResponse = {
          content: this.extractTextContent(message.message.content),
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

  private static extractTextContent(content: any): string {
    if (typeof content === 'string') {
      return content
    }

    if (Array.isArray(content)) {
      const textParts = content
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('\n')
      return textParts || ''
    }

    return ''
  }

  private static extractToolUses(content: any): Array<{ name: string; input: any; result?: any }> {
    if (!Array.isArray(content)) return []

    return content
      .filter(part => part.type === 'tool_use')
      .map(part => ({
        name: part.name,
        input: part.input,
        // Tool results come in separate messages, would need to match by ID
        // For now, just show the tool use
      }))
  }
}

export {
  ClaudeAdapter,
  CopilotAdapter,
  CodexAdapter,
  OpenCodeAdapter,
  GeminiAdapter,
  GenericJSONLParser,
}
