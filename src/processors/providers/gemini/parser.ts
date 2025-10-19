import { ClaudeCodeParser } from '../claude-code/parser.js'
import type { ParsedSession, ParsedMessage } from '../../base/types.js'

// Gemini-specific types
export interface Thought {
  subject: string
  description: string
  timestamp: string
}

export interface GeminiTokens {
  input: number
  output: number
  cached: number
  thoughts: number
  tool: number
  total: number
}

/**
 * GeminiParser extends ClaudeCodeParser to reuse tool call parsing logic
 * while preserving Gemini-specific features (Extended Thinking, token metrics)
 */
export class GeminiParser extends ClaudeCodeParser {
  parseSession(jsonlContent: string): ParsedSession {
    // Parse JSONL lines to extract Gemini-specific metadata first
    const geminiMetadata = this.extractGeminiMetadata(jsonlContent)

    // Use parent Claude parser for tool parsing (tool_use/tool_result messages)
    const session = super.parseSession(jsonlContent)

    // Override provider
    session.provider = 'gemini-code'

    // Enhance messages with Gemini-specific metadata
    this.enhanceMessagesWithGeminiData(session, geminiMetadata)

    // Add session-level metadata
    this.enhanceWithGeminiMetadata(session)

    return session
  }

  /**
   * Extract Gemini-specific metadata from JSONL before parsing
   */
  private extractGeminiMetadata(jsonlContent: string): Map<string, any> {
    const metadata = new Map<string, any>()
    const lines = jsonlContent.split('\n').filter(line => line.trim())

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)

        // Store Gemini-specific fields by UUID
        if (parsed.uuid) {
          metadata.set(parsed.uuid, {
            thoughts: parsed.gemini_thoughts,
            tokens: parsed.gemini_tokens,
            model: parsed.gemini_model,
          })
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    return metadata
  }

  /**
   * Enhance parsed messages with Gemini-specific metadata
   */
  private enhanceMessagesWithGeminiData(session: ParsedSession, geminiMetadata: Map<string, any>): void {
    for (const message of session.messages) {
      const metadata = geminiMetadata.get(message.id)

      if (metadata) {
        // Convert 'system' type to 'assistant' for Gemini messages
        // (ClaudeCodeParser doesn't recognize 'gemini' type and defaults to 'system')
        if (message.type === 'system') {
          message.type = 'assistant'
        }

        // Add thoughts
        if (metadata.thoughts) {
          message.metadata = {
            ...message.metadata,
            thoughts: metadata.thoughts,
            thoughtCount: metadata.thoughts.length,
            hasThoughts: true,
          }
        }

        // Add tokens
        if (metadata.tokens) {
          const tokens = metadata.tokens
          message.metadata = {
            ...message.metadata,
            tokens,
            hasCachedTokens: tokens.cached > 0,
            hasThinkingTokens: tokens.thoughts > 0,
            cacheHitRate:
              tokens.input + tokens.cached > 0 ? tokens.cached / (tokens.input + tokens.cached) : 0,
            thinkingOverhead: tokens.output > 0 ? tokens.thoughts / tokens.output : 0,
          }
        }

        // Add model
        if (metadata.model) {
          message.metadata = {
            ...message.metadata,
            model: metadata.model,
          }
        }
      }
    }
  }

  /**
   * Add session-level Gemini metadata after parsing
   */
  private enhanceWithGeminiMetadata(session: ParsedSession): void {
    // Add session-level Gemini-specific metadata
    session.metadata = {
      ...session.metadata,
      hasThoughts: session.messages.some(m => m.metadata?.thoughts),
      hasCachedTokens: session.messages.some(m => m.metadata?.hasCachedTokens),
      totalThoughts: session.messages.reduce((sum, m) => sum + (m.metadata?.thoughtCount || 0), 0),
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
   * Calculate total token usage (Gemini-specific with thinking tokens)
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

    return {
      totalInput,
      totalOutput,
      totalCached,
      totalThoughts,
      totalTool,
      total,
      cacheHitRate:
        totalInput + totalCached > 0 ? totalCached / (totalInput + totalCached) : 0,
      thinkingOverhead: totalOutput > 0 ? totalThoughts / totalOutput : 0,
    }
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
      thinkingMessagePercentage:
        assistantMessages > 0 ? (thinkingMessages / assistantMessages) * 100 : 0,
    }
  }
}
