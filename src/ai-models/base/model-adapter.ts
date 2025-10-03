import type {
  ModelTaskConfig,
  ModelTaskDefinition,
  ModelTaskContext,
  ModelTaskResult,
  ModelAdapterConfig,
  ModelHealthCheck
} from './types.js'
import type { BaseModelTask } from './model-task.js'

/**
 * Base class for AI model adapters (Claude, OpenAI, etc.)
 * Handles communication with external AI APIs
 */
export abstract class BaseModelAdapter {
  abstract readonly name: string
  abstract readonly description: string

  protected config: ModelAdapterConfig

  constructor(config: ModelAdapterConfig) {
    this.config = config
  }

  /**
   * Execute a task with the AI model
   */
  abstract executeTask(
    task: BaseModelTask,
    context: ModelTaskContext
  ): Promise<ModelTaskResult>

  /**
   * Get all available tasks for this adapter
   */
  abstract getAvailableTasks(): BaseModelTask[]

  /**
   * Validate adapter configuration
   */
  validateConfig(): boolean {
    if (!this.config.apiKey || this.config.apiKey.trim().length === 0) {
      console.warn(`${this.name}: API key is missing or empty`)
      return false
    }
    return true
  }

  /**
   * Health check to verify the adapter is working
   */
  async healthCheck(): Promise<ModelHealthCheck> {
    const startTime = Date.now()

    try {
      if (!this.validateConfig()) {
        return {
          healthy: false,
          error: 'Invalid configuration'
        }
      }

      // Subclasses should override to perform actual health check
      return {
        healthy: true,
        latency: Date.now() - startTime
      }
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get adapter information for debugging
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      model: this.config.model,
      availableTasks: this.getAvailableTasks().map(task => task.getDefinition())
    }
  }

  /**
   * Format a prompt with context variables
   */
  protected formatPrompt(template: string, variables: Record<string, any>): string {
    let formatted = template

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`
      formatted = formatted.replace(new RegExp(placeholder, 'g'), String(value))
    }

    return formatted
  }

  /**
   * Calculate estimated cost based on tokens
   * Subclasses should override with their pricing model
   */
  protected calculateCost(tokensUsed: number): number {
    return 0 // Override in subclass
  }
}
