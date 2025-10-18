import type { BaseProviderProcessor } from './base/index.js'
import { ClaudeCodeProcessor } from './providers/claude-code/index.js'
import { GitHubCopilotProcessor } from './providers/github-copilot/index.js'
import { CodexProcessor } from './providers/codex/index.js'
import { OpenCodeProcessor } from './providers/opencode/index.js'
import { GeminiProcessor } from './providers/gemini/index.js'

export class ProcessorRegistry {
  private processors = new Map<string, BaseProviderProcessor>()
  private static instance: ProcessorRegistry | null = null

  constructor() {
    this.registerDefaultProcessors()
  }

  /**
   * Get singleton instance of the registry
   */
  static getInstance(): ProcessorRegistry {
    if (!ProcessorRegistry.instance) {
      ProcessorRegistry.instance = new ProcessorRegistry()
    }
    return ProcessorRegistry.instance
  }

  /**
   * Register default processors
   */
  private registerDefaultProcessors(): void {
    this.register(new ClaudeCodeProcessor())
    this.register(new GitHubCopilotProcessor())
    this.register(new CodexProcessor())
    this.register(new OpenCodeProcessor())
    this.register(new GeminiProcessor())
  }

  /**
   * Register a provider processor
   */
  register(processor: BaseProviderProcessor): void {
    if (!processor.providerName) {
      throw new Error('Processor must have a providerName')
    }

    if (this.processors.has(processor.providerName)) {
      console.warn(
        `Processor for provider '${processor.providerName}' is already registered. Overwriting.`
      )
    }

    this.processors.set(processor.providerName, processor)
  }

  /**
   * Get a processor for a specific provider
   */
  getProcessor(providerName: string): BaseProviderProcessor | null {
    const processor = this.processors.get(providerName)
    if (!processor) {
      console.warn(`No processor found for provider: ${providerName}`)
      return null
    }
    return processor
  }

  /**
   * Check if a processor exists for a provider
   */
  hasProcessor(providerName: string): boolean {
    return this.processors.has(providerName)
  }

  /**
   * Get all registered provider names
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.processors.keys())
  }

  /**
   * Get processor information for all registered processors
   */
  getProcessorInfo(): Record<string, any> {
    const info: Record<string, any> = {}

    for (const [providerName, processor] of this.processors) {
      info[providerName] = {
        description: processor.description,
        metricProcessors: processor.getMetricProcessors().map(mp => ({
          name: mp.name,
          metricType: mp.metricType,
          description: mp.description,
        })),
      }
    }

    return info
  }

  /**
   * Automatically detect the best processor for given content
   */
  detectProcessor(content: string): BaseProviderProcessor | null {
    // Try each processor's canProcess method
    for (const [providerName, processor] of this.processors) {
      try {
        if (processor.canProcess(content)) {
          console.log(`Auto-detected provider: ${providerName}`)
          return processor
        }
      } catch (error) {
        console.warn(`Error checking processor ${providerName}:`, error)
        continue
      }
    }

    console.warn('No processor could handle the provided content')
    return null
  }

  /**
   * Process content with automatic provider detection
   */
  async processWithAutoDetection(
    content: string,
    context: { sessionId: string; tenantId: string; userId: string }
  ) {
    const processor = this.detectProcessor(content)
    if (!processor) {
      throw new Error('No suitable processor found for the provided content')
    }

    const processorContext = {
      ...context,
      provider: processor.providerName,
    }

    return await processor.processMetrics(content, processorContext)
  }

  /**
   * Validate that all required processors are registered
   */
  validateRegistry(): { isValid: boolean; missingProcessors: string[] } {
    const requiredProcessors = ['claude-code'] // Add more as needed
    const missingProcessors: string[] = []

    for (const required of requiredProcessors) {
      if (!this.hasProcessor(required)) {
        missingProcessors.push(required)
      }
    }

    return {
      isValid: missingProcessors.length === 0,
      missingProcessors,
    }
  }

  /**
   * Health check for all processors
   */
  async healthCheck(): Promise<Record<string, { status: 'ok' | 'error'; error?: string }>> {
    const results: Record<string, { status: 'ok' | 'error'; error?: string }> = {}

    for (const [providerName, processor] of this.processors) {
      try {
        // Test with minimal valid content
        const testContent = JSON.stringify({
          uuid: 'test',
          timestamp: new Date().toISOString(),
          type: 'user',
          message: { role: 'user', content: 'test' },
        })

        const canProcess = processor.canProcess(testContent)
        if (canProcess) {
          results[providerName] = { status: 'ok' }
        } else {
          results[providerName] = { status: 'error', error: 'Cannot process test content' }
        }
      } catch (error) {
        results[providerName] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }

    return results
  }

  /**
   * Get statistics about the registry
   */
  getStats(): {
    totalProcessors: number
    registeredProviders: string[]
    totalMetricProcessors: number
    processorsByMetricType: Record<string, number>
  } {
    const registeredProviders = this.getRegisteredProviders()
    let totalMetricProcessors = 0
    const processorsByMetricType: Record<string, number> = {}

    for (const processor of this.processors.values()) {
      const metricProcessors = processor.getMetricProcessors()
      totalMetricProcessors += metricProcessors.length

      for (const mp of metricProcessors) {
        processorsByMetricType[mp.metricType] = (processorsByMetricType[mp.metricType] || 0) + 1
      }
    }

    return {
      totalProcessors: this.processors.size,
      registeredProviders,
      totalMetricProcessors,
      processorsByMetricType,
    }
  }

  /**
   * Unregister a processor (useful for testing)
   */
  unregister(providerName: string): boolean {
    if (this.processors.has(providerName)) {
      this.processors.delete(providerName)
      console.log(`Unregistered processor for provider: ${providerName}`)
      return true
    }
    return false
  }

  /**
   * Clear all processors (useful for testing)
   */
  clear(): void {
    this.processors.clear()
    console.log('Cleared all processors from registry')
  }

  /**
   * Reset to default processors
   */
  reset(): void {
    this.clear()
    this.registerDefaultProcessors()
    console.log('Reset registry to default processors')
  }
}

// Export singleton instance
export const processorRegistry = ProcessorRegistry.getInstance()
