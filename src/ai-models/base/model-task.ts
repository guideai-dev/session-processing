import type {
  ModelTaskConfig,
  ModelTaskDefinition,
  ModelTaskContext,
  ModelTaskResult,
} from './types.js'

/**
 * Base class for AI model tasks
 * Each task defines how to extract input from a session and what to do with the output
 */
export abstract class BaseModelTask {
  abstract readonly taskType: string
  abstract readonly name: string
  abstract readonly description: string

  /**
   * Get the task configuration (prompt, response format, recording strategy)
   */
  abstract getConfig(): ModelTaskConfig

  /**
   * Prepare input for the AI model from the session data
   */
  abstract prepareInput(context: ModelTaskContext): any

  /**
   * Process the output from the AI model
   * Can transform or validate the response before recording
   */
  processOutput(output: any, context: ModelTaskContext): any {
    // Default implementation: return as-is
    return output
  }

  /**
   * Validate that the task can be executed with the given context
   */
  canExecute(context: ModelTaskContext): boolean {
    // Default: can execute if we have basic context
    return !!(context.sessionId && context.tenantId && context.userId)
  }

  /**
   * Get task definition for registry
   */
  getDefinition(): ModelTaskDefinition {
    return {
      taskType: this.taskType,
      name: this.name,
      description: this.description,
      config: this.getConfig(),
    }
  }
}
