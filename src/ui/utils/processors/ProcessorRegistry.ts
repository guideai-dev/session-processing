/**
 * Processor Registry - Registry for message processors
 *
 * Manages the collection of message processors and provides lookup by provider name.
 * Uses the unified CanonicalMessageProcessor for all providers, as all providers now
 * output canonical JSONL format with provider-specific features preserved in providerMetadata.
 */

import type { BaseMessageProcessor } from './BaseMessageProcessor.js'
import { CanonicalMessageProcessor } from './CanonicalMessageProcessor.js'
import { GenericMessageProcessor } from './GenericMessageProcessor.js'

class MessageProcessorRegistry {
  private processors = new Map<string, BaseMessageProcessor>()
  private defaultProcessor: BaseMessageProcessor
  private canonicalProcessor: BaseMessageProcessor

  constructor() {
    this.defaultProcessor = new GenericMessageProcessor()
    this.canonicalProcessor = new CanonicalMessageProcessor()

    // Register canonical processor for all providers
    // All providers now output canonical format, so we use one universal processor
    this.processors.set('claude-code', this.canonicalProcessor)
    this.processors.set('gemini-code', this.canonicalProcessor)
    this.processors.set('codex', this.canonicalProcessor)
    this.processors.set('github-copilot', this.canonicalProcessor)
    this.processors.set('opencode', this.canonicalProcessor)
    this.processors.set('cursor', this.canonicalProcessor)
    this.processors.set('canonical', this.canonicalProcessor)

    // Keep generic processor as fallback
    this.register(this.defaultProcessor)
  }

  /**
   * Register a message processor
   */
  register(processor: BaseMessageProcessor): void {
    this.processors.set(processor.name, processor)
  }

  /**
   * Get a processor by provider name
   */
  getProcessor(provider: string): BaseMessageProcessor {
    // Normalize provider name
    const normalizedProvider = provider.toLowerCase().trim()

    // Try exact match
    const exactMatch = this.processors.get(normalizedProvider)
    if (exactMatch) {
      return exactMatch
    }

    // Try partial match (e.g., "claude" matches "claude-code")
    for (const [name, processor] of this.processors.entries()) {
      if (name.includes(normalizedProvider) || normalizedProvider.includes(name)) {
        return processor
      }
    }

    // Fallback to default processor
    return this.defaultProcessor
  }

  /**
   * Check if a processor exists for a provider
   */
  hasProcessor(provider: string): boolean {
    const normalizedProvider = provider.toLowerCase().trim()
    return this.processors.has(normalizedProvider)
  }

  /**
   * Get all registered processor names
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.processors.keys())
  }
}

// Export singleton instance
export const processorRegistry = new MessageProcessorRegistry()
