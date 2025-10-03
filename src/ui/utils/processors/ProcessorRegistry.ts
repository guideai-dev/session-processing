/**
 * Processor Registry - Registry for message processors
 *
 * Manages the collection of message processors and provides lookup by provider name.
 * Supports Claude Code, Codex, OpenCode, and generic fallback processors.
 */

import { BaseMessageProcessor } from './BaseMessageProcessor.js'
import { ClaudeMessageProcessor } from './ClaudeMessageProcessor.js'
import { CodexMessageProcessor } from './CodexMessageProcessor.js'
import { OpenCodeMessageProcessor } from './OpenCodeMessageProcessor.js'
import { GenericMessageProcessor } from './GenericMessageProcessor.js'

class MessageProcessorRegistry {
  private processors = new Map<string, BaseMessageProcessor>()
  private defaultProcessor: BaseMessageProcessor

  constructor() {
    this.defaultProcessor = new GenericMessageProcessor()

    // Register built-in processors
    this.register(new ClaudeMessageProcessor())
    this.register(new CodexMessageProcessor())
    this.register(new OpenCodeMessageProcessor())
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
    if (this.processors.has(normalizedProvider)) {
      return this.processors.get(normalizedProvider)!
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
