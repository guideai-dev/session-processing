import { describe, it, expect } from 'vitest'
import { BaseModelTask } from '../../src/ai-models/base/model-task.js'
import type { ModelTaskConfig, ModelTaskContext } from '../../src/ai-models/base/types.js'
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

	describe('Different Task Types', () => {
		it('should support summary task type', () => {
			interface SummaryInput {
				sessionContent: string
			}

			interface SummaryOutput {
				summary: string
				highlights: string[]
			}

			class SummaryTask extends BaseModelTask<SummaryInput, SummaryOutput> {
				readonly taskType = 'session-summary'
				readonly name = 'Session Summary'
				readonly description = 'Generate session summary'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Summarize: {{sessionContent}}',
						responseFormat: { type: 'json' },
						recordingStrategy: { updateAgentSession: ['aiModelSummary'] },
					}
				}

				prepareInput(context: ModelTaskContext): SummaryInput {
					return {
						sessionContent: context.sessionId,
					}
				}
			}

			const task = new SummaryTask()
			expect(task.taskType).toBe('session-summary')
			expect(task.getConfig().recordingStrategy?.updateAgentSession).toContain('aiModelSummary')
		})

		it('should support phase analysis task type', () => {
			interface PhaseInput {
				transcript: string
			}

			interface PhaseOutput {
				phases: Array<{
					phaseType: string
					startStep: number
					endStep: number
				}>
			}

			class PhaseTask extends BaseModelTask<PhaseInput, PhaseOutput> {
				readonly taskType = 'session-phase-analysis'
				readonly name = 'Phase Analysis'
				readonly description = 'Analyze session phases'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Analyze phases: {{transcript}}',
						responseFormat: { type: 'json' },
						recordingStrategy: { updateAgentSession: ['aiModelPhaseAnalysis'] },
					}
				}

				prepareInput(_context: ModelTaskContext): PhaseInput {
					return {
						transcript: 'test transcript',
					}
				}
			}

			const task = new PhaseTask()
			expect(task.taskType).toBe('session-phase-analysis')
			expect(task.getConfig().recordingStrategy?.updateAgentSession).toContain(
				'aiModelPhaseAnalysis'
			)
		})

		it('should support quality assessment task type', () => {
			interface QualityInput {
				sessionData: string
			}

			interface QualityOutput {
				score: number
				factors: Record<string, number>
			}

			class QualityTask extends BaseModelTask<QualityInput, QualityOutput> {
				readonly taskType = 'quality-assessment'
				readonly name = 'Quality Assessment'
				readonly description = 'Assess session quality'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Assess quality: {{sessionData}}',
						responseFormat: { type: 'json' },
						recordingStrategy: { updateAgentSession: ['aiModelQuality'] },
					}
				}

				prepareInput(_context: ModelTaskContext): QualityInput {
					return {
						sessionData: 'test data',
					}
				}
			}

			const task = new QualityTask()
			expect(task.taskType).toBe('quality-assessment')
			expect(task.getConfig().recordingStrategy?.updateAgentSession).toContain('aiModelQuality')
		})
	})

	describe('Input Validation', () => {
		it('should reject missing required context fields', () => {
			const task = new TestModelTask()

			const invalidContexts = [
				{ ...MOCK_CONTEXT, sessionId: '' },
				{ ...MOCK_CONTEXT, tenantId: '' },
				{ ...MOCK_CONTEXT, userId: '' },
			]

			for (const ctx of invalidContexts) {
				expect(task.canExecute(ctx)).toBe(false)
			}
		})

		it('should validate custom input requirements', () => {
			interface StrictInput {
				requiredField: string
				optionalField?: string
			}

			type StrictOutput = string

			class StrictTask extends BaseModelTask<StrictInput, StrictOutput> {
				readonly taskType = 'strict-task'
				readonly name = 'Strict Task'
				readonly description = 'Task with strict validation'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Process: {{requiredField}}',
						responseFormat: { type: 'text' },
						recordingStrategy: {},
					}
				}

				prepareInput(context: ModelTaskContext): StrictInput {
					if (!context.session) {
						throw new Error('Session is required')
					}
					return {
						requiredField: context.sessionId,
					}
				}

				canExecute(context: ModelTaskContext): boolean {
					return super.canExecute(context) && !!context.session
				}
			}

			const task = new StrictTask()
			expect(task.canExecute(MOCK_CONTEXT)).toBe(true)

			const contextWithoutSession = { ...MOCK_CONTEXT, session: undefined }
			expect(task.canExecute(contextWithoutSession)).toBe(false)
		})

		it('should handle prepareInput errors gracefully', () => {
			interface ErrorInput {
				// Empty input
			}

			type ErrorOutput = string

			class ErrorTask extends BaseModelTask<ErrorInput, ErrorOutput> {
				readonly taskType = 'error-task'
				readonly name = 'Error Task'
				readonly description = 'Task that throws in prepareInput'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Test',
						responseFormat: { type: 'text' },
						recordingStrategy: {},
					}
				}

				prepareInput(_context: ModelTaskContext): ErrorInput {
					throw new Error('Input preparation failed')
				}
			}

			const task = new ErrorTask()
			expect(() => task.prepareInput(MOCK_CONTEXT)).toThrow('Input preparation failed')
		})
	})

	describe('Output Transformation and Validation', () => {
		it('should transform output to expected format', () => {
			interface TransformInput {
				// Empty input
			}

			interface TransformOutput {
				transformed: string
				timestamp: string
			}

			class TransformTask extends BaseModelTask<TransformInput, TransformOutput> {
				readonly taskType = 'transform-task'
				readonly name = 'Transform Task'
				readonly description = 'Task with output transformation'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Transform',
						responseFormat: { type: 'json' },
						recordingStrategy: {},
					}
				}

				prepareInput(_context: ModelTaskContext): TransformInput {
					return {}
				}

				processOutput(output: string, _context: ModelTaskContext): TransformOutput {
					return {
						transformed: output.toUpperCase(),
						timestamp: new Date().toISOString(),
					}
				}
			}

			const task = new TransformTask()
			const result = task.processOutput('test', MOCK_CONTEXT)

			expect(result.transformed).toBe('TEST')
			expect(result.timestamp).toBeTruthy()
		})

		it('should validate output structure', () => {
			interface ValidatedInput {
				// Empty input
			}

			interface ValidatedOutput {
				valid: boolean
				data: string
			}

			class ValidatedTask extends BaseModelTask<ValidatedInput, ValidatedOutput> {
				readonly taskType = 'validated-task'
				readonly name = 'Validated Task'
				readonly description = 'Task with output validation'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Validate',
						responseFormat: { type: 'json' },
						recordingStrategy: {},
					}
				}

				prepareInput(_context: ModelTaskContext): ValidatedInput {
					return {}
				}

				processOutput(output: any, _context: ModelTaskContext): ValidatedOutput {
					if (typeof output !== 'object' || !output.data) {
						throw new Error('Invalid output format')
					}
					return {
						valid: true,
						data: output.data,
					}
				}
			}

			const task = new ValidatedTask()

			expect(() => task.processOutput('invalid', MOCK_CONTEXT)).toThrow('Invalid output format')

			expect(() => task.processOutput({}, MOCK_CONTEXT)).toThrow('Invalid output format')

			const result = task.processOutput({ data: 'valid' }, MOCK_CONTEXT)
			expect(result.valid).toBe(true)
			expect(result.data).toBe('valid')
		})

		it('should enrich output with context data', () => {
			interface EnrichInput {
				// Empty input
			}

			interface EnrichOutput {
				originalOutput: string
				sessionId: string
				tenantId: string
				processedAt: string
			}

			class EnrichTask extends BaseModelTask<EnrichInput, EnrichOutput> {
				readonly taskType = 'enrich-task'
				readonly name = 'Enrich Task'
				readonly description = 'Task that enriches output with context'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Enrich',
						responseFormat: { type: 'text' },
						recordingStrategy: {},
					}
				}

				prepareInput(_context: ModelTaskContext): EnrichInput {
					return {}
				}

				processOutput(output: string, context: ModelTaskContext): EnrichOutput {
					return {
						originalOutput: output,
						sessionId: context.sessionId,
						tenantId: context.tenantId,
						processedAt: new Date().toISOString(),
					}
				}
			}

			const task = new EnrichTask()
			const result = task.processOutput('test output', MOCK_CONTEXT)

			expect(result.originalOutput).toBe('test output')
			expect(result.sessionId).toBe(MOCK_CONTEXT.sessionId)
			expect(result.tenantId).toBe(MOCK_CONTEXT.tenantId)
			expect(result.processedAt).toBeTruthy()
		})
	})

	describe('Error Propagation', () => {
		it('should propagate errors from prepareInput', () => {
			interface ErrorInput {
				// Empty input
			}

			type ErrorOutput = string

			class PrepareErrorTask extends BaseModelTask<ErrorInput, ErrorOutput> {
				readonly taskType = 'prepare-error'
				readonly name = 'Prepare Error Task'
				readonly description = 'Task that errors in prepareInput'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Test',
						responseFormat: { type: 'text' },
						recordingStrategy: {},
					}
				}

				prepareInput(_context: ModelTaskContext): ErrorInput {
					throw new Error('Failed to prepare input')
				}
			}

			const task = new PrepareErrorTask()
			expect(() => task.prepareInput(MOCK_CONTEXT)).toThrow('Failed to prepare input')
		})

		it('should propagate errors from processOutput', () => {
			interface OutputErrorInput {
				// Empty input
			}

			type OutputErrorOutput = string

			class ProcessErrorTask extends BaseModelTask<OutputErrorInput, OutputErrorOutput> {
				readonly taskType = 'process-error'
				readonly name = 'Process Error Task'
				readonly description = 'Task that errors in processOutput'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Test',
						responseFormat: { type: 'text' },
						recordingStrategy: {},
					}
				}

				prepareInput(_context: ModelTaskContext): OutputErrorInput {
					return {}
				}

				processOutput(_output: OutputErrorOutput, _context: ModelTaskContext): OutputErrorOutput {
					throw new Error('Failed to process output')
				}
			}

			const task = new ProcessErrorTask()
			expect(() => task.processOutput('test', MOCK_CONTEXT)).toThrow('Failed to process output')
		})

		it('should handle validation errors in canExecute', () => {
			interface ValidationInput {
				// Empty input
			}

			type ValidationOutput = string

			class ValidationErrorTask extends BaseModelTask<ValidationInput, ValidationOutput> {
				readonly taskType = 'validation-error'
				readonly name = 'Validation Error Task'
				readonly description = 'Task with validation errors'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Test',
						responseFormat: { type: 'text' },
						recordingStrategy: {},
					}
				}

				prepareInput(_context: ModelTaskContext): ValidationInput {
					return {}
				}

				canExecute(context: ModelTaskContext): boolean {
					if (!super.canExecute(context)) {
						return false
					}

					if (!context.session || context.session.messages.length === 0) {
						return false
					}

					return true
				}
			}

			const task = new ValidationErrorTask()

			// Valid context
			expect(task.canExecute(MOCK_CONTEXT)).toBe(true)

			// Context without session
			const noSession = { ...MOCK_CONTEXT, session: undefined }
			expect(task.canExecute(noSession)).toBe(false)

			// Context with empty messages
			const emptyMessages = {
				...MOCK_CONTEXT,
				session: { ...MOCK_CONTEXT.session, messages: [] },
			}
			expect(task.canExecute(emptyMessages)).toBe(false)
		})
	})
})
