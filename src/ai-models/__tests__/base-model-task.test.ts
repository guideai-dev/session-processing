import { describe, it, expect } from 'vitest'
import { BaseModelTask } from '../base/model-task.js'
import type { ModelTaskConfig, ModelTaskContext } from '../base/types.js'
import { MOCK_CONTEXT } from './fixtures/mock-sessions.js'

// Define proper input/output types for test task
interface TestInput {
	variable: string
	sessionId: string
}

type TestOutput = string

class TestModelTask extends BaseModelTask<TestInput, TestOutput> {
	readonly taskType = 'test-task'
	readonly name = 'Test Task'
	readonly description = 'A test task'

	getConfig(): ModelTaskConfig {
		return {
			taskType: this.taskType,
			prompt: 'Test prompt with {{variable}}',
			responseFormat: { type: 'text' },
			recordingStrategy: {},
		}
	}

	prepareInput(context: ModelTaskContext): TestInput {
		return {
			variable: 'test-value',
			sessionId: context.sessionId,
		}
	}
}

// Define types for custom validation task
interface CustomValidationInput {
	// Empty input
}

type CustomValidationOutput = string

class CustomValidationTask extends BaseModelTask<CustomValidationInput, CustomValidationOutput> {
	readonly taskType = 'custom-validation'
	readonly name = 'Custom Validation Task'
	readonly description = 'Task with custom validation'

	getConfig(): ModelTaskConfig {
		return {
			taskType: this.taskType,
			prompt: 'Custom prompt',
			responseFormat: { type: 'text' },
			recordingStrategy: {},
		}
	}

	prepareInput(_context: ModelTaskContext): CustomValidationInput {
		return {}
	}

	canExecute(context: ModelTaskContext): boolean {
		return super.canExecute(context) && !!context.session
	}
}

// Define types for output processing task
interface OutputProcessingInput {
	// Empty input
}

interface OutputProcessingOutput {
	processed: boolean
	originalOutput: string
	timestamp: string
}

class OutputProcessingTask extends BaseModelTask<OutputProcessingInput, OutputProcessingOutput> {
	readonly taskType = 'output-processing'
	readonly name = 'Output Processing Task'
	readonly description = 'Task with custom output processing'

	getConfig(): ModelTaskConfig {
		return {
			taskType: this.taskType,
			prompt: 'Process output',
			responseFormat: { type: 'text' },
			recordingStrategy: {},
		}
	}

	prepareInput(_context: ModelTaskContext): OutputProcessingInput {
		return {}
	}

	processOutput(output: string, _context: ModelTaskContext): OutputProcessingOutput {
		return {
			processed: true,
			originalOutput: output,
			timestamp: new Date().toISOString(),
		}
	}
}

describe('BaseModelTask', () => {
	describe('Abstract Class Implementation', () => {
		it('should require taskType to be implemented', () => {
			const task = new TestModelTask()
			expect(task.taskType).toBe('test-task')
		})

		it('should require name to be implemented', () => {
			const task = new TestModelTask()
			expect(task.name).toBe('Test Task')
		})

		it('should require description to be implemented', () => {
			const task = new TestModelTask()
			expect(task.description).toBe('A test task')
		})

		it('should require getConfig to be implemented', () => {
			const task = new TestModelTask()
			const config = task.getConfig()

			expect(config).toBeDefined()
			expect(config.taskType).toBe('test-task')
			expect(config.prompt).toBeTruthy()
			expect(config.responseFormat).toBeDefined()
		})

		it('should require prepareInput to be implemented', () => {
			const task = new TestModelTask()
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input).toBeDefined()
			expect(input.variable).toBe('test-value')
		})
	})

	describe('Task Definition', () => {
		it('should return complete task definition', () => {
			const task = new TestModelTask()
			const definition = task.getDefinition()

			expect(definition.taskType).toBe('test-task')
			expect(definition.name).toBe('Test Task')
			expect(definition.description).toBe('A test task')
			expect(definition.config).toBeDefined()
			expect(definition.config.taskType).toBe('test-task')
		})

		it('should include config in definition', () => {
			const task = new TestModelTask()
			const definition = task.getDefinition()

			expect(definition.config.prompt).toBe('Test prompt with {{variable}}')
			expect(definition.config.responseFormat).toEqual({ type: 'text' })
		})
	})

	describe('Default Behaviors', () => {
		it('should have default canExecute that checks basic fields', () => {
			const task = new TestModelTask()

			expect(task.canExecute(MOCK_CONTEXT)).toBe(true)
		})

		it('should reject context missing sessionId', () => {
			const task = new TestModelTask()
			const invalidContext = { ...MOCK_CONTEXT, sessionId: '' }

			expect(task.canExecute(invalidContext)).toBe(false)
		})

		it('should reject context missing tenantId', () => {
			const task = new TestModelTask()
			const invalidContext = { ...MOCK_CONTEXT, tenantId: '' }

			expect(task.canExecute(invalidContext)).toBe(false)
		})

		it('should reject context missing userId', () => {
			const task = new TestModelTask()
			const invalidContext = { ...MOCK_CONTEXT, userId: '' }

			expect(task.canExecute(invalidContext)).toBe(false)
		})

		it('should have default processOutput that returns as-is', () => {
			const task = new TestModelTask()
			const output = 'test output'
			const result = task.processOutput(output, MOCK_CONTEXT)

			expect(result).toBe(output)
		})

		it('should handle object output in default processOutput', () => {
			const task = new TestModelTask()
			const output = { key: 'value', nested: { data: 123 } }
			const result = task.processOutput(output, MOCK_CONTEXT)

			expect(result).toEqual(output)
		})
	})

	describe('Custom Validation', () => {
		it('should allow tasks to override canExecute', () => {
			const task = new CustomValidationTask()

			expect(task.canExecute(MOCK_CONTEXT)).toBe(true)
		})

		it('should support custom validation logic', () => {
			const task = new CustomValidationTask()
			const contextWithoutSession = { ...MOCK_CONTEXT, session: undefined }

			expect(task.canExecute(contextWithoutSession)).toBe(false)
		})

		it('should still validate base requirements', () => {
			const task = new CustomValidationTask()
			const invalidContext = { ...MOCK_CONTEXT, sessionId: '' }

			expect(task.canExecute(invalidContext)).toBe(false)
		})
	})

	describe('Custom Output Processing', () => {
		it('should allow tasks to override processOutput', () => {
			const task = new OutputProcessingTask()
			const output = 'raw output'
			const result = task.processOutput(output, MOCK_CONTEXT)

			expect(result).toBeDefined()
			expect(result.processed).toBe(true)
			expect(result.originalOutput).toBe(output)
			expect(result.timestamp).toBeTruthy()
		})

		it('should support transforming output structure', () => {
			const task = new OutputProcessingTask()
			const output = { data: 'test' }
			const result = task.processOutput(output, MOCK_CONTEXT)

			expect(result.originalOutput).toEqual(output)
			expect(result.processed).toBe(true)
		})

		it('should receive context in processOutput', () => {
			const task = new OutputProcessingTask()
			const output = 'test'
			
			const result = task.processOutput(output, MOCK_CONTEXT)
			expect(result).toBeDefined()
		})
	})

	describe('Integration', () => {
		it('should work with different response format types', () => {
			interface JsonTaskInput {
				// Empty input
			}

			interface JsonTaskOutput {
				data: unknown
			}

			class JsonTask extends BaseModelTask<JsonTaskInput, JsonTaskOutput> {
				readonly taskType = 'json-task'
				readonly name = 'JSON Task'
				readonly description = 'Task with JSON response'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Return JSON',
						responseFormat: { type: 'json' },
						recordingStrategy: {},
					}
				}

				prepareInput(_context: ModelTaskContext): JsonTaskInput {
					return {}
				}
			}

			const task = new JsonTask()
			const config = task.getConfig()

			expect(config.responseFormat?.type).toBe('json')
		})

		it('should support recording strategies in config', () => {
			interface RecordingTaskInput {
				// Empty input
			}

			type RecordingTaskOutput = string

			class RecordingTask extends BaseModelTask<RecordingTaskInput, RecordingTaskOutput> {
				readonly taskType = 'recording-task'
				readonly name = 'Recording Task'
				readonly description = 'Task with recording strategy'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Record results',
						responseFormat: { type: 'text' },
						recordingStrategy: {
							updateAgentSession: ['field1', 'field2'],
						},
					}
				}

				prepareInput(_context: ModelTaskContext): RecordingTaskInput {
					return {}
				}
			}

			const task = new RecordingTask()
			const config = task.getConfig()

			expect(config.recordingStrategy).toBeDefined()
			expect(config.recordingStrategy?.updateAgentSession).toContain('field1')
			expect(config.recordingStrategy?.updateAgentSession).toContain('field2')
		})
	})
})
