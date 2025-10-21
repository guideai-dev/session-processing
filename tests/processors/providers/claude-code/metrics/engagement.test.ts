import { describe, it, expect } from 'vitest'
import { ClaudeEngagementProcessor } from '../../../../../src/processors/providers/claude-code/metrics/engagement.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('ClaudeEngagementProcessor', () => {
	const processor = new ClaudeEngagementProcessor()

	const createSession = (
		messages: Array<{ type: string; content: string; timestamp: Date }>,
		duration: number
	): ParsedSession => ({
		sessionId: 'test-session',
		provider: 'claude-code',
		messages: messages.map((m, i) => ({
			id: `msg_${i}`,
			type: m.type as 'user_input' | 'assistant_response' | 'user_input' | 'assistant_response',
			content: m.content,
			timestamp: m.timestamp,
		})),
		startTime: new Date('2025-01-15T10:00:00.000Z'),
		endTime: new Date('2025-01-15T10:00:00.000Z'),
		duration,
	})

	describe('basic metrics', () => {
		it('should calculate interruption rate from messages', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Create a component', timestamp: new Date('2025-01-15T10:00:00Z') },
					{ type: 'assistant_response', content: 'Creating...', timestamp: new Date('2025-01-15T10:00:05Z') },
					{
						type: 'user_input',
						content: '[Request interrupted by user]',
						timestamp: new Date('2025-01-15T10:00:10Z'),
					},
					{ type: 'assistant_response', content: 'Understood', timestamp: new Date('2025-01-15T10:00:12Z') },
				],
				300000 // 5 minutes
			)

			const metrics = await processor.process(session)

			// 1 interruption out of 2 assistant messages = 50%
			expect(metrics.interruption_rate).toBe(50)
			expect(metrics.metadata?.total_interruptions).toBe(1)
			expect(metrics.metadata?.total_responses).toBe(2)
		})

		it('should calculate session length in minutes', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response', timestamp: new Date() },
				],
				3600000 // 60 minutes
			)

			const metrics = await processor.process(session)

			expect(metrics.session_length_minutes).toBe(60)
		})

		it('should round session length to nearest minute', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response', timestamp: new Date() },
				],
				150000 // 2.5 minutes
			)

			const metrics = await processor.process(session)

			expect(metrics.session_length_minutes).toBe(3)
		})
	})

	describe('interruption detection', () => {
		it('should detect "Request interrupted by user for tool use" messages', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response', timestamp: new Date() },
					{
						type: 'user_input',
						content: '[Request interrupted by user for tool use]',
						timestamp: new Date(),
					},
					{ type: 'assistant_response', content: 'OK', timestamp: new Date() },
				],
				60000
			)

			const metrics = await processor.process(session)

			expect(metrics.metadata?.total_interruptions).toBe(1)
		})

		it('should detect multiple interruptions', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Working...', timestamp: new Date() },
					{
						type: 'user_input',
						content: '[Request interrupted by user]',
						timestamp: new Date(),
					},
					{ type: 'assistant_response', content: 'Stopping...', timestamp: new Date() },
					{
						type: 'user_input',
						content: '[Request interrupted by user for tool use]',
						timestamp: new Date(),
					},
					{ type: 'assistant_response', content: 'OK', timestamp: new Date() },
				],
				60000
			)

			const metrics = await processor.process(session)

			expect(metrics.metadata?.total_interruptions).toBe(2)
			// 2 interruptions / 3 assistant messages = 67%
			expect(metrics.interruption_rate).toBe(67)
		})

		it('should not count normal user messages as interruptions', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response', timestamp: new Date() },
					{ type: 'user_input', content: 'Follow-up question', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Answer', timestamp: new Date() },
				],
				60000
			)

			const metrics = await processor.process(session)

			expect(metrics.metadata?.total_interruptions).toBe(0)
			expect(metrics.interruption_rate).toBe(0)
		})
	})

	describe('edge cases', () => {
		it('should handle sessions with no user messages', async () => {
			const session = createSession(
				[
					{ type: 'assistant_response', content: 'Response 1', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 2', timestamp: new Date() },
				],
				60000
			)

			const metrics = await processor.process(session)

			expect(metrics.interruption_rate).toBe(0)
			expect(metrics.session_length_minutes).toBe(0)
		})

		it('should handle sessions with no assistant messages', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Message 1', timestamp: new Date() },
					{ type: 'user_input', content: 'Message 2', timestamp: new Date() },
				],
				60000
			)

			const metrics = await processor.process(session)

			expect(metrics.interruption_rate).toBe(0)
			expect(metrics.session_length_minutes).toBe(0)
		})

		it('should handle very short sessions (< 1 minute)', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Quick question', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Quick answer', timestamp: new Date() },
				],
				15000 // 15 seconds
			)

			const metrics = await processor.process(session)

			expect(metrics.session_length_minutes).toBe(0)
		})

		it('should handle 100% interruption rate', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Working...', timestamp: new Date() },
					{
						type: 'user_input',
						content: '[Request interrupted by user]',
						timestamp: new Date(),
					},
					{ type: 'assistant_response', content: 'Stopping...', timestamp: new Date() },
					{
						type: 'user_input',
						content: '[Request interrupted by user]',
						timestamp: new Date(),
					},
				],
				60000
			)

			const metrics = await processor.process(session)

			// 2 interruptions / 2 assistant messages = 100%
			expect(metrics.interruption_rate).toBe(100)
		})
	})

	describe('improvement tips', () => {
		it('should suggest improvement for high interruption rate (>50%)', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Working...', timestamp: new Date() },
					{
						type: 'user_input',
						content: '[Request interrupted by user]',
						timestamp: new Date(),
					},
					{ type: 'assistant_response', content: 'OK', timestamp: new Date() },
					{
						type: 'user_input',
						content: '[Request interrupted by user]',
						timestamp: new Date(),
					},
				],
				60000
			)

			const metrics = await processor.process(session)

			expect(metrics.metadata?.improvement_tips).toContain(
				'High interruption rate - consider whether initial prompt provided enough context'
			)
			expect(metrics.metadata?.improvement_tips).toContain(
				'Note: Some interruptions are effective steering when AI goes off track'
			)
		})

		it('should suggest improvement for long sessions (>60 minutes)', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Complex task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Working on it...', timestamp: new Date() },
				],
				4200000 // 70 minutes
			)

			const metrics = await processor.process(session)

			expect(metrics.metadata?.improvement_tips).toContain(
				"Long session - complex tasks take time, ensure you're making steady progress"
			)
			expect(metrics.metadata?.improvement_tips).toContain(
				'Consider whether initial requirements and context were comprehensive'
			)
		})

		it('should praise excellent collaboration for low interruption + short session', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 1', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 2', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 3', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 4', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 5', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 6', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 7', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 8', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 9', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 10', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 11', timestamp: new Date() },
				],
				1200000 // 20 minutes, no interruptions (0%), < 30 min
			)

			const metrics = await processor.process(session)

			expect(metrics.interruption_rate).toBe(0) // 0 / 11 = 0%
			expect(metrics.metadata?.improvement_tips).toContain(
				'Excellent collaboration! Efficient session with minimal course corrections'
			)
		})

		it('should not provide excellent collaboration tip if interruption rate is high', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Working...', timestamp: new Date() },
					{
						type: 'user_input',
						content: '[Request interrupted by user]',
						timestamp: new Date(),
					},
					{ type: 'assistant_response', content: 'OK', timestamp: new Date() },
				],
				1200000 // 20 minutes, 50% interruption rate
			)

			const metrics = await processor.process(session)

			expect(metrics.metadata?.improvement_tips).not.toContain(
				'Excellent collaboration! Efficient session with minimal course corrections'
			)
		})

		it('should not provide excellent collaboration tip if session is long', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 1', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 2', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 3', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 4', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 5', timestamp: new Date() },
				],
				3600000 // 60 minutes, 0% interruption but too long
			)

			const metrics = await processor.process(session)

			expect(metrics.metadata?.improvement_tips).not.toContain(
				'Excellent collaboration! Efficient session with minimal course corrections'
			)
		})
	})

	describe('rounding behavior', () => {
		it('should round interruption rate to nearest integer', async () => {
			const session = createSession(
				[
					{ type: 'user_input', content: 'Task', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 1', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 2', timestamp: new Date() },
					{ type: 'assistant_response', content: 'Response 3', timestamp: new Date() },
					{
						type: 'user_input',
						content: '[Request interrupted by user]',
						timestamp: new Date(),
					},
				],
				60000
			)

			const metrics = await processor.process(session)

			// 1 interruption / 3 assistant messages = 33.33%, should round to 33
			expect(metrics.interruption_rate).toBe(33)
		})
	})
})
