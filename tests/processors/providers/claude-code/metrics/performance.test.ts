import { describe, it, expect, beforeAll } from 'vitest'
import { ClaudePerformanceProcessor } from '../../../../../src/processors/providers/claude-code/metrics/performance.js'
import { ClaudeCodeParser } from '../../../../../src/parsers/providers/claude-code/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('ClaudePerformanceProcessor', () => {
	const processor = new ClaudePerformanceProcessor()
	const parser = new ClaudeCodeParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('claude-code', 'sample-claude-session.jsonl')
		parsedSession = parser.parseSession(sessionContent)
	})

	describe('basic metrics with real session', () => {
		it('should calculate response latency from real session', async () => {
			const metrics = await processor.process(parsedSession)

			// Should have positive response latency
			expect(metrics.response_latency_ms).toBeGreaterThanOrEqual(0)
			expect(typeof metrics.response_latency_ms).toBe('number')
		})

		it('should calculate task completion time from session duration', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.task_completion_time_ms).toBe(parsedSession.duration)
			expect(metrics.task_completion_time_ms).toBeGreaterThan(0)
		})

		it('should track total responses in metadata', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.metadata?.total_responses).toBeGreaterThan(0)
		})
	})

	describe('response latency calculation', () => {
		it('should calculate average response time from multiple exchanges', () => {
			const customSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'First question',
						timestamp: new Date('2025-01-15T10:00:00.000Z'),
					},
					{
						id: 'msg2',
						type: 'assistant_response',
						content: 'First answer',
						timestamp: new Date('2025-01-15T10:00:02.000Z'), // 2 seconds later
					},
					{
						id: 'msg3',
						type: 'user_input',
						content: 'Second question',
						timestamp: new Date('2025-01-15T10:00:05.000Z'),
					},
					{
						id: 'msg4',
						type: 'assistant_response',
						content: 'Second answer',
						timestamp: new Date('2025-01-15T10:00:09.000Z'), // 4 seconds later
					},
				],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:00:09.000Z'),
				duration: 9000,
			}

			return processor.process(customSession).then(metrics => {
				// Average of 2000ms and 4000ms = 3000ms
				expect(metrics.response_latency_ms).toBe(3000)
				expect(metrics.metadata?.total_responses).toBe(2)
			})
		})

		it('should round response latency to nearest millisecond', () => {
			const customSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Question',
						timestamp: new Date('2025-01-15T10:00:00.000Z'),
					},
					{
						id: 'msg2',
						type: 'assistant_response',
						content: 'Answer',
						timestamp: new Date('2025-01-15T10:00:02.567Z'), // 2567ms later
					},
				],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:00:02.567Z'),
				duration: 2567,
			}

			return processor.process(customSession).then(metrics => {
				expect(metrics.response_latency_ms).toBe(2567)
			})
		})

		it('should handle sessions with no user-assistant exchanges', async () => {
			const sessionNoExchanges: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Only user message',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			const metrics = await processor.process(sessionNoExchanges)
			expect(metrics.response_latency_ms).toBe(0)
			expect(metrics.metadata?.total_responses).toBe(0)
		})
	})

	describe('edge cases', () => {
		it('should handle empty session gracefully', async () => {
			const emptySession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [],
				startTime: new Date(),
				endTime: new Date(),
				duration: 0,
			}

			const metrics = await processor.process(emptySession)

			expect(metrics.response_latency_ms).toBe(0)
			expect(metrics.task_completion_time_ms).toBe(0)
		})

		it('should handle very fast responses', () => {
			const fastSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Quick question',
						timestamp: new Date('2025-01-15T10:00:00.000Z'),
					},
					{
						id: 'msg2',
						type: 'assistant_response',
						content: 'Quick answer',
						timestamp: new Date('2025-01-15T10:00:00.100Z'), // 100ms later
					},
				],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:00:00.100Z'),
				duration: 100,
			}

			return processor.process(fastSession).then(metrics => {
				expect(metrics.response_latency_ms).toBe(100)
			})
		})

		it('should handle very slow responses', () => {
			const slowSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Complex question',
						timestamp: new Date('2025-01-15T10:00:00.000Z'),
					},
					{
						id: 'msg2',
						type: 'assistant_response',
						content: 'Detailed answer',
						timestamp: new Date('2025-01-15T10:00:30.000Z'), // 30 seconds later
					},
				],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:00:30.000Z'),
				duration: 30000,
			}

			return processor.process(slowSession).then(metrics => {
				expect(metrics.response_latency_ms).toBe(30000)
			})
		})
	})

	describe('improvement tips', () => {
		it('should suggest breaking down complex requests for high latency (>10s)', () => {
			const highLatencySession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Very complex request',
						timestamp: new Date('2025-01-15T10:00:00.000Z'),
					},
					{
						id: 'msg2',
						type: 'assistant_response',
						content: 'Detailed response',
						timestamp: new Date('2025-01-15T10:00:15.000Z'), // 15 seconds
					},
				],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:00:15.000Z'),
				duration: 15000,
			}

			return processor.process(highLatencySession).then(metrics => {
				expect(metrics.metadata?.improvement_tips).toContain(
					'Consider breaking complex requests into smaller, more specific tasks'
				)
				expect(metrics.metadata?.improvement_tips).toContain(
					'Provide more context upfront to reduce AI thinking time'
				)
			})
		})

		it('should suggest being more specific for long sessions (>30 min)', () => {
			const longSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Task',
						timestamp: new Date('2025-01-15T10:00:00.000Z'),
					},
					{
						id: 'msg2',
						type: 'assistant_response',
						content: 'Response',
						timestamp: new Date('2025-01-15T10:00:05.000Z'),
					},
				],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:35:00.000Z'),
				duration: 2100000, // 35 minutes
			}

			return processor.process(longSession).then(metrics => {
				expect(metrics.metadata?.improvement_tips).toContain(
					'Try to be more specific in your initial request to reduce back-and-forth'
				)
				expect(metrics.metadata?.improvement_tips).toContain(
					'Consider providing code examples or file paths to speed up the process'
				)
			})
		})

		it('should provide no tips for efficient sessions', () => {
			const efficientSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Quick task',
						timestamp: new Date('2025-01-15T10:00:00.000Z'),
					},
					{
						id: 'msg2',
						type: 'assistant_response',
						content: 'Quick response',
						timestamp: new Date('2025-01-15T10:00:02.000Z'), // 2 seconds
					},
				],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:05:00.000Z'), // 5 minutes total
				duration: 300000,
			}

			return processor.process(efficientSession).then(metrics => {
				expect(metrics.metadata?.improvement_tips).toEqual([])
			})
		})
	})

	describe('task completion time', () => {
		it('should use exact session duration', async () => {
			const metrics = await processor.process(parsedSession)

			// Task completion time should match session duration exactly
			expect(metrics.task_completion_time_ms).toBe(parsedSession.duration)
		})

		it('should handle zero duration sessions', async () => {
			const zeroDuration: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Instant',
						timestamp: new Date('2025-01-15T10:00:00.000Z'),
					},
				],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:00:00.000Z'),
				duration: 0,
			}

			const metrics = await processor.process(zeroDuration)
			expect(metrics.task_completion_time_ms).toBe(0)
		})
	})

	describe('multiple response tracking', () => {
		it('should correctly average multiple response times', () => {
			const multiExchangeSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{ id: '1', type: 'user_input', content: 'Q1', timestamp: new Date('2025-01-15T10:00:00Z') },
					{
						id: '2',
						type: 'assistant_response',
						content: 'A1',
						timestamp: new Date('2025-01-15T10:00:01Z'),
					}, // 1s
					{ id: '3', type: 'user_input', content: 'Q2', timestamp: new Date('2025-01-15T10:00:05Z') },
					{
						id: '4',
						type: 'assistant_response',
						content: 'A2',
						timestamp: new Date('2025-01-15T10:00:08Z'),
					}, // 3s
					{ id: '5', type: 'user_input', content: 'Q3', timestamp: new Date('2025-01-15T10:00:10Z') },
					{
						id: '6',
						type: 'assistant_response',
						content: 'A3',
						timestamp: new Date('2025-01-15T10:00:15Z'),
					}, // 5s
				],
				startTime: new Date('2025-01-15T10:00:00Z'),
				endTime: new Date('2025-01-15T10:00:15Z'),
				duration: 15000,
			}

			return processor.process(multiExchangeSession).then(metrics => {
				// Average: (1000 + 3000 + 5000) / 3 = 3000
				expect(metrics.response_latency_ms).toBe(3000)
				expect(metrics.metadata?.total_responses).toBe(3)
			})
		})
	})
})
