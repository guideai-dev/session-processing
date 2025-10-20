/**
 * Unified Parser Registry
 *
 * Centralized registry for all provider parsers. Replaces the multiple
 * registries that existed in UI and backend code.
 */

import type { SessionParser } from './base/types.js'
import { ClaudeCodeParser } from './providers/claude-code/index.js'
import { CodexParser } from './providers/codex/index.js'
import { GeminiParser } from './providers/gemini/index.js'
import { CopilotParser } from './providers/github-copilot/index.js'
import { OpenCodeParser } from './providers/opencode/index.js'

export class ParserRegistry {
  private parsers = new Map<string, SessionParser>()

  constructor() {
    // Register all built-in parsers
    this.register(new ClaudeCodeParser())
    this.register(new GeminiParser())
    this.register(new CopilotParser())
    this.register(new CodexParser())
    this.register(new OpenCodeParser())

    // Add aliases for common provider names
    const claudeParser = this.parsers.get('claude-code')
    if (claudeParser) {
      this.parsers.set('claude', claudeParser)
    }

    const geminiParser = this.parsers.get('gemini-code')
    if (geminiParser) {
      this.parsers.set('gemini', geminiParser)
    }

    const copilotParser = this.parsers.get('github-copilot')
    if (copilotParser) {
      this.parsers.set('copilot', copilotParser)
    }
  }

  /**
   * Register a custom parser
   */
  register(parser: SessionParser): void {
    this.parsers.set(parser.name, parser)
    if (parser.providerName !== parser.name) {
      this.parsers.set(parser.providerName, parser)
    }
  }

  /**
   * Get a parser by provider name
   */
  getParser(provider: string): SessionParser | null {
    // Normalize provider name
    const normalizedProvider = provider.toLowerCase().trim()

    // Try exact match
    const exactMatch = this.parsers.get(normalizedProvider)
    if (exactMatch) {
      return exactMatch
    }

    // Try partial match
    for (const [name, parser] of this.parsers.entries()) {
      if (name.includes(normalizedProvider) || normalizedProvider.includes(name)) {
        return parser
      }
    }

    return null
  }

  /**
   * Auto-detect the correct parser for JSONL content
   */
  detectParser(jsonlContent: string): SessionParser | null {
    for (const parser of this.parsers.values()) {
      if (parser.canParse(jsonlContent)) {
        return parser
      }
    }
    return null
  }

  /**
   * Get all registered provider names
   */
  getRegisteredProviders(): string[] {
    return Array.from(new Set(this.parsers.values())).map(parser => parser.providerName)
  }

  /**
   * Check if a parser exists for a provider
   */
  hasParser(provider: string): boolean {
    return this.getParser(provider) !== null
  }
}

// Export singleton instance
export const parserRegistry = new ParserRegistry()
