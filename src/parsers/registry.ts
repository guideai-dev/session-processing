/**
 * Unified Parser Registry
 *
 * Phase 2: Simplified to use only CanonicalParser for all providers.
 * All providers now write canonical JSONL format, eliminating the need
 * for provider-specific parsers.
 */

import type { SessionParser } from './base/types.js'
import { CanonicalParser } from './canonical/index.js'

export class ParserRegistry {
  private parsers = new Map<string, SessionParser>()

  constructor() {
    // Register the canonical parser (handles all providers)
    const canonicalParser = new CanonicalParser()
    this.register(canonicalParser)

    // Add aliases for all provider names to use canonical parser
    const providerAliases = [
      'claude-code',
      'claude',
      'gemini-code',
      'gemini',
      'github-copilot',
      'copilot',
      'codex',
      'opencode',
      'cursor',
    ]

    for (const alias of providerAliases) {
      this.parsers.set(alias, canonicalParser)
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
