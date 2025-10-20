import type {
  ModelTaskConfig,
  ModelTaskContext,
  ModelTaskDefinition,
  ModelTaskResult,
} from './types.js'

/**
 * Base class for AI model tasks
 * Each task defines how to extract input from a session and what to do with the output
 *
 * @template TInput - The type of input prepared for the AI model
 * @template TOutput - The type of output expected from the AI model
 */
export abstract class BaseModelTask<TInput = unknown, TOutput = unknown> {
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
  abstract prepareInput(context: ModelTaskContext): TInput

  /**
   * Process the output from the AI model
   * Can transform or validate the response before recording
   */
  processOutput(output: TOutput, _context: ModelTaskContext): TOutput {
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
