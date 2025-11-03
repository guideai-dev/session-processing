/**
 * Canonical Parser
 *
 * Universal parser for canonical JSONL format used by all providers.
 * This eliminates the need for provider-specific parsers - all providers
 * write canonical JSONL, and this single parser handles all of them.
 */

import type {
  ContentBlock,
  StructuredMessageContent,
  TextContent,
  ToolResultContent,
  ToolUseContent,
} from '@guideai-dev/types'
import { isTextContent, isToolResultContent, isToolUseContent } from '@guideai-dev/types'
import { BaseParser } from '../base/BaseParser.js'
import type { ParsedMessage, RawLogMessage, UnifiedMessageType } from '../base/types.js'
import type { CanonicalContentBlock, CanonicalMessage } from './types.js'

export class CanonicalParser extends BaseParser {
  readonly name = 'canonical'
  readonly providerName = 'canonical'

  /**
   * Check if this parser can handle the given JSONL content
   * Canonical format has uuid, sessionId, and message.role fields
   */
  canParse(jsonlContent: string): boolean {
    try {
      this.validateContent(jsonlContent)

      const lines = jsonlContent.split('\n').filter(line => line.trim())
      if (lines.length === 0) return false

      // Check first valid message for canonical markers
      for (const line of lines.slice(0, 5)) {
        try {
          const message = JSON.parse(line) as Partial<CanonicalMessage>

          // Canonical format has these key fields
          if (
            message.uuid &&
            message.sessionId &&
            message.message?.role &&
            message.type &&
            ['user', 'assistant', 'meta'].includes(message.type)
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
   * Parse a single canonical message into one or more ParsedMessages
   * Handles both text content and structured content (with tool blocks)
   */
  parseMessage(rawMessage: RawLogMessage): ParsedMessage[] {
    const canonical = rawMessage as unknown as CanonicalMessage

    // Validate required fields
    if (!canonical.uuid || !canonical.timestamp || !canonical.type || !canonical.message) {
      return []
    }

    const timestamp = this.parseTimestamp(canonical.timestamp)
    if (!timestamp) {
      return []
    }

    // Skip empty command stdout messages (Claude Code specific)
    // These are user messages with content like "<local-command-stdout></local-command-stdout>"
    if (typeof canonical.message.content === 'string') {
      const content = canonical.message.content.trim()
      if (content === '<local-command-stdout></local-command-stdout>') {
        return []
      }
    }

    // Handle text content (simple case)
    if (typeof canonical.message.content === 'string') {
      return [this.parseTextMessage(canonical, timestamp)]
    }

    // Handle structured content (text + tools)
    if (Array.isArray(canonical.message.content)) {
      return this.parseStructuredMessage(canonical, timestamp)
    }

    // Fallback to empty string for unknown content types
    return [this.parseTextMessage(canonical, timestamp)]
  }

  /**
   * Parse canonical message with text content
   */
  private parseTextMessage(canonical: CanonicalMessage, timestamp: Date): ParsedMessage {
    const content = typeof canonical.message.content === 'string' ? canonical.message.content : ''

    // Determine actual message type by inspecting content
    const messageType = this.determineMessageType(canonical, content)

    return {
      id: canonical.uuid,
      timestamp,
      type: messageType, // Now uses intelligent type detection
      content,
      metadata: {
        role: canonical.message.role,
        sessionId: canonical.sessionId,
        provider: canonical.provider,
        cwd: canonical.cwd,
        gitBranch: canonical.gitBranch,
        version: canonical.version,
        model: canonical.message.model,
        usage: canonical.message.usage,
        providerMetadata: canonical.providerMetadata, // Preserve provider-specific data
        requestId: canonical.requestId,
        isMeta: canonical.isMeta,
        isSidechain: canonical.isSidechain,
        userType: canonical.userType,
      },
      parentId: canonical.parentUuid,
    }
  }

  /**
   * Parse canonical message with structured content blocks
   *
   * NOTE: In canonical format, messages are typically single-type.
   * Exception: Gemini can have multiple thinking blocks in one message.
   */
  private parseStructuredMessage(canonical: CanonicalMessage, timestamp: Date): ParsedMessage[] {
    const blocks = canonical.message.content as CanonicalContentBlock[]

    if (blocks.length === 0) {
      return []
    }

    // Special case: Multiple thinking blocks (Gemini extended thinking)
    // Create a separate message for each thinking block
    if (blocks.length > 1 && blocks.every(b => b.type === 'thinking')) {
      return blocks
        .map((block, index) => this.createThinkingMessage(canonical, block, timestamp, index))
        .filter((msg): msg is ParsedMessage => msg !== null)
    }

    // Standard case: Single content block
    const block = blocks[0]

    // Build appropriate StructuredMessageContent based on block type
    let structuredContent: StructuredMessageContent
    let text: string | undefined
    let toolUse: ToolUseContent | undefined
    let toolResult: ToolResultContent | undefined
    let isThinking = false

    if (block.type === 'text') {
      // Trim excessive leading/trailing newlines (keep max 2)
      text = this.trimExcessiveNewlines(block.text)
      structuredContent = {
        type: 'structured',
        text,
      }
    } else if (block.type === 'thinking') {
      // Handle thinking blocks (Gemini extended thinking, Claude thinking)
      // Trim excessive leading/trailing newlines (keep max 2)
      text = this.trimExcessiveNewlines(block.thinking || '')
      structuredContent = {
        type: 'structured',
        text,
      }
      isThinking = true
    } else if (block.type === 'tool_use') {
      toolUse = {
        type: 'tool_use' as const,
        id: block.id,
        name: block.name,
        input: block.input,
      }
      structuredContent = {
        type: 'structured',
        toolUse,
      }
    } else if (block.type === 'tool_result') {
      // Defensive filtering: skip malformed tool_result blocks
      if (!block.tool_use_id || block.content === undefined || block.content === '') {
        return []
      }
      toolResult = {
        type: 'tool_result' as const,
        tool_use_id: block.tool_use_id,
        content: block.content,
        is_error: block.is_error,
      }
      structuredContent = {
        type: 'structured',
        toolResult,
      }
    } else {
      // Unknown block type - skip
      return []
    }

    // Determine correct message type
    const messageType = this.determineMessageType(canonical, blocks)

    // Build metadata based on message type
    const metadata: ParsedMessage['metadata'] = {
      role:
        messageType === 'tool_use' || messageType === 'tool_result'
          ? 'tool'
          : canonical.message.role,
      sessionId: canonical.sessionId,
      provider: canonical.provider,
      cwd: canonical.cwd,
      gitBranch: canonical.gitBranch,
      version: canonical.version,
      model: canonical.message.model,
      usage: canonical.message.usage,
      providerMetadata: canonical.providerMetadata,
      requestId: canonical.requestId,
      isMeta: canonical.isMeta,
      isSidechain: canonical.isSidechain,
      userType: canonical.userType,
      hasToolUses: toolUse !== undefined,
      hasToolResults: toolResult !== undefined,
      toolCount: toolUse !== undefined ? 1 : 0,
      resultCount: toolResult !== undefined ? 1 : 0,
      isThinking: isThinking, // Flag for UI to render as thinking block
    }

    // Add toolUseId for tool_use messages
    if (toolUse) {
      metadata.toolUseId = toolUse.id
    }

    const message: ParsedMessage = {
      id: canonical.uuid,
      timestamp,
      type: messageType,
      content: structuredContent,
      metadata,
      parentId: canonical.parentUuid,
    }

    // Link tool results to their tool uses
    if (toolResult) {
      message.linkedTo = toolResult.tool_use_id
    }

    return [message]
  }

  /**
   * Create a message for a thinking block
   */
  private createThinkingMessage(
    canonical: CanonicalMessage,
    block: CanonicalContentBlock & { type: 'thinking' },
    timestamp: Date,
    index: number
  ): ParsedMessage | null {
    const text = block.thinking || ''
    if (!text) return null // Skip empty thinking blocks

    const structuredContent: StructuredMessageContent = {
      type: 'structured',
      text,
    }

    const metadata: ParsedMessage['metadata'] = {
      role: canonical.message.role,
      sessionId: canonical.sessionId,
      provider: canonical.provider,
      cwd: canonical.cwd,
      gitBranch: canonical.gitBranch,
      version: canonical.version,
      model: canonical.message.model,
      usage: index === 0 ? canonical.message.usage : undefined, // Only first gets usage
      providerMetadata: canonical.providerMetadata,
      requestId: canonical.requestId,
      isMeta: canonical.isMeta,
      isSidechain: canonical.isSidechain,
      userType: canonical.userType,
      hasToolUses: false,
      hasToolResults: false,
      toolCount: 0,
      resultCount: 0,
      isThinking: true,
    }

    return {
      id: `${canonical.uuid}-thinking-${index}`,
      timestamp,
      type: 'assistant',
      content: structuredContent,
      metadata,
      parentId: canonical.parentUuid,
    }
  }

  /**
   * Extract session ID from canonical message
   */
  protected extractSessionId(rawMessage: RawLogMessage): string | null {
    const canonical = rawMessage as unknown as CanonicalMessage
    return canonical.sessionId || null
  }

  /**
   * Determine the actual message type by inspecting content blocks
   * Transforms canonical role (user/assistant/meta) into specific message types
   */
  private determineMessageType(
    canonical: CanonicalMessage,
    content: string | CanonicalContentBlock[]
  ): UnifiedMessageType {
    if (canonical.type === 'user') {
      // Check content blocks for tool results
      if (Array.isArray(content) && content.some(block => block.type === 'tool_result')) {
        return 'tool_result'
      }

      // Check for special patterns in both string and structured content
      let textContent = ''
      if (typeof content === 'string') {
        textContent = content
      } else if (Array.isArray(content)) {
        // Extract text from text blocks
        const textBlocks = content.filter(block => block.type === 'text')
        textContent = textBlocks.map(block => block.text).join(' ')
      }

      if (textContent) {
        if (this.isCompactContent(textContent)) return 'compact'
        if (this.isInterruptionContent(textContent)) return 'interruption'
        if (this.isCommandContent(textContent)) return 'command'
      }

      return 'user'
    }

    if (canonical.type === 'assistant') {
      // Check content blocks for tool uses
      if (Array.isArray(content) && content.some(block => block.type === 'tool_use')) {
        return 'tool_use'
      }
      return 'assistant'
    }

    return 'meta'
  }

  /**
   * Trim excessive leading/trailing newlines from text content
   * Removes all leading newlines and keeps max 2 trailing newlines
   */
  private trimExcessiveNewlines(text: string): string {
    // Remove ALL leading newlines
    let trimmed = text.replace(/^\n+/, '')
    // Replace 3+ trailing newlines with 2
    trimmed = trimmed.replace(/\n{3,}$/, '\n\n')
    return trimmed
  }

  /**
   * Check if content is a compact command (context compaction event)
   */
  protected isCompactContent(content: string): boolean {
    return (
      content.includes('<command-name>/compact</command-name>') ||
      (content.trim().startsWith('/compact') && content.trim().length < 50)
    )
  }
}
