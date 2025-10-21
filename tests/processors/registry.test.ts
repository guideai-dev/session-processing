import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProcessorRegistry } from '../../src/processors/registry.js'
import { BaseProviderProcessor } from '../../src/processors/base/provider-processor.js'
import { BaseMetricProcessor } from '../../src/processors/base/metric-processor.js'
import type { ParsedSession, ProcessorContext } from '../../src/processors/base/types.js'

class MockMetricProcessor extends BaseMetricProcessor {
	readonly name = 'mock-metric'
	readonly metricType = 'performance' as const
	readonly description = 'Mock metric processor'

	async process(_session: ParsedSession) {
		return {
			response_latency_ms: 100,
			task_completion_time_ms: 1000,
		}
	}
}

class MockProviderProcessor extends BaseProviderProcessor {
	readonly providerName = 'mock-provider'
	readonly description = 'Mock provider processor'

	parseSession(jsonlContent: string): ParsedSession {
		const lines = jsonlContent.split('\n').filter((line) => line.trim())
		const firstMessage = JSON.parse(lines[0])

		return {
			sessionId: 'mock-session-123',
			provider: this.providerName,
			startTime: new Date(),
			endTime: new Date(),
			duration: 1000,
			messages: [
				{
					id: 'msg-1',
					type: 'user',
					content: firstMessage.content || 'test',
					timestamp: new Date(),
				},
			],
		}
	}

	getMetricProcessors(): BaseMetricProcessor[] {
		return [new MockMetricProcessor()]
	}
}

class InvalidProviderProcessor extends BaseProviderProcessor {
	readonly providerName = ''
	readonly description = 'Invalid processor'

	parseSession(_jsonlContent: string): ParsedSession {
		throw new Error('Should not be called')
	}

	getMetricProcessors(): BaseMetricProcessor[] {
		return []
	}
}

describe('ProcessorRegistry', () => {
	let registry: ProcessorRegistry

	beforeEach(() => {
		registry = new ProcessorRegistry()
		registry.clear()
	})

	describe('Singleton Pattern', () => {
		it('should return the same instance', () => {
			const instance1 = ProcessorRegistry.getInstance()
			const instance2 = ProcessorRegistry.getInstance()
			expect(instance1).toBe(instance2)
		})

		it('should have default processors registered on getInstance', () => {
			const instance = ProcessorRegistry.getInstance()
			const providers = instance.getRegisteredProviders()
			expect(providers).toContain('claude-code')
			expect(providers).toContain('github-copilot')
			expect(providers).toContain('codex')
		})
	})

	describe('Registration', () => {
		it('should register a valid processor', () => {
			const processor = new MockProviderProcessor()
			registry.register(processor)

			expect(registry.hasProcessor('mock-provider')).toBe(true)
			expect(registry.getRegisteredProviders()).toContain('mock-provider')
		})

		it('should throw error when registering processor without providerName', () => {
			const processor = new InvalidProviderProcessor()
			expect(() => registry.register(processor)).toThrow('Processor must have a providerName')
		})

		it('should warn when registering duplicate processor', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
			const processor1 = new MockProviderProcessor()
			const processor2 = new MockProviderProcessor()

			registry.register(processor1)
			registry.register(processor2)

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Processor for provider 'mock-provider' is already registered")
			)
			consoleSpy.mockRestore()
		})

		it('should overwrite existing processor when registering duplicate', () => {
			const processor1 = new MockProviderProcessor()
			const processor2 = new MockProviderProcessor()

			registry.register(processor1)
			const firstInstance = registry.getProcessor('mock-provider')

			registry.register(processor2)
			const secondInstance = registry.getProcessor('mock-provider')

			expect(firstInstance).not.toBe(secondInstance)
			expect(secondInstance).toBe(processor2)
		})
	})

	describe('Retrieval', () => {
		it('should get existing processor', () => {
			const processor = new MockProviderProcessor()
			registry.register(processor)

			const retrieved = registry.getProcessor('mock-provider')
			expect(retrieved).toBe(processor)
		})

		it('should return null for non-existent processor', () => {
			const retrieved = registry.getProcessor('non-existent')

			expect(retrieved).toBeNull()
		})

		it('should check if processor exists', () => {
			const processor = new MockProviderProcessor()
			registry.register(processor)

			expect(registry.hasProcessor('mock-provider')).toBe(true)
			expect(registry.hasProcessor('non-existent')).toBe(false)
		})

		it('should get all registered provider names', () => {
			const processor1 = new MockProviderProcessor()
			registry.register(processor1)

			const providers = registry.getRegisteredProviders()
			expect(providers).toEqual(['mock-provider'])
		})
	})

	describe('Auto-detection', () => {
		it('should detect processor from valid content', () => {
			const processor = new MockProviderProcessor()
			registry.register(processor)

			const content = JSON.stringify({ content: 'test message' })
			const detected = registry.detectProcessor(content)

			expect(detected).toBe(processor)
		})

		it('should return null when no processor can handle content', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

			const detected = registry.detectProcessor('invalid content')

			expect(detected).toBeNull()
			consoleSpy.mockRestore()
		})

		it('should handle errors during detection gracefully', () => {
			const processor = new MockProviderProcessor()
			processor.canProcess = () => {
				throw new Error('Detection error')
			}
			registry.register(processor)

			const detected = registry.detectProcessor('test content')

			expect(detected).toBeNull()
		})

		it('should process content with auto-detection', async () => {
			const processor = new MockProviderProcessor()
			registry.register(processor)

			const content = JSON.stringify({ content: 'test message' })
			const context: ProcessorContext = {
				sessionId: 'test-session',
				provider: 'mock-provider',
				tenantId: 'test-tenant',
				userId: 'test-user',
			}

			const results = await registry.processWithAutoDetection(content, context)
			expect(results.length).toBeGreaterThan(0)
		})

		it('should throw error when no processor found during auto-detection processing', async () => {
			const context: ProcessorContext = {
				sessionId: 'test-session',
				provider: 'unknown',
				tenantId: 'test-tenant',
				userId: 'test-user',
			}

			await expect(
				registry.processWithAutoDetection('invalid content', context)
			).rejects.toThrow('No suitable processor found for the provided content')
		})
	})

	describe('Validation', () => {
		it('should validate registry with all required processors', () => {
			registry.reset()
			const validation = registry.validateRegistry()

			expect(validation.isValid).toBe(true)
			expect(validation.missingProcessors).toHaveLength(0)
		})

		it('should detect missing required processors', () => {
			registry.clear()

			const validation = registry.validateRegistry()

			expect(validation.isValid).toBe(false)
			expect(validation.missingProcessors).toContain('claude-code')
		})
	})

	describe('Health Check', () => {
		it('should perform health check on all processors', async () => {
			const processor = new MockProviderProcessor()
			registry.register(processor)

			const health = await registry.healthCheck()

			expect(health['mock-provider']).toBeDefined()
			expect(health['mock-provider'].status).toBe('ok')
		})

		it('should report error status for failing processors', async () => {
			const processor = new MockProviderProcessor()
			processor.canProcess = () => {
				throw new Error('Health check failed')
			}
			registry.register(processor)

			const health = await registry.healthCheck()

			expect(health['mock-provider'].status).toBe('error')
			expect(health['mock-provider'].error).toBe('Health check failed')
		})

		it('should report error for processors that cannot process test content', async () => {
			const processor = new MockProviderProcessor()
			processor.canProcess = () => false
			registry.register(processor)

			const health = await registry.healthCheck()

			expect(health['mock-provider'].status).toBe('error')
			expect(health['mock-provider'].error).toBe('Cannot process test content')
		})
	})

	describe('Statistics', () => {
		it('should get registry statistics', () => {
			const processor = new MockProviderProcessor()
			registry.register(processor)

			const stats = registry.getStats()

			expect(stats.totalProcessors).toBe(1)
			expect(stats.registeredProviders).toContain('mock-provider')
			expect(stats.totalMetricProcessors).toBe(1)
			expect(stats.processorsByMetricType).toHaveProperty('performance')
			expect(stats.processorsByMetricType.performance).toBe(1)
		})

		it('should get processor information', () => {
			const processor = new MockProviderProcessor()
			registry.register(processor)

			const info = registry.getProcessorInfo()

			expect(info['mock-provider']).toBeDefined()
			expect(info['mock-provider'].description).toBe('Mock provider processor')
			expect(info['mock-provider'].metricProcessors).toHaveLength(1)
			expect(info['mock-provider'].metricProcessors[0].name).toBe('mock-metric')
		})

		it('should count processors by metric type correctly', () => {
			const processor1 = new MockProviderProcessor()
			registry.register(processor1)

			class AnotherMockProcessor extends BaseProviderProcessor {
				readonly providerName = 'another-mock'
				readonly description = 'Another mock processor'

				parseSession(jsonlContent: string): ParsedSession {
					const lines = jsonlContent.split('\n').filter((line) => line.trim())
					const firstMessage = JSON.parse(lines[0])

					return {
						sessionId: 'mock-session-456',
						provider: this.providerName,
						startTime: new Date(),
						endTime: new Date(),
						duration: 1000,
						messages: [
							{
								id: 'msg-1',
								type: 'user',
								content: firstMessage.content || 'test',
								timestamp: new Date(),
							},
						],
					}
				}

				getMetricProcessors(): BaseMetricProcessor[] {
					return [new MockMetricProcessor()]
				}
			}
			const processor2 = new AnotherMockProcessor()
			registry.register(processor2)

			const stats = registry.getStats()

			expect(stats.totalMetricProcessors).toBe(2)
			expect(stats.processorsByMetricType.performance).toBe(2)
		})
	})

	describe('Management', () => {
		it('should unregister existing processor', () => {
			const processor = new MockProviderProcessor()
			registry.register(processor)

			const result = registry.unregister('mock-provider')

			expect(result).toBe(true)
			expect(registry.hasProcessor('mock-provider')).toBe(false)
		})

		it('should return false when unregistering non-existent processor', () => {
			const result = registry.unregister('non-existent')
			expect(result).toBe(false)
		})

		it('should clear all processors', () => {
			const processor = new MockProviderProcessor()
			registry.register(processor)

			registry.clear()

			expect(registry.getRegisteredProviders()).toHaveLength(0)
		})

		it('should reset to default processors', () => {
			registry.clear()
			expect(registry.getRegisteredProviders()).toHaveLength(0)

			registry.reset()

			const providers = registry.getRegisteredProviders()
			expect(providers).toContain('claude-code')
			expect(providers).toContain('github-copilot')
			expect(providers).toContain('codex')
		})
	})
})
