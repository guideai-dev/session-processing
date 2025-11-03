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
   * Splits into separate messages for text, tool_use, and tool_result
   */
  private parseStructuredMessage(canonical: CanonicalMessage, timestamp: Date): ParsedMessage[] {
    const blocks = canonical.message.content as CanonicalContentBlock[]

    // Check for tool uses - assistant messages with tool_use blocks
    const hasToolUses = blocks.some(block => block.type === 'tool_use')
    if (canonical.type === 'assistant' && hasToolUses) {
      return this.splitAssistantWithTools(canonical, blocks, timestamp)
    }

    // Check for tool results - user messages with tool_result blocks
    const hasToolResults = blocks.some(block => block.type === 'tool_result')
    if (canonical.type === 'user' && hasToolResults) {
      return this.parseToolResultsFromMessage(canonical, blocks, timestamp)
    }

    // Otherwise, create a single message with correct type
    // Build structured content for the main message
    const textBlocks: TextContent[] = []
    const toolUses: ToolUseContent[] = []
    const toolResults: ToolResultContent[] = []

    for (const block of blocks) {
      if (block.type === 'text') {
        textBlocks.push({
          type: 'text' as const,
          text: block.text,
        })
      } else if (block.type === 'tool_use') {
        toolUses.push({
          type: 'tool_use' as const,
          id: block.id,
          name: block.name,
          input: block.input,
        })
      } else if (block.type === 'tool_result') {
        // Defensive filtering: skip malformed tool_result blocks
        // (missing required fields from Rust converter issues)
        if (block.tool_use_id && block.content !== undefined && block.content !== '') {
          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: block.tool_use_id,
            content: block.content,
            is_error: block.is_error,
          })
        }
      }
    }

    // Create main message with structured content
    const text = textBlocks.map(t => t.text).join('\n')
    const structuredContent: StructuredMessageContent = {
      type: 'structured',
      text,
      toolUses,
      toolResults,
      structured: blocks
        .filter(block => {
          // Filter out malformed tool_result blocks
          if (block.type === 'tool_result') {
            return block.tool_use_id && block.content !== undefined && block.content !== ''
          }
          return true
        })
        .map(block => {
          if (block.type === 'text') {
            return { type: 'text' as const, text: block.text }
          }
          if (block.type === 'tool_use') {
            return { type: 'tool_use' as const, id: block.id, name: block.name, input: block.input }
          }
          return {
            type: 'tool_result' as const,
            tool_use_id: block.tool_use_id,
            content: block.content,
            is_error: block.is_error,
          }
        }),
    }

    // Determine correct message type
    const messageType = this.determineMessageType(canonical, blocks)

    // Skip creating message if it has no displayable content
    // (only tool blocks with no text - these should have been split already)
    if (
      !text.trim() &&
      textBlocks.length === 0 &&
      (toolUses.length > 0 || toolResults.length > 0)
    ) {
      // This shouldn't happen in well-formed canonical data, but handle defensively
      return []
    }

    const mainMessage: ParsedMessage = {
      id: canonical.uuid,
      timestamp,
      type: messageType, // Now uses intelligent type detection
      content: structuredContent,
      metadata: {
        role: canonical.message.role,
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
        hasToolUses: toolUses.length > 0,
        hasToolResults: toolResults.length > 0,
        toolCount: toolUses.length,
        resultCount: toolResults.length,
      },
      parentId: canonical.parentUuid,
    }

    return [mainMessage]
  }

  /**
   * Split assistant message with tool uses into separate messages
   * Creates one assistant message for text content and separate tool_use messages
   */
  private splitAssistantWithTools(
    canonical: CanonicalMessage,
    blocks: CanonicalContentBlock[],
    timestamp: Date
  ): ParsedMessage[] {
    const messages: ParsedMessage[] = []

    // Separate content by type
    const textBlocks = blocks.filter(block => block.type === 'text')
    const toolUseBlocks = blocks.filter(block => block.type === 'tool_use')

    const textContent = textBlocks
      .map(block => block.text)
      .join('\n')
      .trim()

    // Only create assistant message if there's actual text content
    // Tool-only responses don't need a separate text message
    if (textContent) {
      messages.push({
        id: canonical.uuid,
        timestamp,
        type: 'assistant',
        content: textContent,
        metadata: {
          role: canonical.message.role,
          sessionId: canonical.sessionId,
          provider: canonical.provider,
          cwd: canonical.cwd,
          gitBranch: canonical.gitBranch,
          version: canonical.version,
          model: canonical.message.model,
          usage: canonical.message.usage, // IMPORTANT: Preserve usage data
          providerMetadata: canonical.providerMetadata,
          requestId: canonical.requestId,
          isMeta: canonical.isMeta,
          isSidechain: canonical.isSidechain,
          userType: canonical.userType,
        },
        parentId: canonical.parentUuid,
      })
    }

    // Create separate tool_use messages
    for (const toolUseBlock of toolUseBlocks) {
      const toolUse: ToolUseContent = {
        type: 'tool_use' as const,
        id: toolUseBlock.id,
        name: toolUseBlock.name,
        input: toolUseBlock.input,
      }

      const structuredContent: StructuredMessageContent = {
        type: 'structured',
        text: '',
        toolUses: [toolUse],
        toolResults: [],
        structured: [toolUse],
      }

      messages.push({
        id: `${canonical.uuid}-tool-${toolUseBlock.id}`,
        timestamp,
        type: 'tool_use',
        content: structuredContent,
        metadata: {
          role: 'tool',
          sessionId: canonical.sessionId,
          provider: canonical.provider,
          toolUseId: toolUseBlock.id,
          hasToolUses: true,
          toolCount: 1,
        },
        parentId: canonical.uuid,
      })
    }

    return messages
  }

  /**
   * Type guard to check if a block is a valid tool_result
   */
  private isValidToolResultBlock(
    block: CanonicalContentBlock
  ): block is { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean } {
    return (
      block.type === 'tool_result' &&
      'tool_use_id' in block &&
      'content' in block &&
      block.tool_use_id !== '' &&
      block.content !== undefined &&
      block.content !== ''
    )
  }

  /**
   * Parse tool results from user message
   * Extracts tool_result blocks as separate messages
   */
  private parseToolResultsFromMessage(
    canonical: CanonicalMessage,
    blocks: CanonicalContentBlock[],
    timestamp: Date
  ): ParsedMessage[] {
    // Defensive filtering: skip malformed tool_result blocks
    const toolResultBlocks = blocks.filter((block): block is {
      type: 'tool_result'
      tool_use_id: string
      content: string
      is_error?: boolean
    } =>
      block.type === 'tool_result' &&
      'tool_use_id' in block &&
      'content' in block &&
      block.tool_use_id !== '' &&
      block.content !== undefined &&
      block.content !== ''
    )

    return toolResultBlocks.map(toolResultBlock => {
      const toolResult: ToolResultContent = {
        type: 'tool_result' as const,
        tool_use_id: toolResultBlock.tool_use_id,
        content: toolResultBlock.content,
        is_error: toolResultBlock.is_error,
      }

      const structuredContent: StructuredMessageContent = {
        type: 'structured',
        text: '',
        toolUses: [],
        toolResults: [toolResult],
        structured: [toolResult],
      }

      return {
        id: `${canonical.uuid}-result-${toolResultBlock.tool_use_id}`,
        timestamp,
        type: 'tool_result',
        content: structuredContent,
        metadata: {
          role: 'tool',
          sessionId: canonical.sessionId,
          provider: canonical.provider,
          isSidechain: canonical.isSidechain,
          hasToolResults: true,
          resultCount: 1,
          usage: canonical.message.usage, // IMPORTANT: Preserve usage data
        },
        parentId: canonical.parentUuid,
        linkedTo: toolResultBlock.tool_use_id,
      }
    })
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

      // Check string content for special patterns
      if (typeof content === 'string') {
        if (this.isCompactContent(content)) return 'compact'
        if (this.isInterruptionContent(content)) return 'interruption'
        if (this.isCommandContent(content)) return 'command'
      }

      return 'user'
    }

    if (canonical.type === 'assistant') {
      return 'assistant'
    }

    return 'meta'
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
