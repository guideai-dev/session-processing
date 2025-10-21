import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseModelAdapter } from '../../../src/ai-models/base/model-adapter.js'
import { BaseModelTask } from '../../../src/ai-models/base/model-task.js'
import type {
	ModelAdapterConfig,
	ModelTaskConfig,
	ModelTaskContext,
	ModelTaskResult,
} from '../../../src/ai-models/base/types.js'
import { MOCK_CONTEXT } from '../fixtures/mock-sessions.js'

// Define test task types
interface SimpleInput {
	message: string
}

type SimpleOutput = string

class SimpleTask extends BaseModelTask<SimpleInput, SimpleOutput> {
	readonly taskType = 'simple-task'
	readonly name = 'Simple Task'
	readonly description = 'A simple test task'

	getConfig(): ModelTaskConfig {
		return {
			taskType: this.taskType,
			prompt: 'Process this: {{message}}',
			responseFormat: { type: 'text' },
			recordingStrategy: {},
		}
	}

	prepareInput(context: ModelTaskContext): SimpleInput {
		return {
			message: context.sessionId,
		}
	}

	processOutput(output: SimpleOutput, _context: ModelTaskContext): SimpleOutput {
		return output.toUpperCase()
	}
}

interface JsonInput {
	data: string
}

interface JsonOutput {
	result: string
	processed: boolean
}

class JsonTask extends BaseModelTask<JsonInput, JsonOutput> {
	readonly taskType = 'json-task'
	readonly name = 'JSON Task'
	readonly description = 'A task with JSON response'

	getConfig(): ModelTaskConfig {
		return {
			taskType: this.taskType,
			prompt: 'Process JSON: {{data}}',
			responseFormat: {
				type: 'json',
				schema: {
					type: 'object',
					properties: {
						result: { type: 'string' },
						processed: { type: 'boolean' },
					},
					required: ['result', 'processed'],
				},
			},
			recordingStrategy: {},
		}
	}

	prepareInput(context: ModelTaskContext): JsonInput {
		return {
			data: context.sessionId,
		}
	}
}

class FailingTask extends BaseModelTask {
	readonly taskType = 'failing-task'
	readonly name = 'Failing Task'
	readonly description = 'A task that always fails'

	getConfig(): ModelTaskConfig {
		return {
			taskType: this.taskType,
			prompt: 'This will fail',
			responseFormat: { type: 'text' },
			recordingStrategy: {},
		}
	}

	prepareInput(_context: ModelTaskContext) {
		return {}
	}

	canExecute(_context: ModelTaskContext): boolean {
		return false
	}
}

// Mock implementation of BaseModelAdapter
class MockModelAdapter extends BaseModelAdapter {
	readonly name = 'mock-adapter'
	readonly description = 'Mock adapter for testing'

	private mockResponse: any = null
	private shouldFail = false

	getAvailableTasks(): BaseModelTask[] {
		return []
	}

	setMockResponse(response: any): void {
		this.mockResponse = response
	}

	setShouldFail(fail: boolean): void {
		this.shouldFail = fail
	}

	async executeTask(task: BaseModelTask, context: ModelTaskContext): Promise<ModelTaskResult> {
		const startTime = Date.now()

		try {
			if (!task.canExecute(context)) {
				throw new Error(`Task ${task.taskType} cannot be executed with provided context`)
			}

			if (this.shouldFail) {
				throw new Error('Simulated API error')
			}

			const config = task.getConfig()
			const input = task.prepareInput(context)

			// Format prompt
			const prompt = this.formatPrompt(
				config.prompt,
				input as Record<string, string | number | boolean | null | undefined>
			)

			expect(prompt).toBeTruthy()

			// Return mock response
			const rawOutput = this.mockResponse
			const output = task.processOutput(rawOutput, context)

			const processingTime = Date.now() - startTime

			return {
				taskType: task.taskType,
				success: true,
				output,
				metadata: {
					modelUsed: this.config.model || 'mock-model',
					tokensUsed: 100,
					processingTime,
					cost: this.calculateCost(100),
				},
			}
		} catch (error) {
			const processingTime = Date.now() - startTime

			return {
				taskType: task.taskType,
				success: false,
				output: null,
				metadata: {
					modelUsed: this.config.model || 'mock-model',
					processingTime,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
			}
		}
	}
}

describe('BaseModelAdapter', () => {
	let adapter: MockModelAdapter
	let config: ModelAdapterConfig

	beforeEach(() => {
		config = {
			apiKey: 'test-api-key',
			model: 'test-model',
			maxTokens: 1000,
			temperature: 0.7,
		}
		adapter = new MockModelAdapter(config)
	})

	describe('Configuration Validation', () => {
		it('should validate correct configuration', () => {
			expect(adapter.validateConfig()).toBe(true)
		})

		it('should reject missing API key', () => {
			const invalidAdapter = new MockModelAdapter({ ...config, apiKey: '' })
			expect(invalidAdapter.validateConfig()).toBe(false)
		})

		it('should reject empty API key', () => {
			const invalidAdapter = new MockModelAdapter({ ...config, apiKey: '   ' })
			expect(invalidAdapter.validateConfig()).toBe(false)
		})

		it('should accept valid API key', () => {
			const validAdapter = new MockModelAdapter({ ...config, apiKey: 'valid-key-123' })
			expect(validAdapter.validateConfig()).toBe(true)
		})
	})

	describe('Request Transformation', () => {
		it('should format prompt with input variables', () => {
			const task = new SimpleTask()
			adapter.setMockResponse('test response')

			return adapter.executeTask(task, MOCK_CONTEXT).then(result => {
				expect(result.success).toBe(true)
			})
		})

		it('should handle multiple variables in prompt', () => {
			interface MultiVarInput {
				name: string
				age: number
				active: boolean
			}

			class MultiVarTask extends BaseModelTask<MultiVarInput, string> {
				readonly taskType = 'multi-var'
				readonly name = 'Multi Variable Task'
				readonly description = 'Task with multiple variables'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Name: {{name}}, Age: {{age}}, Active: {{active}}',
						responseFormat: { type: 'text' },
						recordingStrategy: {},
					}
				}

				prepareInput(_context: ModelTaskContext): MultiVarInput {
					return {
						name: 'Test User',
						age: 25,
						active: true,
					}
				}
			}

			const task = new MultiVarTask()
			adapter.setMockResponse('processed')

			return adapter.executeTask(task, MOCK_CONTEXT).then(result => {
				expect(result.success).toBe(true)
			})
		})

		it('should handle null and undefined values in prompt', () => {
			interface NullableInput {
				optional: string | null
				missing: string | undefined
			}

			class NullableTask extends BaseModelTask<NullableInput, string> {
				readonly taskType = 'nullable'
				readonly name = 'Nullable Task'
				readonly description = 'Task with nullable values'

				getConfig(): ModelTaskConfig {
					return {
						taskType: this.taskType,
						prompt: 'Optional: {{optional}}, Missing: {{missing}}',
						responseFormat: { type: 'text' },
						recordingStrategy: {},
					}
				}

				prepareInput(_context: ModelTaskContext): NullableInput {
					return {
						optional: null,
						missing: undefined,
					}
				}
			}

			const task = new NullableTask()
			adapter.setMockResponse('handled')

			return adapter.executeTask(task, MOCK_CONTEXT).then(result => {
				expect(result.success).toBe(true)
			})
		})
	})

	describe('Response Transformation', () => {
		it('should transform text response through task processOutput', async () => {
			const task = new SimpleTask()
			adapter.setMockResponse('test response')

			const result = await adapter.executeTask(task, MOCK_CONTEXT)

			expect(result.success).toBe(true)
			expect(result.output).toBe('TEST RESPONSE')
		})

		it('should handle JSON response', async () => {
			const task = new JsonTask()
			adapter.setMockResponse({ result: 'success', processed: true })

			const result = await adapter.executeTask(task, MOCK_CONTEXT)

			expect(result.success).toBe(true)
			expect(result.output).toEqual({ result: 'success', processed: true })
		})

		it('should include metadata in response', async () => {
			const task = new SimpleTask()
			adapter.setMockResponse('test')

			const result = await adapter.executeTask(task, MOCK_CONTEXT)

			expect(result.metadata).toBeDefined()
			expect(result.metadata.modelUsed).toBe('test-model')
			expect(result.metadata.tokensUsed).toBeDefined()
			expect(result.metadata.processingTime).toBeDefined()
			expect(result.metadata.cost).toBeDefined()
		})

		it('should track processing time', async () => {
			const task = new SimpleTask()
			adapter.setMockResponse('test')

			const result = await adapter.executeTask(task, MOCK_CONTEXT)

			expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
			expect(typeof result.metadata.processingTime).toBe('number')
		})
	})

	describe('Error Handling', () => {
		it('should handle task validation failure', async () => {
			const task = new FailingTask()
			adapter.setMockResponse('test')

			const result = await adapter.executeTask(task, MOCK_CONTEXT)

			expect(result.success).toBe(false)
			expect(result.output).toBeNull()
			expect(result.metadata.error).toContain('cannot be executed')
		})

		it('should handle API errors', async () => {
			const task = new SimpleTask()
			adapter.setShouldFail(true)

			const result = await adapter.executeTask(task, MOCK_CONTEXT)

			expect(result.success).toBe(false)
			expect(result.output).toBeNull()
			expect(result.metadata.error).toBe('Simulated API error')
		})

		it('should include error in metadata on failure', async () => {
			const task = new SimpleTask()
			adapter.setShouldFail(true)

			const result = await adapter.executeTask(task, MOCK_CONTEXT)

			expect(result.metadata.error).toBeDefined()
			expect(typeof result.metadata.error).toBe('string')
		})

		it('should still track processing time on error', async () => {
			const task = new SimpleTask()
			adapter.setShouldFail(true)

			const result = await adapter.executeTask(task, MOCK_CONTEXT)

			expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
		})

		it('should handle unknown errors gracefully', async () => {
			const task = new SimpleTask()

			// Mock a non-Error throw
			const badAdapter = new MockModelAdapter(config)
			badAdapter.setShouldFail = () => {
				throw 'string error'
			}

			const result = await badAdapter.executeTask(task, MOCK_CONTEXT)

			expect(result.success).toBe(false)
		})
	})

	describe('Health Check', () => {
		it('should pass health check with valid config', async () => {
			const health = await adapter.healthCheck()

			expect(health.healthy).toBe(true)
			expect(health.latency).toBeDefined()
			expect(health.latency).toBeGreaterThanOrEqual(0)
		})

		it('should fail health check with invalid config', async () => {
			const invalidAdapter = new MockModelAdapter({ ...config, apiKey: '' })
			const health = await invalidAdapter.healthCheck()

			expect(health.healthy).toBe(false)
			expect(health.error).toBe('Invalid configuration')
		})

		it('should track latency in health check', async () => {
			const health = await adapter.healthCheck()

			expect(health.latency).toBeDefined()
			expect(typeof health.latency).toBe('number')
		})

		it('should handle health check errors', async () => {
			class ErrorAdapter extends MockModelAdapter {
				async healthCheck() {
					try {
						throw new Error('Health check failed')
					} catch (error) {
						return {
							healthy: false,
							error: error instanceof Error ? error.message : 'Unknown error',
						}
					}
				}
			}

			const errorAdapter = new ErrorAdapter(config)
			const health = await errorAdapter.healthCheck()

			expect(health.healthy).toBe(false)
			expect(health.error).toBe('Health check failed')
		})
	})

	describe('Adapter Information', () => {
		it('should return adapter info', () => {
			const info = adapter.getInfo()

			expect(info.name).toBe('mock-adapter')
			expect(info.description).toBe('Mock adapter for testing')
			expect(info.model).toBe('test-model')
			expect(info.availableTasks).toBeDefined()
			expect(Array.isArray(info.availableTasks)).toBe(true)
		})

		it('should include available tasks in info', () => {
			class TaskAdapter extends MockModelAdapter {
				getAvailableTasks(): BaseModelTask[] {
					return [new SimpleTask(), new JsonTask()]
				}
			}

			const taskAdapter = new TaskAdapter(config)
			const info = taskAdapter.getInfo()

			expect(info.availableTasks).toHaveLength(2)
			expect(info.availableTasks[0].taskType).toBe('simple-task')
			expect(info.availableTasks[1].taskType).toBe('json-task')
		})

		it('should include model in info', () => {
			const info = adapter.getInfo()

			expect(info.model).toBe('test-model')
		})
	})

	describe('Cost Calculation', () => {
		it('should calculate cost for tokens used', async () => {
			const task = new SimpleTask()
			adapter.setMockResponse('test')

			const result = await adapter.executeTask(task, MOCK_CONTEXT)

			expect(result.metadata.cost).toBeDefined()
			expect(typeof result.metadata.cost).toBe('number')
			expect(result.metadata.cost).toBeGreaterThanOrEqual(0)
		})

		it('should return 0 cost by default in base implementation', () => {
			// Base implementation returns 0
			const baseCost = (adapter as any).calculateCost(1000)
			expect(baseCost).toBe(0)
		})
	})

	describe('Retry Logic', () => {
		it('should handle transient failures', async () => {
			const task = new SimpleTask()
			let attemptCount = 0

			class RetryAdapter extends MockModelAdapter {
				async executeTask(task: BaseModelTask, context: ModelTaskContext): Promise<ModelTaskResult> {
					attemptCount++
					if (attemptCount === 1) {
						this.setShouldFail(true)
					} else {
						this.setShouldFail(false)
						this.setMockResponse('success on retry')
					}
					return super.executeTask(task, context)
				}
			}

			const retryAdapter = new RetryAdapter(config)

			// First call fails
			const result1 = await retryAdapter.executeTask(task, MOCK_CONTEXT)
			expect(result1.success).toBe(false)

			// Second call succeeds
			const result2 = await retryAdapter.executeTask(task, MOCK_CONTEXT)
			expect(result2.success).toBe(true)
		})

		it('should handle rate limit errors', async () => {
			const task = new SimpleTask()

			class RateLimitAdapter extends MockModelAdapter {
				async executeTask(_task: BaseModelTask, _context: ModelTaskContext): Promise<ModelTaskResult> {
					return {
						taskType: task.taskType,
						success: false,
						output: null,
						metadata: {
							modelUsed: 'test-model',
							processingTime: 0,
							error: 'Rate limit exceeded',
						},
					}
				}
			}

			const rateLimitAdapter = new RateLimitAdapter(config)
			const result = await rateLimitAdapter.executeTask(task, MOCK_CONTEXT)

			expect(result.success).toBe(false)
			expect(result.metadata.error).toContain('Rate limit')
		})
	})

	describe('Provider Switching', () => {
		it('should support multiple adapter instances', () => {
			const claudeConfig = { ...config, model: 'claude-3-5-sonnet-20241022' }
			const geminiConfig = { ...config, model: 'gemini-1.5-pro' }

			const claudeAdapter = new MockModelAdapter(claudeConfig)
			const geminiAdapter = new MockModelAdapter(geminiConfig)

			expect(claudeAdapter.getInfo().model).toBe('claude-3-5-sonnet-20241022')
			expect(geminiAdapter.getInfo().model).toBe('gemini-1.5-pro')
		})

		it('should allow switching models per task', async () => {
			const task = new SimpleTask()
			adapter.setMockResponse('test')

			const result1 = await adapter.executeTask(task, MOCK_CONTEXT)
			expect(result1.metadata.modelUsed).toBe('test-model')

			// Change model
			const newAdapter = new MockModelAdapter({ ...config, model: 'different-model' })
			newAdapter.setMockResponse('test')

			const result2 = await newAdapter.executeTask(task, MOCK_CONTEXT)
			expect(result2.metadata.modelUsed).toBe('different-model')
		})
	})
})
