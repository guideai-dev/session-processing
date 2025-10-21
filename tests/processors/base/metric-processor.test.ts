import { describe, it, expect } from 'vitest'
import { BaseMetricProcessor } from '../../../src/processors/base/metric-processor.js'
import {
	TestMetricProcessor,
	ErrorThrowingMetricProcessor,
	ValidationFailingMetricProcessor,
	VALID_SESSION,
	SESSION_WITHOUT_ID,
	SESSION_WITHOUT_MESSAGES,
} from './fixtures/mock-processors.js'
import type { ParsedSession } from '../types.js'

describe('BaseMetricProcessor', () => {
	describe('Session Validation', () => {
		it('should validate session with valid data', async () => {
			const processor = new TestMetricProcessor()
			const result = await processor.processToResult(VALID_SESSION)

			expect(result).toBeDefined()
			expect(result.metricType).toBe('performance')
			expect(result.metrics).toBeDefined()
		})

		it('should throw error for session without ID', async () => {
			const processor = new ValidationFailingMetricProcessor()

			await expect(processor.processToResult(SESSION_WITHOUT_ID)).rejects.toThrow(
				'Session ID is required'
			)
		})

		it('should throw error for session without messages', async () => {
			const processor = new ValidationFailingMetricProcessor()

			await expect(processor.processToResult(SESSION_WITHOUT_MESSAGES)).rejects.toThrow(
				'Session must contain messages'
			)
		})
	})

	describe('Result Creation and Timing', () => {
		it('should create result with metrics and timing information', async () => {
			const processor = new TestMetricProcessor()
			const result = await processor.processToResult(VALID_SESSION)

			expect(result.metricType).toBe('performance')
			expect(result.metrics).toEqual({
				response_latency_ms: VALID_SESSION.duration,
				task_completion_time_ms: VALID_SESSION.duration * 2,
			})
			expect(result.processingTime).toBeGreaterThanOrEqual(0)
			expect(result.metadata).toBeDefined()
			expect(result.metadata?.processor).toBe('test-metric')
			expect(result.metadata?.messageCount).toBe(VALID_SESSION.messages.length)
			expect(result.metadata?.sessionDuration).toBe(VALID_SESSION.duration)
		})

		it('should track processing time', async () => {
			const processor = new TestMetricProcessor()
			const result = await processor.processToResult(VALID_SESSION)

			expect(result.processingTime).toBeDefined()
			expect(result.processingTime).toBeGreaterThanOrEqual(0)
		})

		it('should include processing time in metadata', async () => {
			const processor = new TestMetricProcessor()
			const result = await processor.processToResult(VALID_SESSION)

			expect(result.metadata?.processingTime).toBeDefined()
			expect(result.metadata?.processingTime).toBe(result.processingTime)
		})
	})

	describe('Error Handling', () => {
		it('should throw error with timing information on processing failure', async () => {
			const processor = new ErrorThrowingMetricProcessor()

			await expect(processor.processToResult(VALID_SESSION)).rejects.toThrow(
				/error-metric processor failed.*Intentional processing error.*processing time:/
			)
		})

		it('should include processor name in error message', async () => {
			const processor = new ErrorThrowingMetricProcessor()

			await expect(processor.processToResult(VALID_SESSION)).rejects.toThrow('error-metric processor failed')
		})

		it('should include original error message in error', async () => {
			const processor = new ErrorThrowingMetricProcessor()

			await expect(processor.processToResult(VALID_SESSION)).rejects.toThrow('Intentional processing error')
		})
	})

	describe('Helper Methods', () => {
		it('should find messages by single type', () => {
			class HelperTestProcessor extends TestMetricProcessor {
				testFindMessagesByType(session: ParsedSession, type: string) {
					return this.findMessagesByType(session, type)
				}
			}

			const processor = new HelperTestProcessor()
			const userMessages = processor.testFindMessagesByType(VALID_SESSION, 'user')

			expect(userMessages.length).toBe(2)
			expect(userMessages.every((msg) => msg.type === 'user')).toBe(true)
		})

		it('should find messages by multiple types', () => {
			class HelperTestProcessor extends TestMetricProcessor {
				testFindMessagesByType(session: ParsedSession, types: string[]) {
					return this.findMessagesByType(session, types)
				}
			}

			const processor = new HelperTestProcessor()
			const messages = processor.testFindMessagesByType(VALID_SESSION, ['user', 'assistant'])

			expect(messages.length).toBe(4)
		})

		it('should return empty array when no messages match type', () => {
			class HelperTestProcessor extends TestMetricProcessor {
				testFindMessagesByType(session: ParsedSession, type: string) {
					return this.findMessagesByType(session, type)
				}
			}

			const processor = new HelperTestProcessor()
			const messages = processor.testFindMessagesByType(VALID_SESSION, 'nonexistent')

			expect(messages).toEqual([])
		})

		it('should calculate time difference between dates', () => {
			class HelperTestProcessor extends TestMetricProcessor {
				testCalculateTimeDifference(start: Date, end: Date) {
					return this.calculateTimeDifference(start, end)
				}
			}

			const processor = new HelperTestProcessor()
			const start = new Date('2025-01-01T00:00:00Z')
			const end = new Date('2025-01-01T00:00:10Z')

			const diff = processor.testCalculateTimeDifference(start, end)
			expect(diff).toBe(10000)
		})

		it('should extract string content from message', () => {
			class HelperTestProcessor extends TestMetricProcessor {
				testExtractContent(message: ParsedSession['messages'][0]) {
					return this.extractContent(message)
				}
			}

			const processor = new HelperTestProcessor()
			const message = VALID_SESSION.messages[0]

			const content = processor.testExtractContent(message)
			expect(content).toBe('Hello')
		})

		it('should extract text content from object with text property', () => {
			class HelperTestProcessor extends TestMetricProcessor {
				testExtractContent(message: ParsedSession['messages'][0]) {
					return this.extractContent(message)
				}
			}

			const processor = new HelperTestProcessor()
			const message = VALID_SESSION.messages[3]

			const content = processor.testExtractContent(message)
			expect(content).toBe('I am doing well, thank you!')
		})

		it('should stringify content when neither string nor object with text', () => {
			class HelperTestProcessor extends TestMetricProcessor {
				testExtractContent(message: ParsedSession['messages'][0]) {
					return this.extractContent(message)
				}
			}

			const processor = new HelperTestProcessor()
			const message: ParsedSession['messages'][0] = {
				id: 'msg-1',
				type: 'user' as const,
				content: { data: 'complex object' },
				timestamp: new Date(),
			}

			const content = processor.testExtractContent(message)
			expect(content).toBe('{"data":"complex object"}')
		})

		it('should handle empty content', () => {
			class HelperTestProcessor extends TestMetricProcessor {
				testExtractContent(message: ParsedSession['messages'][0]) {
					return this.extractContent(message)
				}
			}

			const processor = new HelperTestProcessor()
			const message: ParsedSession['messages'][0] = {
				id: 'msg-1',
				type: 'user' as const,
				content: null,
				timestamp: new Date(),
			}

			const content = processor.testExtractContent(message)
			expect(content).toBe('""')
		})
	})

	describe('canProcess', () => {
		it('should return true by default', () => {
			const processor = new TestMetricProcessor()
			expect(processor.canProcess(VALID_SESSION)).toBe(true)
		})

		it('should allow subclasses to override canProcess', () => {
			class SelectiveProcessor extends TestMetricProcessor {
				canProcess(session: ParsedSession): boolean {
					return session.messages.length > 5
				}
			}

			const processor = new SelectiveProcessor()
			expect(processor.canProcess(VALID_SESSION)).toBe(false)

			const longSession: ParsedSession = {
				...VALID_SESSION,
				messages: [...Array(10)].map((_, i) => ({
					id: `msg-${i}`,
					type: 'user' as const,
					content: 'test',
					timestamp: new Date(),
				})),
			}
			expect(processor.canProcess(longSession)).toBe(true)
		})
	})
})
