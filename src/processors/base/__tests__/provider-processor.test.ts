import { describe, it, expect, vi } from 'vitest'
import {
	TestProviderProcessor,
	ErrorThrowingProviderProcessor,
	TestMetricProcessor,
	ErrorThrowingMetricProcessor,
	VALID_JSONL_CONTENT,
	INVALID_JSONL_CONTENT,
	EMPTY_CONTENT,
} from './fixtures/mock-processors.js'
import type { ProcessorContext } from '../types.js'

describe('BaseProviderProcessor', () => {
	describe('JSONL Validation', () => {
		it('should validate valid JSONL content', () => {
			const processor = new TestProviderProcessor()
			expect(() => processor.parseSession(VALID_JSONL_CONTENT)).not.toThrow()
		})

		it('should throw error for empty content', () => {
			const processor = new TestProviderProcessor()
			expect(() => processor.parseSession(EMPTY_CONTENT)).toThrow('Content is empty')
		})

		it('should throw error for content with no valid lines', () => {
			const processor = new TestProviderProcessor()
			const whitespaceContent = '   \n  \n  '
			expect(() => processor.parseSession(whitespaceContent)).toThrow('Content is empty')
		})

		it('should throw error for invalid JSON', () => {
			const processor = new TestProviderProcessor()
			expect(() => processor.parseSession(INVALID_JSONL_CONTENT)).toThrow(/Invalid JSON on line/)
		})

		it('should validate first few lines as JSON and succeed if first 3 are valid', () => {
			const processor = new TestProviderProcessor()
			const mixedContent = `{"type":"user","content":"valid"}
{"type":"assistant","content":"also valid"}
{"type":"user","content":"still valid"}`

			expect(() => processor.parseSession(mixedContent)).not.toThrow()
		})
	})

	describe('canProcess', () => {
		it('should return true for valid JSONL content', () => {
			const processor = new TestProviderProcessor()
			expect(processor.canProcess(VALID_JSONL_CONTENT)).toBe(true)
		})

		it('should return false for invalid JSON', () => {
			const processor = new TestProviderProcessor()
			expect(processor.canProcess('not json')).toBe(false)
		})

		it('should return false for empty content', () => {
			const processor = new TestProviderProcessor()
			expect(processor.canProcess('')).toBe(false)
		})

		it('should return false for content with only whitespace', () => {
			const processor = new TestProviderProcessor()
			expect(processor.canProcess('   \n  \n  ')).toBe(false)
		})

		it('should validate first line is parseable JSON', () => {
			const processor = new TestProviderProcessor()
			const validContent = '{"test": "valid"}\ninvalid line here'
			expect(processor.canProcess(validContent)).toBe(true)
		})
	})

	describe('Session Parsing', () => {
		it('should parse valid JSONL content into session', () => {
			const processor = new TestProviderProcessor()
			const session = processor.parseSession(VALID_JSONL_CONTENT)

			expect(session.sessionId).toBe('test-session-123')
			expect(session.provider).toBe('test-provider')
			expect(session.messages.length).toBe(3)
			expect(session.startTime).toBeInstanceOf(Date)
			expect(session.endTime).toBeInstanceOf(Date)
			expect(session.duration).toBeGreaterThan(0)
		})

		it('should parse timestamps correctly', () => {
			const processor = new TestProviderProcessor()
			const session = processor.parseSession(VALID_JSONL_CONTENT)

			expect(session.messages[0].timestamp).toEqual(new Date('2025-01-01T00:00:00Z'))
			expect(session.messages[2].timestamp).toEqual(new Date('2025-01-01T00:00:05Z'))
		})

		it('should parse message types correctly', () => {
			const processor = new TestProviderProcessor()
			const session = processor.parseSession(VALID_JSONL_CONTENT)

			expect(session.messages[0].type).toBe('user')
			expect(session.messages[1].type).toBe('assistant')
		})

		it('should parse message content correctly', () => {
			const processor = new TestProviderProcessor()
			const session = processor.parseSession(VALID_JSONL_CONTENT)

			expect(session.messages[0].content).toBe('Hello')
			expect(session.messages[1].content).toBe('Hi there')
		})
	})

	describe('Sequential Metric Processing', () => {
		it('should process metrics sequentially', async () => {
			const processor = new TestProviderProcessor()
			const context: ProcessorContext = {
				sessionId: 'test-123',
				provider: 'test-provider',
				tenantId: 'test-tenant',
				userId: 'test-user',
			}

			const results = await processor.processMetrics(VALID_JSONL_CONTENT, context)

			expect(results.length).toBeGreaterThan(0)
			expect(results[0].metricType).toBe('performance')
		})

		it('should return successful results with metrics', async () => {
			const processor = new TestProviderProcessor()
			const context: ProcessorContext = {
				sessionId: 'test-123',
				provider: 'test-provider',
				tenantId: 'test-tenant',
				userId: 'test-user',
			}

			const results = await processor.processMetrics(VALID_JSONL_CONTENT, context)

			expect(results.length).toBeGreaterThan(0)
			expect(results[0].metrics).toBeDefined()
		})

		it('should handle processor errors gracefully', async () => {
			class MetricErrorProcessor extends TestProviderProcessor {
				getMetricProcessors() {
					return [new ErrorThrowingMetricProcessor()]
				}
			}

			const processor = new MetricErrorProcessor()
			const context: ProcessorContext = {
				sessionId: 'test-123',
				provider: 'test-provider',
				tenantId: 'test-tenant',
				userId: 'test-user',
			}

			const results = await processor.processMetrics(VALID_JSONL_CONTENT, context)

			expect(results.length).toBe(0)
		})

		it('should skip processors that cannot process session', async () => {
			class SkippingProcessor extends TestProviderProcessor {
				getMetricProcessors() {
					const processor = new TestMetricProcessor()
					processor.canProcess = () => false
					return [processor]
				}
			}

			const processor = new SkippingProcessor()
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
			const context: ProcessorContext = {
				sessionId: 'test-123',
				provider: 'test-provider',
				tenantId: 'test-tenant',
				userId: 'test-user',
			}

			const results = await processor.processMetrics(VALID_JSONL_CONTENT, context)

			expect(results.length).toBe(0)
		})

		it('should warn when processor returns null/empty result', async () => {
			class NullResultProcessor extends TestProviderProcessor {
				getMetricProcessors() {
					const processor = new TestMetricProcessor()
					processor.process = async () => null as any
					return [processor]
				}
			}

			const processor = new NullResultProcessor()
			const context: ProcessorContext = {
				sessionId: 'test-123',
				provider: 'test-provider',
				tenantId: 'test-tenant',
				userId: 'test-user',
			}

			const results = await processor.processMetrics(VALID_JSONL_CONTENT, context)

			expect(results.length).toBe(0)
		})

		it('should warn when no processors succeed', async () => {
			class AllErrorsProcessor extends TestProviderProcessor {
				getMetricProcessors() {
					return [new ErrorThrowingMetricProcessor()]
				}
			}

			const processor = new AllErrorsProcessor()
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
			const context: ProcessorContext = {
				sessionId: 'test-123',
				provider: 'test-provider',
				tenantId: 'test-tenant',
				userId: 'test-user',
			}

			await processor.processMetrics(VALID_JSONL_CONTENT, context)

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('⚠ WARNING: NO processors succeeded'))
			consoleSpy.mockRestore()
		})

		it('should return only successful results', async () => {
			class MixedResultsProcessor extends TestProviderProcessor {
				getMetricProcessors() {
					return [new TestMetricProcessor(), new ErrorThrowingMetricProcessor()]
				}
			}

			const processor = new MixedResultsProcessor()
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
			const context: ProcessorContext = {
				sessionId: 'test-123',
				provider: 'test-provider',
				tenantId: 'test-tenant',
				userId: 'test-user',
			}

			const results = await processor.processMetrics(VALID_JSONL_CONTENT, context)

			expect(results.length).toBe(1)
			expect(results[0].metricType).toBe('performance')
			consoleSpy.mockRestore()
		})
	})

	describe('Helper Methods', () => {
		it('should parse valid timestamp', () => {
			class HelperTestProcessor extends TestProviderProcessor {
				testParseTimestamp(timestamp: string | undefined) {
					return this.parseTimestamp(timestamp)
				}
			}

			const processor = new HelperTestProcessor()
			const date = processor.testParseTimestamp('2025-01-01T00:00:00Z')

			expect(date).toBeInstanceOf(Date)
			expect(date?.toISOString()).toBe('2025-01-01T00:00:00.000Z')
		})

		it('should return null for invalid timestamp', () => {
			class HelperTestProcessor extends TestProviderProcessor {
				testParseTimestamp(timestamp: string | undefined) {
					return this.parseTimestamp(timestamp)
				}
			}

			const processor = new HelperTestProcessor()

			const date = processor.testParseTimestamp('invalid-date')

			expect(date).toBeNull()
		})

		it('should return null for undefined timestamp', () => {
			class HelperTestProcessor extends TestProviderProcessor {
				testParseTimestamp(timestamp: string | undefined) {
					return this.parseTimestamp(timestamp)
				}
			}

			const processor = new HelperTestProcessor()
			const date = processor.testParseTimestamp(undefined)

			expect(date).toBeNull()
		})

		it('should calculate duration between dates', () => {
			class HelperTestProcessor extends TestProviderProcessor {
				testCalculateDuration(start: Date | null, end: Date | null) {
					return this.calculateDuration(start, end)
				}
			}

			const processor = new HelperTestProcessor()
			const start = new Date('2025-01-01T00:00:00Z')
			const end = new Date('2025-01-01T00:00:10Z')

			const duration = processor.testCalculateDuration(start, end)
			expect(duration).toBe(10000)
		})

		it('should return 0 for null start time', () => {
			class HelperTestProcessor extends TestProviderProcessor {
				testCalculateDuration(start: Date | null, end: Date | null) {
					return this.calculateDuration(start, end)
				}
			}

			const processor = new HelperTestProcessor()
			const duration = processor.testCalculateDuration(null, new Date())

			expect(duration).toBe(0)
		})

		it('should return 0 for null end time', () => {
			class HelperTestProcessor extends TestProviderProcessor {
				testCalculateDuration(start: Date | null, end: Date | null) {
					return this.calculateDuration(start, end)
				}
			}

			const processor = new HelperTestProcessor()
			const duration = processor.testCalculateDuration(new Date(), null)

			expect(duration).toBe(0)
		})

		it('should return 0 for negative duration', () => {
			class HelperTestProcessor extends TestProviderProcessor {
				testCalculateDuration(start: Date | null, end: Date | null) {
					return this.calculateDuration(start, end)
				}
			}

			const processor = new HelperTestProcessor()
			const start = new Date('2025-01-01T00:00:10Z')
			const end = new Date('2025-01-01T00:00:00Z')

			const duration = processor.testCalculateDuration(start, end)
			expect(duration).toBe(0)
		})

		it('should generate message ID with timestamp', () => {
			class HelperTestProcessor extends TestProviderProcessor {
				testGenerateMessageId(index: number, timestamp?: Date) {
					return this.generateMessageId(index, timestamp)
				}
			}

			const processor = new HelperTestProcessor()
			const timestamp = new Date('2025-01-01T00:00:00Z')
			const id = processor.testGenerateMessageId(5, timestamp)

			expect(id).toBe(`msg_${timestamp.getTime()}_5`)
		})

		it('should generate message ID without timestamp', () => {
			class HelperTestProcessor extends TestProviderProcessor {
				testGenerateMessageId(index: number, timestamp?: Date) {
					return this.generateMessageId(index, timestamp)
				}
			}

			const processor = new HelperTestProcessor()
			const id = processor.testGenerateMessageId(3)

			expect(id).toMatch(/^msg_\d+_3$/)
		})
	})
})
